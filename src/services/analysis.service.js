import { ESLint } from 'eslint';

// ---------------------------------------------------------------------------
// ESLint static analysis
// ---------------------------------------------------------------------------

const eslintConfig = [
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        JSON: 'readonly',
        Math: 'readonly',
        Object: 'readonly',
        Array: 'readonly',
        String: 'readonly',
        Number: 'readonly',
        Boolean: 'readonly',
        Date: 'readonly',
        RegExp: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        Promise: 'readonly',
        Error: 'readonly',
        parseInt: 'readonly',
        parseFloat: 'readonly',
        isNaN: 'readonly',
        isFinite: 'readonly',
        undefined: 'readonly',
        globalThis: 'readonly',
      },
    },
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-extend-native': 'error',
      'no-debugger': 'warn',
      'no-console': 'warn',
      'no-alert': 'error',
      'no-template-curly-in-string': 'warn',
      'no-unused-vars': 'warn',
      'no-undef': 'error',
      'no-extra-semi': 'warn',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-empty': 'warn',
      'no-extra-boolean-cast': 'warn',
      'no-irregular-whitespace': 'error',
      'no-loss-of-precision': 'error',
      'no-unsafe-optional-chaining': 'error',
      'no-unsafe-negation': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-prototype-builtins': 'warn',
      'no-var': 'warn',
      'prefer-const': 'warn',
      'no-const-assign': 'error',
    },
  },
];

/**
 * Run ESLint on a single file's content.
 * Returns an array of {line, column, message, ruleId, severity} objects.
 *
 * @param {string} filePath - virtual path (for file-type detection)
 * @param {string} content
 * @returns {Promise<import('./types.internal.js').ESLintMessage[]>}
 */
export async function lintFile(filePath, content) {
  try {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: eslintConfig,
    });

    const [result] = await eslint.lintText(content, { filePath });
    return (result.messages ?? []).map((m) => ({
      line: m.line,
      column: m.column,
      message: m.message,
      ruleId: m.ruleId ?? 'eslint',
      severity: m.severity === 2 ? 'error' : 'warn',
    }));
  } catch (/** @type {any} */ err) {
    console.warn(`[ESLint] Failed to lint ${filePath}: ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Heuristic / pattern-based analysis
// ---------------------------------------------------------------------------

/** @type {Array<{id:string, title:string, severity:string, category:string, patterns:RegExp[], suggestion:string}>} */
const SECRET_RULES = [
  {
    id: 'secret-aws-key',
    title: 'AWS access key exposed',
    severity: 'CRITICAL',
    category: 'SECURITY',
    patterns: [/AKIA[0-9A-Z]{16}/g],
    suggestion: 'Remove this key immediately and rotate it in the AWS console. Load it from an environment variable or a secrets manager.',
  },
  {
    id: 'secret-github-token',
    title: 'GitHub token exposed',
    severity: 'CRITICAL',
    category: 'SECURITY',
    patterns: [/gh[pousr]_[A-Za-z0-9]{36,}/g, /github_pat_[A-Za-z0-9_]+/g],
    suggestion: 'Revoke this token in GitHub Settings > Developer settings and load it from an environment variable.',
  },
  {
    id: 'secret-slack',
    title: 'Slack token exposed',
    severity: 'CRITICAL',
    category: 'SECURITY',
    patterns: [/xox[baprs]-[0-9A-Za-z-]+/g],
    suggestion: 'Rotate this Slack token and store it in a secrets manager or environment variable.',
  },
  {
    id: 'secret-stripe',
    title: 'Stripe live key exposed',
    severity: 'CRITICAL',
    category: 'SECURITY',
    patterns: [/sk_live_[0-9a-zA-Z]{24,}/g],
    suggestion: 'Remove and rotate this Stripe secret key. Use environment variables.',
  },
  {
    id: 'secret-generic',
    title: 'Potential hardcoded credential',
    severity: 'HIGH',
    category: 'SECURITY',
    patterns: [
      // Matches assignment-like patterns with a value that looks like a secret.
      /(?:api[_\s-]?key|secret|token|password|passwd|pwd|credential|auth)\s*[:=]\s*['"`](?!(?:\$|process\.env|<|changeme|example|your[-_ ]|xxx|test|dummy|fake|placeholder|secret))([^'"`\s]{12,})['"`]/gi,
    ],
    suggestion: 'Move this credential to an environment variable or a secure vault. Never commit secrets.',
  },
];

/** @type {Array<{id:string, title:string, severity:string, category:string, check: (line:string)=>boolean, suggestion:string}>} */
const SECURITY_RULES = [
  {
    id: 'danger-eval',
    title: 'Use of eval() detected',
    severity: 'HIGH',
    category: 'SECURITY',
    check: (l) => /\beval\s*\(/.test(l),
    suggestion: 'Avoid eval(). Use a safer alternative such as JSON.parse(), a sandboxed interpreter, or a parser library.',
  },
  {
    id: 'danger-new-function',
    title: 'Use of new Function() detected',
    severity: 'HIGH',
    category: 'SECURITY',
    check: (l) => /new\s+Function\s*\(/.test(l),
    suggestion: 'Avoid the Function constructor. Use explicit logic or a safe parser.',
  },
  {
    id: 'danger-child-process',
    title: 'Potentially unsafe child process command',
    severity: 'HIGH',
    category: 'SECURITY',
    check: (l) => /(?:exec(?:Sync)?|spawn(?:Sync)?)\s*\(/.test(l) && (/\$\{/.test(l) || /\+\s*\w+/.test(l)),
    suggestion: 'Do not interpolate user input into shell commands. Use execFile / spawn with an array of arguments, or validate input with an allowlist.',
  },
  {
    id: 'danger-sql-concat',
    title: 'Potential SQL injection via string concatenation',
    severity: 'HIGH',
    category: 'SECURITY',
    check: (l) => /(?:query|execute|raw)\s*\(/.test(l) && (/\$\{/.test(l) || /['"]\s*\+/.test(l)),
    suggestion: 'Use parameterized queries or an ORM. Never concatenate user input into SQL strings.',
  },
  {
    id: 'danger-inner-html',
    title: 'Setting innerHTML - potential XSS',
    severity: 'MEDIUM',
    category: 'SECURITY',
    check: (l) => /\.innerHTML\s*=/.test(l) || /\bdangerouslySetInnerHTML\b/.test(l),
    suggestion: 'Use textContent, innerText, or a DOM sanitizer such as DOMPurify before inserting HTML.',
  },
  {
    id: 'danger-tls-disabled',
    title: 'TLS verification disabled',
    severity: 'HIGH',
    category: 'SECURITY',
    check: (l) => /rejectUnauthorized\s*:\s*false/.test(l) || /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0/.test(l),
    suggestion: 'Do not disable TLS verification in production. Use proper CA certificates.',
  },
  {
    id: 'danger-weak-hash',
    title: 'Weak cryptographic hash used',
    severity: 'MEDIUM',
    category: 'SECURITY',
    check: (l) => /(?:createHash|\.createHash)\s*\(\s*['"](?:md5|sha1)['"]/.test(l),
    suggestion: 'Use SHA-256 or stronger. MD5 and SHA-1 are considered cryptographically broken.',
  },
  {
    id: 'danger-chmod-777',
    title: 'World-writable file permissions (chmod 777)',
    severity: 'MEDIUM',
    category: 'SECURITY',
    check: (l) => /\bchmod\s*\(\s*0?777/.test(l),
    suggestion: 'Use restrictive permissions (e.g. 755 for dirs, 644 for files). Avoid 777.',
  },
  {
    id: 'danger-py-eval',
    title: 'Use of os.system() or subprocess with shell=True',
    severity: 'HIGH',
    category: 'SECURITY',
    check: (l) => /\bos\.system\(/.test(l) || /subprocess\..*shell\s*=\s*True/.test(l),
    suggestion: 'Avoid shell=True. Use subprocess.run with an argument list.',
  },
  {
    id: 'danger-py-pickle',
    title: 'Unsafe deserialization with pickle',
    severity: 'HIGH',
    category: 'SECURITY',
    check: (l) => /\bpickle\.loads?\(/.test(l),
    suggestion: 'Do not unpickle untrusted data. Use JSON or a safer serialization format.',
  },
  {
    id: 'danger-py-tls',
    title: 'TLS verification disabled in requests',
    severity: 'HIGH',
    category: 'SECURITY',
    check: (l) => /verify\s*=\s*False/.test(l),
    suggestion: 'Keep verify=True in production. Set verify to a custom CA bundle if needed.',
  },
  {
    id: 'danger-bug-debugger',
    title: 'debugger statement left in code',
    severity: 'LOW',
    category: 'BUG',
    check: (l) => /\bdebugger\b/.test(l),
    suggestion: 'Remove the debugger statement before merging.',
  },
  {
    id: 'danger-conflict-marker',
    title: 'Merge conflict marker present',
    severity: 'CRITICAL',
    category: 'BUG',
    check: (l) => /^(<<<<<<<|=======|>>>>>>>)(\s.*)?$/.test(l.trim()),
    suggestion: 'Resolve the merge conflict and remove the markers.',
  },
  {
    id: 'danger-unpinned-action',
    title: 'GitHub Action not pinned to a commit SHA',
    severity: 'LOW',
    category: 'CI',
    check: (l) => /^\s*uses:\s+\S+@(?:main|master)$/.test(l),
    suggestion: 'Pin third-party actions to a full commit SHA to prevent supply-chain attacks.',
  },
  {
    id: 'danger-ptarget',
    title: 'pull_request_target event used — verify checkout ref',
    severity: 'MEDIUM',
    category: 'CI',
    check: (l) => /^\s*pull_request_target\s*:/.test(l),
    suggestion: 'pull_request_target runs in the base context. Ensure you do not check out or execute code from the PR head ref without review.',
  },
];

/**
 * Scan a single added line for secret patterns.
 * @returns {{ ruleId:string, value:string }[]}
 */
function scanSecretsLine(line) {
  const hits = [];
  for (const rule of SECRET_RULES) {
    for (const pattern of rule.patterns) {
      const re = new RegExp(pattern.source, pattern.flags);
      for (const m of line.matchAll(re)) {
        hits.push({ ruleId: rule.id, value: m[0] });
      }
    }
  }
  return hits;
}

/**
 * Redact a secret value for safe display.
 */
export function redact(value) {
  if (value.length <= 8) return '***';
  return value.slice(0, 4) + '…' + value.slice(-4);
}

/**
 * Run heuristic analyzers against an array of added lines.
 *
 * @param {{ file: string, line: number, content: string }[]} added
 * @returns {import('./types.internal.js').RawFinding[]}
 */
export function runHeuristicAnalysis(added) {
  /** @type {import('./types.internal.js').RawFinding[]} */
  const findings = [];

  for (const item of added) {
    // Secret scanner
    const secretHits = scanSecretsLine(item.content);
    for (const hit of secretHits) {
      const rule = SECRET_RULES.find((r) => r.id === hit.ruleId);
      if (!rule) continue;
      findings.push({
        title: rule.title,
        description: `Hardcoded ${rule.title.toLowerCase()} detected: \`${redact(hit.value)}\`.`,
        severity: rule.severity,
        category: rule.category,
        filePath: item.file,
        startLine: item.line,
        endLine: item.line,
        evidence: item.content.includes(hit.value) ? item.content.replace(hit.value, redact(hit.value)) : item.content,
        suggestedFix: rule.suggestion,
        confidence: 0.95,
        source: 'heuristic',
        ruleId: rule.id,
      });
    }

    // Security rules
    for (const rule of SECURITY_RULES) {
      if (rule.check(item.content)) {
        findings.push({
          title: rule.title,
          description: `Line contains potentially risky pattern: ${rule.title.toLowerCase()}.`,
          severity: rule.severity,
          category: rule.category,
          filePath: item.file,
          startLine: item.line,
          endLine: item.line,
          evidence: item.content.slice(0, 300),
          suggestedFix: rule.suggestion,
          confidence: 0.85,
          source: 'heuristic',
          ruleId: rule.id,
        });
      }
    }
  }

  return findings;
}

/**
 * Check for test gaps in a diff.
 * @param {{ file: string, additions: number }[]} files
 * @returns {import('./types.internal.js').RawFinding[]}
 */
export function runTestGapAnalysis(files) {
  const testFileSet = new Set(
    files
      .filter((f) => /(^|\/)(__tests__|tests?|specs?)\/|\.(test|spec)\.[jt]sx?$/i.test(f.file))
      .map((f) => f.file),
  );

  const sourceFiles = files.filter(
    (f) => /\.(js|jsx|ts|tsx|py|go|rs|rb|php|java)$/i.test(f.file) && !testFileSet.has(f.file),
  );

  const findings = [];
  if (testFileSet.size === 0 && sourceFiles.length > 0) {
    const totalAdditions = files.reduce((s, f) => s + f.additions, 0);
    if (totalAdditions > 10) {
      findings.push({
        title: 'No tests added with this change',
        description: `This PR changes ${sourceFiles.length} source file(s) (${totalAdditions} additions) with no test files added or modified.`,
        severity: 'MEDIUM',
        category: 'TEST',
        filePath: null,
        startLine: null,
        endLine: null,
        evidence: sourceFiles.map((f) => f.file).join(', '),
        suggestedFix: 'Consider adding unit or integration tests for the changed logic.',
        confidence: 0.7,
        source: 'test-gap',
        ruleId: 'test-gap-none',
      });
    }
  }

  return findings;
}

/**
 * Deduplicate findings by (filePath, startLine, ruleId).
 * Keeps the highest severity + confidence when duplicates exist.
 */
export function deduplicateFindings(findings) {
  const seen = new Map();
  for (const f of findings) {
    const key = `${f.filePath ?? ''}:${f.startLine ?? ''}:${f.ruleId}`;
    const existing = seen.get(key);
    if (!existing || confidenceRank(f) > confidenceRank(existing)) {
      seen.set(key, f);
    }
  }
  return [...seen.values()];
}

/** Simple rank for dedup priority. */
function confidenceRank(f) {
  const sev = { CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, INFO: 1 };
  return (sev[f.severity] ?? 0) * 10 + (f.confidence ?? 0);
}