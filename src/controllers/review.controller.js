import {
  enqueueReview,
  getReview as fetchReview,
  listReviews as listAllReviews,
  getFindings as fetchFindings,
  getReviewStatus as fetchStatus,
  publishSummary,
} from '../services/review.service.js';
import { ok, accepted, notFound, badRequest } from '../utils/response.js';
import { createReviewSchema, listReviewsSchema } from '../validators/review.validator.js';

/**
 * POST /api/reviews
 * Start a review for owner/repo#pullNumber. Responds 202 with the review id.
 */
export async function createReview(req, res) {
  const parsed = createReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return badRequest(res, parsed.error.flatten().fieldErrors);
  }

  const id = await enqueueReview({
    owner: parsed.data.owner,
    repo: parsed.data.repo,
    pullNumber: parsed.data.pullNumber,
  });

  return accepted(res, { id });
}

/**
 * GET /api/reviews/:id
 */
export async function getReview(req, res) {
  const review = await fetchReview(req.params.id);
  if (!review) return notFound(res, 'Review not found');
  return ok(res, formatReview(review));
}

/**
 * GET /api/reviews?limit=&offset=&status=&repositoryId=
 */
export async function listReviews(req, res) {
  const parsed = listReviewsSchema.safeParse(req.query);
  if (!parsed.success) {
    return badRequest(res, parsed.error.flatten().fieldErrors);
  }

  const result = await listAllReviews({
    limit: parsed.data.limit,
    offset: parsed.data.offset,
    status: parsed.data.status,
    repositoryId: parsed.data.repositoryId,
  });

  return ok(res, {
    ...result,
    data: result.data.map(formatReview),
  });
}

/**
 * GET /api/reviews/:id/findings
 */
export async function getFindings(req, res) {
  const review = await fetchReview(req.params.id);
  if (!review) return notFound(res, 'Review not found');

  const findings = await fetchFindings(req.params.id);
  return ok(res, {
    reviewId: req.params.id,
    findings: findings.map(formatFinding),
  });
}

/**
 * GET /api/reviews/:id/status
 */
export async function getReviewStatus(req, res) {
  const status = await fetchStatus(req.params.id);
  return ok(res, status);
}

/**
 * POST /api/reviews/:id/publish
 * Re-post the summary to GitHub. Publishing errors are reported separately
 * from review errors.
 */
export async function publishReview(req, res) {
  const review = await fetchReview(req.params.id);
  if (!review) return notFound(res, 'Review not found');

  const result = await publishSummary(req.params.id);
  return ok(res, result);
}

// ---------------------------------------------------------------------------
// Serialisers
// ---------------------------------------------------------------------------

function formatReview(review) {
  return {
    id: review.id,
    status: review.status,
    summary: review.summary,
    errorMessage: review.errorMessage,
    headSha: review.headSha,
    createdAt: review.createdAt,
    completedAt: review.completedAt,
    publishing: {
      publishedAt: review.summaryPublishedAt ?? null,
      error: review.summaryPublishError ?? null,
    },
    pullRequest: review.pullRequest
      ? {
          id: review.pullRequest.id,
          number: review.pullRequest.number,
          title: review.pullRequest.title,
          state: review.pullRequest.state,
          repository: review.pullRequest.repository
            ? {
                owner: review.pullRequest.repository.owner,
                name: review.pullRequest.repository.name,
              }
            : undefined,
        }
      : undefined,
    findingCount: review._count?.findings ?? review.findings?.length ?? 0,
  };
}

function formatFinding(finding) {
  return {
    id: finding.id,
    title: finding.title,
    description: finding.description,
    severity: finding.severity,
    category: finding.category,
    filePath: finding.filePath,
    startLine: finding.startLine,
    endLine: finding.endLine,
    evidence: finding.evidence,
    suggestedFix: finding.suggestedFix,
    confidence: finding.confidence,
    createdAt: finding.createdAt,
  };
}