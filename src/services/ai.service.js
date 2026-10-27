import { z } from 'zod';
import { config } from '../../config/env.js';

// ---------------------------------------------------------------------------
// Zod schema for LLM output
// ---------------------------------------------------------------------------

const SEVERITY_VALUES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const CATEGORY_VALUES = [
  'SECURITY',
  'BUG',
  'PERFORMANCE',
  'TEST',
  'MAINTAINABILITY',
  'STYLE',
  'DEPENDENCY',
];

const SEVERITY_ALIASES = {
  CRITICAL: 'CRITICAL',
  CRIT: 'CRITICAL',
  BLOCKER: 'CRITICAL',
  HIGH: 'HIGH',
  MAJOR: 'HIGH',
  MEDIUM: 'MEDIUM',
  MODERATE: 'MEDIUM',
  LOW: 'LOW',
  MINOR: 'LOW',
  INFO: 'INFO',
  INFORMATIONAL: 'INFO',
};

const CATEGORY_ALIASES = {
  SECURITY: 'SECURITY',
  SECURITY_ISSUE: 'SECURITY',
  VULNERABILITY: 'SECURITY',
  BUG: 'BUG',
  CORRECTNESS: 'BUG',
  ERROR: 'BUG',
  PERFORMANCE: 'PERFORMANCE',
  PERF: 'PERFORMANCE',
  TEST: 'TEST',
  TESTING: 'TEST',
  TESTS: 'TEST',
  TEST_COVERAGE: 'TEST',
  MAINTAINABILITY: 'MAINTAINABILITY',
  QUALITY: 'MAINTAINABILITY',
  CODE_QUALITY: 'MAINTAINABILITY',
  STYLE: 'STYLE',
  FORMATTING: 'STYLE',
  DEPENDENCY: 'DEPENDENCY',
  DEPENDENCIES: 'DEPENDENCY',
};

const severitySchema = z.preprocess(
  (value) =>
    typeof value === 'string'
      ? SEVERITY_ALIASES[value.trim().toUpperCase()] ?? value.trim().toUpperCase()
      : value,
  z.enum(SEVERITY_VALUES),
);

const categorySchema = z.preprocess(
  (value) =>
    typeof value === 'string'
      ? CATEGORY_ALIASES[value.trim().toUpperCase()] ?? value.trim().toUpperCase()
      : value,
  z.enum(CATEGORY_VALUES),
);

// Provider-specific extras must never discard an otherwise valid finding.
const lineSchema = z.preprocess((value) => {
  const number =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  return Number.isInteger(number) && number > 0 ? number : undefined;
}, z.number().int().positive().optional());

const confidenceSchema = z.preprocess((value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;

  const text = value.trim().toLowerCase().replace(/%$/, '');
  const words = { high: 90, medium: 70, moderate: 70, low: 50 };
  if (words[text] !== undefined) return words[text];

  const number = Number(text);
  return Number.isNaN(number) ? undefined : number;
}, z.number().min(0).max(100).optional());

const LlmFindingSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(2000),
  severity: severitySchema,
  category: categorySchema,
  filePath: z.string().optional(),
  startLine: lineSchema,
  endLine: lineSchema,
  evidence: z.string().max(2000).optional(),
  suggestedFix: z.string().max(3000).optional(),
  confidence: confidenceSchema,
});

// Envelope is intentionally permissive: individual findings are validated below
// so one malformed item cannot discard the whole review.
const LlmResponseSchema = z.object({
  summary: z.string().max(5000).optional(),
  overallRisk: z.string().optional(),
  findings: z.array(z.unknown()).max(100).optional(),
});

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

function buildSystemPrompt() {
  return `You are an expert code reviewer for open-source pull requests. Your job is to:
1. Find bugs, security vulnerabilities, performance issues, and missing tests.
2. Rate each issue by severity (CRITICAL/HIGH/MEDIUM/LOW/INFO) and category.
3. Provide clear explanations and actionable suggested fixes.
4. Be precise about file paths and line numbers — only reference lines that were ADDED in the diff.

IMPORTANT RULES:
- Only flag genuine issues. Do not nitpick formatting or style unless it's a serious problem.
- Secret detection is already done by another scanner; focus on logic, safety, and correctness.
- If a file path is mentioned, it MUST appear in the diff.
- Line numbers must reference ADDED lines (starting with + in the diff).
- Every finding MUST include filePath and evidence copied from the diff. Findings without evidence will be discarded.
- Do NOT suggest fixes that modify files outside the diff.
- For each finding include evidence (the relevant code snippet from the diff).
- If you can, provide a suggestedFix as a unified diff snippet.

Respond ONLY with valid JSON matching this schema:
{ "summary": string, "overallRisk": "CRITICAL"|"HIGH"|"MEDIUM"|"LOW"|"NONE", "findings": Array<{title, description, severity, category, filePath, startLine?, endLine?, evidence, suggestedFix?, confidence?}> }`;
}

/**
 * Build the user prompt with PR metadata and a truncated diff.
 */
function buildUserPrompt(prTitle, prBody, diffText) {
  let text = `# Pull Request\n**Title:** ${prTitle}\n`;
  if (prBody) {
    // Truncate body.
    text += `**Description:** ${prBody.slice(0, 2000)}\n`;
  }
  text += `\n# Diff (unified format)\n\`\`\`diff\n${diffText}\n\`\`\``;
  return text;
}

/**
 * Mask known secret patterns in text before sending to the LLM.
 */
function maskSecrets(text) {
  let out = text;
  // Common secret patterns
  const masks = [
    [/(?:gh[pousr]_|github_pat_)[A-Za-z0-9]+/g, '[REDACTED:github-token]'],
    [/(?:sk_live_|sk_test_|pk_)[0-9a-zA-Z]{24,}/g, '[REDACTED:stripe-key]'],
    [/AKIA[0-9A-Z]{16}/g, '[REDACTED:aws-key]'],
    [/xox[baprs]-[0-9A-Za-z-]+/g, '[REDACTED:slack-token]'],
    [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[REDACTED:jwt]'],
  ];
  for (const [re, replacement] of masks) {
    out = out.replace(re, replacement);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main review function
// ---------------------------------------------------------------------------

/**
 * Send the PR diff to the configured LLM and return structured findings.
 *
 * @param {{ title: string, body?: string|null }} pr
 * @param {string} diffText
 * @param {Set<string>} changedFiles
 * @param {Set<number>} insertedLinesByFile — Map<string, Set<number>>
 * @returns {Promise<{ findings: import('./types.internal.js').RawFinding[], summary: string|null, used: boolean }>}
 */
export async function runLLMReview(pr, diffText, changedFiles, insertedLinesByFile) {
  if (!config.llm.isConfigured()) {
    return { findings: [], summary: null, used: false };
  }

  const maskedDiff = maskSecrets(diffText).slice(0, config.llm.maxDiffChars);
  const system = buildSystemPrompt();
  const user = buildUserPrompt(pr.title, pr.body, maskedDiff);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.llm.timeoutMs);

  let response;
  try {
    response = await fetch(`${config.llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.llm.apiKey}`,
      },
      body: JSON.stringify({
        model: config.llm.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
  } catch (/** @type {any} */ err) {
    clearTimeout(timer);
    console.warn(`[LLM] Request failed: ${err.message}`);
    return { findings: [], summary: null, used: false };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.warn(`[LLM] API returned ${response.status}: ${body.slice(0, 200)}`);
    return { findings: [], summary: null, used: false };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    console.warn('[LLM] Failed to parse response JSON');
    return { findings: [], summary: null, used: false };
  }

  const rawContent = data?.choices?.[0]?.message?.content;
  if (!rawContent) {
    console.warn('[LLM] Empty content in response');
    return { findings: [], summary: null, used: false };
  }

  // Strip markdown fences if present.
  const jsonStr = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  if (process.env.DEBUG_LLM === '1') {
    console.log('[LLM] raw response:', jsonStr.slice(0, 4000));
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    console.warn('[LLM] Response is not valid JSON');
    return { findings: [], summary: null, used: false };
  }

  const validated = LlmResponseSchema.safeParse(parsed);
  if (!validated.success) {
    console.warn('[LLM] Response validation failed:', validated.error.flatten());
    return { findings: [], summary: null, used: false };
  }

  /** @type {import('./types.internal.js').RawFinding[]} */
  const findings = [];
  for (const rawFinding of validated.data.findings ?? []) {
    const parsedFinding = LlmFindingSchema.safeParse(rawFinding);
    if (!parsedFinding.success) continue;
    const item = parsedFinding.data;

    // Findings must be tied to a changed file with evidence from the diff.
    if (!item.filePath || !changedFiles.has(item.filePath)) {
      continue;
    }
    if (!item.evidence || item.evidence.trim().length < 5) {
      continue;
    }

    // A line reference is kept only when that line was added by the diff.
    if (item.startLine && insertedLinesByFile) {
      const lines = insertedLinesByFile.get(item.filePath);
      if (lines && !lines.has(item.startLine)) {
        item.startLine = undefined;
        item.endLine = undefined;
      }
    }

    // Normalise confidence from either the 0–1 or 0–100 scale.
    let confidence = typeof item.confidence === 'number' ? item.confidence : 0.7;
    if (confidence > 1) confidence = confidence / 100;
    if (confidence < 0) confidence = 0.5;

    findings.push({
      title: item.title,
      description: item.description,
      severity: item.severity ?? 'MEDIUM',
      category: item.category ?? 'BUG',
      filePath: item.filePath,
      startLine: item.startLine ?? null,
      endLine: item.endLine ?? null,
      evidence: item.evidence.slice(0, 2000),
      suggestedFix: item.suggestedFix ?? null,
      confidence: Math.min(1, Math.max(0, confidence)),
      source: 'ai',
      ruleId: `ai/${(item.title ?? 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}`,
    });
  }

  return {
    findings,
    summary: validated.data.summary ?? null,
    used: true,
  };
}