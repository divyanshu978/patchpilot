import { ApiError } from "@/lib/api-client";
import {
  mockFindings,
  mockPullRequests,
  mockRepositories,
  mockReviews,
} from "@/data/mock-data";

const state = {
  repositories: mockRepositories.map((repo) => ({ ...repo })),
  pullRequests: mockPullRequests.map((pr) => ({ ...pr })),
  reviews: mockReviews.map((review) => ({ ...review })),
  findings: mockFindings.map((finding) => ({ ...finding })),
};

const wait = (ms = 320) => new Promise((resolve) => setTimeout(resolve, ms));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toRepository(repo) {
  return {
    id: repo.id,
    owner: repo.owner,
    name: repo.name,
    fullName: repo.fullName,
    private: repo.private,
    description: repo.description,
    defaultBranch: repo.defaultBranch,
  };
}

function toPullRequest(pr) {
  return {
    number: pr.number,
    title: pr.title,
    state: pr.state,
    draft: pr.draft,
    author: pr.author,
    createdAt: pr.updatedAt,
    updatedAt: pr.updatedAt,
    headSha: pr.headSha,
    baseBranch: pr.targetBranch,
    sourceBranch: pr.sourceBranch,
  };
}

function toReview(review) {
  return {
    id: review.id,
    status: review.status,
    summary: review.summary,
    errorMessage: review.errorMessage,
    headSha: review.headSha,
    createdAt: review.createdAt,
    completedAt: review.completedAt,
    overallRisk: review.overallRisk,
    findingCount: review.findingCount,
    publishing: { publishedAt: review.publishedAt ?? null, error: review.publishError ?? null },
    pullRequest: clone(review.pullRequest),
  };
}

export async function mockGetRepositories({ page = 1, perPage = 30 } = {}) {
  await wait();
  const start = (page - 1) * perPage;
  return {
    totalCount: state.repositories.length,
    page,
    perPage,
    repositories: state.repositories.slice(start, start + perPage).map(toRepository),
  };
}

export async function mockGetPullRequests(owner, repo, { state: prState = "open", page = 1, perPage = 30 } = {}) {
  await wait();
  const all = state.pullRequests.filter(
    (pr) => pr.owner === owner && pr.repo === repo && (prState === "all" || pr.state === prState),
  );
  const start = (page - 1) * perPage;
  return {
    page,
    perPage,
    pullRequests: all.slice(start, start + perPage).map(toPullRequest),
  };
}

export async function mockGetPullRequest(owner, repo, number) {
  await wait(200);
  const pr = state.pullRequests.find(
    (item) => item.owner === owner && item.repo === repo && item.number === Number(number),
  );
  if (!pr) {
    throw new ApiError("Pull request not found", { status: 404 });
  }
  return {
    number: pr.number,
    title: pr.title,
    state: pr.state,
    draft: pr.draft,
    body: null,
    author: pr.author,
    head: { ref: pr.sourceBranch, sha: pr.headSha },
    base: { ref: pr.targetBranch, sha: "0".repeat(40) },
    additions: 128,
    deletions: 34,
    changedFiles: 6,
    mergeable: true,
    createdAt: pr.updatedAt,
    updatedAt: pr.updatedAt,
  };
}

export async function mockListReviews({ limit = 20, offset = 0, status } = {}) {
  await wait();
  const filtered = state.reviews
    .filter((review) => !status || review.status === status)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return {
    data: filtered.slice(offset, offset + limit).map(toReview),
    total: filtered.length,
    limit,
    offset,
  };
}

export async function mockGetReview(id) {
  await wait(200);
  const review = state.reviews.find((item) => item.id === id);
  if (!review) {
    throw new ApiError("Review not found", { status: 404 });
  }
  return toReview(review);
}

export async function mockGetFindings(reviewId) {
  await wait(200);
  return {
    reviewId,
    findings: state.findings.filter((finding) => finding.reviewId === reviewId).map(clone),
  };
}

export async function mockGetStatus(reviewId) {
  await wait(180);
  const review = state.reviews.find((item) => item.id === reviewId);
  if (!review) {
    throw new ApiError("Review not found", { status: 404 });
  }
  const counts = state.findings
    .filter((finding) => finding.reviewId === reviewId)
    .reduce((accumulator, finding) => {
      accumulator[finding.severity] = (accumulator[finding.severity] ?? 0) + 1;
      return accumulator;
    }, {});

  return {
    id: review.id,
    status: review.status,
    summary: review.summary,
    errorMessage: review.errorMessage,
    createdAt: review.createdAt,
    completedAt: review.completedAt,
    summaryPublishedAt: review.publishedAt ?? null,
    summaryPublishError: review.publishError ?? null,
    findingCounts: counts,
  };
}

function buildMockFindings(reviewId, pullRequest) {
  const createdAt = new Date().toISOString();
  return [
    {
      id: `${reviewId}-f1`,
      reviewId,
      title: "Error response returned without a status code",
      description:
        "The handler returns a rejected promise instead of an explicit HTTP error, so the API falls back to a 500 and the original cause is lost in the logs.",
      severity: "HIGH",
      category: "BUG",
      filePath: `src/${pullRequest.repo}/handler.js`,
      startLine: 42,
      endLine: 42,
      evidence: "throw new Error('request failed');",
      suggestedFix: "Throw a typed HTTP error so the status code and message reach the client.",
      confidence: 0.84,
      createdAt,
    },
    {
      id: `${reviewId}-f2`,
      reviewId,
      title: "Request body is not validated",
      description:
        "The handler reads fields straight from the request body without checking their type, so a malformed payload leads to a runtime error deep in the business logic.",
      severity: "MEDIUM",
      category: "BUG",
      filePath: `src/${pullRequest.repo}/handler.js`,
      startLine: 30,
      endLine: 33,
      evidence: "const { accountId, amount } = req.body;",
      suggestedFix: "Validate the payload with a schema before using it.",
      confidence: 0.79,
      createdAt,
    },
    {
      id: `${reviewId}-f3`,
      reviewId,
      title: "No tests added with this change",
      description:
        "The pull request changes production code but adds no test coverage for the new behaviour.",
      severity: "LOW",
      category: "TEST",
      filePath: null,
      startLine: null,
      endLine: null,
      evidence: `Changed files: src/${pullRequest.repo}/handler.js`,
      suggestedFix: "Add tests for the success path and for invalid input.",
      confidence: 0.68,
      createdAt,
    },
  ];
}

export async function mockCreateReview({ owner, repo, pullNumber }) {
  await wait(260);
  const pullRequest = state.pullRequests.find(
    (pr) => pr.owner === owner && pr.repo === repo && pr.number === Number(pullNumber),
  );
  if (!pullRequest) {
    throw new ApiError("Pull request not found", { status: 404 });
  }

  const existing = state.reviews.find(
    (review) =>
      review.pullRequest.id === pullRequest.id &&
      (review.status === "QUEUED" || review.status === "RUNNING"),
  );
  if (existing) {
    return { id: existing.id };
  }

  const id = `review-mock-${Date.now()}`;
  const review = {
    id,
    pullRequestId: pullRequest.id,
    headSha: pullRequest.headSha,
    status: "QUEUED",
    summary: null,
    errorMessage: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
    overallRisk: "NONE",
    findingCount: 0,
    pullRequest: {
      id: pullRequest.id,
      number: pullRequest.number,
      title: pullRequest.title,
      state: pullRequest.state,
      author: pullRequest.author,
      sourceBranch: pullRequest.sourceBranch,
      targetBranch: pullRequest.targetBranch,
      repository: { owner, name: repo },
    },
  };
  state.reviews.unshift(review);

  setTimeout(() => {
    const target = state.reviews.find((item) => item.id === id);
    if (target) target.status = "RUNNING";
  }, 1400);

  setTimeout(() => {
    const target = state.reviews.find((item) => item.id === id);
    if (!target) return;
    const findings = buildMockFindings(id, { repo });
    state.findings.push(...findings);
    target.status = "COMPLETED";
    target.completedAt = new Date().toISOString();
    target.findingCount = findings.length;
    target.overallRisk = "HIGH";
    target.summary = `PatchPilot reviewed "${pullRequest.title}" and found 3 issue(s): 1 high, 1 medium, 1 low. This automated review is not a guarantee that the code is bug-free or secure.`;
  }, 4200);

  return { id };
}

export async function mockPublishReview(reviewId) {
  await wait(220);
  const review = state.reviews.find((item) => item.id === reviewId);
  if (!review) {
    throw new ApiError("Review not found", { status: 404 });
  }
  if (review.status !== "COMPLETED") {
    throw new ApiError("Only completed reviews can be published.", { status: 409 });
  }
  review.publishedAt = new Date().toISOString();
  return {
    published: true,
    reviewId,
    url: null,
  };
}

export function mockGetInstallation() {
  return {
    connected: state.repositories.length > 0,
    account: state.repositories[0]?.owner ?? null,
    installationId: state.repositories[0]?.installationId ?? null,
    repositoryCount: state.repositories.length,
  };
}
