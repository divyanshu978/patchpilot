import { prisma } from '../../config/prisma.js';
import { config } from '../../config/env.js';
import {
  fetchPullRequest,
  fetchFileContent,
  upsertRepository,
  upsertPullRequest,
  publishReviewSummary,
  describeGithubError,
} from './github.service.js';
import {
  lintFile,
  runHeuristicAnalysis,
  runTestGapAnalysis,
  deduplicateFindings,
} from './analysis.service.js';
import { runLLMReview } from './ai.service.js';
import { createHttpError } from '../middleware/error.middleware.js';

// Limits that keep a single review bounded.
const MAX_FILES = 300;
const MAX_DIFF_CHARS = 600_000;
const MAX_FINDINGS = 200;

/** Dependencies that can be replaced in tests. */
export const defaultDeps = {
  fetchPullRequest,
  fetchFileContent,
  upsertRepository,
  upsertPullRequest,
  publishReviewSummary,
  runLLMReview,
};

// In-process lock: prevent concurrent reviews on the same PR + commit.
const activeReviews = new Set();

const SEVERITY_RANK = { CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, INFO: 1 };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a review for a pull request and start processing it.
 *
 * @param {{ owner: string, repo: string, pullNumber: number }} input
 * @param {{ deps?: typeof defaultDeps, inline?: boolean }} [options]
 * @returns {Promise<string>} review id
 */
export async function enqueueReview({ owner, repo: repoName, pullNumber }, options = {}) {
  const deps = options.deps ?? defaultDeps;
  const inline = options.inline ?? false;

  // 1. Fetch the PR and its changed files from GitHub.
  let pr;
  let files;
  try {
    ({ pr, files } = await deps.fetchPullRequest(owner, repoName, pullNumber));
  } catch (err) {
    throw createHttpError(err.status === 404 ? 404 : 502, describeGithubError(err));
  }

  // 2. Persist repository + pull request.
  const dbRepo = await deps.upsertRepository(pr.base.repo);
  const dbPr = await deps.upsertPullRequest(dbRepo.id, pr);

  // 3. Reuse an in-flight review for the same commit instead of duplicating it.
  const existing = await prisma.review.findFirst({
    where: {
      pullRequestId: dbPr.id,
      headSha: pr.head.sha,
      status: { in: ['QUEUED', 'RUNNING'] },
    },
  });

  if (existing) {
    // If a review is queued but no longer running (e.g. lost on restart), restart it.
    if (existing.status === 'QUEUED') {
      if (inline) await processReview(existing.id, pr, files, deps);
      else setImmediate(() => processReview(existing.id, pr, files, deps));
    }
    return existing.id;
  }

  // 4. Create the review row.
  const review = await prisma.review.create({
    data: {
      pullRequestId: dbPr.id,
      headSha: pr.head.sha,
      status: 'QUEUED',
    },
  });

  // 5. Process asynchronously (default) or inline (tests).
  if (inline) {
    await processReview(review.id, pr, files, deps);
  } else {
    setImmediate(() => processReview(review.id, pr, files, deps));
  }

  return review.id;
}

/**
 * Fetch a review with its pull request and repository.
 */
export async function getReview(reviewId) {
  return prisma.review.findUnique({
    where: { id: reviewId },
    include: { pullRequest: { include: { repository: true } } },
  });
}

/**
 * Paginated review list, optionally filtered by status or repository.
 */
export async function listReviews({ limit = 20, offset = 0, status, repositoryId } = {}) {
  const where = {};
  if (status) where.status = status;
  if (repositoryId) where.pullRequest = { repositoryId };

  const [data, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        pullRequest: { include: { repository: true } },
        _count: { select: { findings: true } },
      },
    }),
    prisma.review.count({ where }),
  ]);

  return { data, total, limit, offset };
}

/**
 * Findings for a review, most severe first.
 */
export async function getFindings(reviewId) {
  return prisma.finding.findMany({
    where: { reviewId },
    orderBy: [{ severity: 'asc' }, { filePath: 'asc' }, { startLine: 'asc' }],
  });
}

/**
 * Status summary with per-severity finding counts.
 */
export async function getReviewStatus(reviewId) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      status: true,
      summary: true,
      errorMessage: true,
      createdAt: true,
      completedAt: true,
      summaryPublishedAt: true,
      summaryPublishError: true,
    },
  });
  if (!review) throw createHttpError(404, 'Review not found');

  const counts = await prisma.finding.groupBy({
    by: ['severity'],
    where: { reviewId },
    _count: { _all: true },
  });

  return {
    ...review,
    findingCounts: Object.fromEntries(counts.map((c) => [c.severity, c._count._all])),
  };
}

/**
 * Re-post the review summary to GitHub. Errors are returned separately from
 * review-processing errors.
 */
export async function publishSummary(reviewId, deps = defaultDeps) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { findings: true, pullRequest: { include: { repository: true } } },
  });
  if (!review) throw createHttpError(404, 'Review not found');
  if (review.status !== 'COMPLETED') {
    throw createHttpError(409, 'Only completed reviews can be published.');
  }
  if (!config.github.isAppConfigured()) {
    throw createHttpError(400, 'GitHub App is not configured; cannot publish.');
  }

  const { owner, name } = review.pullRequest.repository;
  const body = buildReviewBody(review, review.findings);

  try {
    const result = await deps.publishReviewSummary({
      owner,
      repo: name,
      pullNumber: review.pullRequest.number,
      headSha: review.headSha,
      body,
    });
    await prisma.review.update({
      where: { id: reviewId },
      data: { summaryPublishedAt: new Date(), summaryPublishError: null },
    });
    return { published: true, reviewId: result.id, url: result.htmlUrl };
  } catch (err) {
    const message = describeGithubError(err);
    await prisma.review.update({
      where: { id: reviewId },
      data: { summaryPublishError: message.slice(0, 1000) },
    });
    return { published: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Review worker
// ---------------------------------------------------------------------------

/**
 * Run the analysis pipeline for one review.
 * Never throws: failures are recorded on the review row.
 */
async function processReview(reviewId, pr, files, deps) {
  const lockKey = `${pr.base.repo.full_name}#${pr.number}#${pr.head.sha}`;
  if (activeReviews.has(lockKey)) return;
  activeReviews.add(lockKey);

  try {
    await prisma.review.update({
      where: { id: reviewId },
      data: { status: 'RUNNING', errorMessage: null },
    });

    const limitedFiles = files.slice(0, MAX_FILES);
    const truncatedFiles = files.length > limitedFiles.length;

    // ---- Build diff context ----
    /** @type {Map<string, Set<number>>} */
    const insertedLinesByFile = new Map();
    const changedFiles = new Set();
    const fileList = [];
    let diffText = '';
    let diffChars = 0;

    for (const file of limitedFiles) {
      changedFiles.add(file.filename);
      fileList.push({
        file: file.filename,
        additions: file.additions ?? 0,
        deletions: file.deletions ?? 0,
        binary: Boolean(file.binary),
      });

      if (!file.patch || file.binary) continue;

      const inserted = parseAddedLineNumbers(file.patch);
      insertedLinesByFile.set(file.filename, inserted);
      if (diffChars < MAX_DIFF_CHARS) {
        const block = `### ${file.filename}\n\`\`\`diff\n${file.patch}\n\`\`\`\n\n`;
        diffText += block;
        diffChars += block.length;
      }
    }

    // ---- 1. Heuristic analysis ----
    const allAdded = [];
    for (const file of limitedFiles) {
      if (file.binary || !file.patch) continue;
      allAdded.push(...parseAddedLines(file.patch, file.filename));
    }
    const heuristicFindings = runHeuristicAnalysis(allAdded);

    // ---- 2. ESLint on changed JS/TS files ----
    const eslintFindings = [];
    const owner = pr.base.repo.owner.login;
    const repoName = pr.base.repo.name;

    for (const file of limitedFiles) {
      const isJs = /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(file.filename);
      if (!isJs || file.binary || file.status === 'removed') continue;

      const content = await deps.fetchFileContent(owner, repoName, file.filename, pr.head.sha);
      if (!content) continue;

      const messages = await lintFile(file.filename, content);
      const inserted = insertedLinesByFile.get(file.filename) ?? new Set();
      const contentLines = content.split('\n');

      for (const message of messages) {
        // Only surface problems introduced on added lines.
        if (!inserted.has(message.line)) continue;

        eslintFindings.push({
          title: `ESLint: ${message.message}`,
          description: `Static analysis flagged this line (${message.ruleId}).`,
          severity: message.severity === 'error' ? 'HIGH' : 'LOW',
          category: /security|no-eval|no-implied-eval|no-new-func/.test(message.ruleId)
            ? 'SECURITY'
            : 'BUG',
          filePath: file.filename,
          startLine: message.line,
          endLine: message.line,
          evidence: (contentLines[message.line - 1] ?? '').slice(0, 300) || null,
          suggestedFix: `Fix the \`${message.ruleId}\` violation on this line.`,
          confidence: 0.9,
          source: 'eslint',
          ruleId: `eslint/${message.ruleId}`,
        });
      }
    }

    // ---- 3. Test-gap analysis ----
    const testGapFindings = runTestGapAnalysis(fileList);

    // ---- 4. LLM review ----
    let aiFindings = [];
    let aiSummary = null;
    let llmUsed = false;
    if (config.llm.isConfigured()) {
      const aiResult = await deps.runLLMReview(
        { title: pr.title, body: pr.body },
        diffText,
        changedFiles,
        insertedLinesByFile,
      );
      aiFindings = aiResult.findings;
      aiSummary = aiResult.summary;
      llmUsed = aiResult.used;
    }

    // ---- 5. Merge + deduplicate + cap ----
    const allFindings = mergeAnalysisFindings(
      [...heuristicFindings, ...eslintFindings, ...testGapFindings],
      aiFindings,
    )
      .sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0))
      .slice(0, MAX_FINDINGS);

    // ---- 6. Summary ----
    const summary = buildSummary(pr.title, allFindings, aiSummary, {
      truncatedFiles,
      llmConfigured: config.llm.isConfigured(),
      llmUsed,
    });

    // ---- 7. Persist findings + complete ----
    await prisma.$transaction([
      prisma.finding.deleteMany({ where: { reviewId } }),
      prisma.finding.createMany({
        data: allFindings.map((f) => ({
          reviewId,
          title: f.title.slice(0, 500),
          description: f.description.slice(0, 5000),
          severity: f.severity,
          category: f.category,
          filePath: f.filePath ?? null,
          startLine: f.startLine ?? null,
          endLine: f.endLine ?? null,
          evidence: f.evidence?.slice(0, 5000) ?? null,
          suggestedFix: f.suggestedFix?.slice(0, 5000) ?? null,
          confidence: f.confidence,
        })),
      }),
      prisma.review.update({
        where: { id: reviewId },
        data: {
          status: 'COMPLETED',
          summary,
          completedAt: new Date(),
          errorMessage: null,
        },
      }),
    ]);

    // ---- 8. Publish summary to GitHub (errors tracked separately) ----
    if (config.github.isAppConfigured()) {
      try {
        const completed = await prisma.review.findUnique({
          where: { id: reviewId },
          include: { findings: true, pullRequest: { include: { repository: true } } },
        });
        if (completed) {
          const body = buildReviewBody(completed, completed.findings);
          await deps.publishReviewSummary({
            owner,
            repo: repoName,
            pullNumber: pr.number,
            headSha: pr.head.sha,
            body,
          });
          await prisma.review.update({
            where: { id: reviewId },
            data: { summaryPublishedAt: new Date(), summaryPublishError: null },
          });
        }
      } catch (err) {
        const message = describeGithubError(err);
        await prisma.review.update({
          where: { id: reviewId },
          data: { summaryPublishError: message.slice(0, 1000) },
        }).catch(() => {});
        console.warn(`[Review] Could not publish summary for ${reviewId}: ${message}`);
      }
    }
  } catch (err) {
    console.error(`[Review] ${reviewId} failed: ${err.message}`);
    await prisma.review
      .update({
        where: { id: reviewId },
        data: {
          status: 'FAILED',
          errorMessage: (err.message || 'Review failed').slice(0, 2000),
          completedAt: new Date(),
        },
      })
      .catch(() => {});
  } finally {
    activeReviews.delete(lockKey);
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Static findings win over AI findings for the same file/line/category, unless
 * the AI finding is more severe. Exact duplicates are then removed.
 */
function mergeAnalysisFindings(staticFindings, aiFindings) {
  const merged = [...staticFindings];
  const locationIndex = new Map();
  staticFindings.forEach((finding, index) => {
    if (finding.filePath && finding.startLine) {
      locationIndex.set(`${finding.filePath}:${finding.startLine}:${finding.category}`, index);
    }
  });

  for (const finding of aiFindings) {
    if (!finding.filePath || !finding.startLine) {
      merged.push(finding);
      continue;
    }
    const key = `${finding.filePath}:${finding.startLine}:${finding.category}`;
    const index = locationIndex.get(key);
    if (index === undefined) {
      merged.push(finding);
    } else if ((SEVERITY_RANK[finding.severity] ?? 0) > (SEVERITY_RANK[merged[index].severity] ?? 0)) {
      merged[index] = finding;
    }
  }

  return deduplicateFindings(merged);
}

function buildSummary(prTitle, findings, aiSummary, { truncatedFiles, llmConfigured, llmUsed }) {
  const parts = [];
  if (findings.length === 0) {
    parts.push(`PatchPilot reviewed "${prTitle}" and found no issues in the changed lines.`);
  } else {
    const counts = {};
    for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
    const listed = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']
      .filter((s) => counts[s])
      .map((s) => `${counts[s]} ${s.toLowerCase()}`)
      .join(', ');
    parts.push(`PatchPilot reviewed "${prTitle}" and found ${findings.length} issue(s): ${listed}.`);
  }

  if (aiSummary) parts.push(aiSummary);
  if (llmConfigured && !llmUsed) {
    parts.push('The AI reviewer did not return usable results, so only static analysis was applied.');
  }
  if (truncatedFiles) {
    parts.push(`Only the first ${MAX_FILES} changed files were analyzed.`);
  }
  parts.push('This automated review is not a guarantee that the code is bug-free or secure.');
  return parts.join(' ');
}

/**
 * Markdown body posted to GitHub. Kept under GitHub's 65,536-char limit.
 */
export function buildReviewBody(review, findings) {
  const lines = [];
  const counts = {};
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;

  lines.push('## PatchPilot review');
  lines.push('');
  const risk = overallSeverity(findings);
  lines.push(
    `**Overall risk:** ${risk} · **Findings:** ${findings.length} · **Commit:** \`${review.headSha.slice(0, 7)}\``,
  );
  lines.push('');
  if (review.summary) {
    lines.push(review.summary, '');
  }

  const ordered = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
  for (const severity of ordered) {
    const group = findings.filter((f) => f.severity === severity);
    if (group.length === 0) continue;
    lines.push(`### ${severity} (${group.length})`);
    lines.push('');
    for (const finding of group) {
      const location = finding.filePath
        ? ` — \`${finding.filePath}${finding.startLine ? `:${finding.startLine}` : ''}\``
        : '';
      lines.push(`- **${finding.title}**${location}`);
      if (finding.description) {
        lines.push(`  ${finding.description.replace(/\s+/g, ' ').slice(0, 800)}`);
      }
      if (finding.suggestedFix) {
        lines.push('  <details><summary>Suggested fix</summary>', '');
        lines.push('  ```');
        lines.push(finding.suggestedFix.slice(0, 1500));
        lines.push('  ```', '', '  </details>');
      }
    }
    lines.push('');
  }

  lines.push(
    '<sub>Automated review by PatchPilot. This does not guarantee the code is bug-free or secure.</sub>',
  );

  return lines.join('\n').slice(0, 65_000);
}

function overallSeverity(findings) {
  let max = 0;
  for (const f of findings) max = Math.max(max, SEVERITY_RANK[f.severity] ?? 0);
  if (max >= 5) return 'CRITICAL';
  if (max >= 4) return 'HIGH';
  if (max >= 3) return 'MEDIUM';
  if (max >= 2) return 'LOW';
  if (max >= 1) return 'INFO';
  return 'NONE';
}

/**
 * Head-revision line numbers that were added by a GitHub per-file patch.
 * @param {string} patch
 * @returns {Set<number>}
 */
function parseAddedLineNumbers(patch) {
  const lines = patch.split('\n');
  const added = new Set();
  let newLine = 0;
  let inHunk = false;

  for (const line of lines) {
    const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (header) {
      newLine = Number(header[1]);
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith('+')) {
      added.add(newLine);
      newLine++;
    } else if (line.startsWith('-')) {
      // Deleted line: no head line number.
    } else {
      newLine++;
    }
  }
  return added;
}

/**
 * Added lines with head line numbers, for heuristic analysis.
 * @param {string} patch
 * @param {string} filename
 */
function parseAddedLines(patch, filename) {
  const lines = patch.split('\n');
  const result = [];
  let newLine = 0;
  let inHunk = false;

  for (const line of lines) {
    const header = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (header) {
      newLine = Number(header[2]);
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith('+')) {
      result.push({ file: filename, line: newLine, content: line.slice(1) });
      newLine++;
    } else if (line.startsWith('-')) {
      // Deleted line.
    } else {
      newLine++;
    }
  }
  return result;
}