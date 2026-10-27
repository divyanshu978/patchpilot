import { ApiError } from "@/lib/api-client";
import { githubService } from "@/lib/services/github.service";
import { reviewService } from "@/lib/services/review.service";
import {
  formatDuration,
  safeArray,
  safeObject,
  severityWeight,
  isValidId,
} from "@/lib/utils";

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

export async function mapWithConcurrency(items, limit, mapper) {
  const list = safeArray(items);
  const results = new Array(list.length);
  let index = 0;

  async function worker() {
    while (index < list.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(list[current], current);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(limit, 1), list.length) }, () => worker()),
  );
  return results;
}

export function countBySeverity(findings) {
  const counts = {};
  for (const severity of SEVERITIES) counts[severity] = 0;
  for (const finding of safeArray(findings)) {
    const key = String(finding?.severity ?? "INFO").toUpperCase();
    if (counts[key] !== undefined) counts[key] += 1;
  }
  return counts;
}

export function highestSeverity(findings) {
  let highest = null;
  for (const finding of safeArray(findings)) {
    const severity = String(finding?.severity ?? "").toUpperCase();
    if (severity && (!highest || severityWeight(severity) > severityWeight(highest))) {
      highest = severity;
    }
  }
  return highest;
}

function reviewRepo(review) {
  const pullRequest = safeObject(review?.pullRequest);
  const repository = safeObject(pullRequest.repository);
  return {
    owner: repository.owner ?? "",
    name: repository.name ?? "",
    number: pullRequest.number ?? null,
    title: pullRequest.title ?? "",
    state: pullRequest.state ?? null,
    author: pullRequest.author ?? null,
    sourceBranch: pullRequest.sourceBranch ?? null,
    targetBranch: pullRequest.targetBranch ?? null,
  };
}

export function reviewRow(review) {
  const context = reviewRepo(review);
  return {
    id: review?.id ?? null,
    status: review?.status ?? "QUEUED",
    summary: review?.summary ?? null,
    errorMessage: review?.errorMessage ?? null,
    headSha: review?.headSha ?? null,
    createdAt: review?.createdAt ?? null,
    completedAt: review?.completedAt ?? null,
    findingCount: review?.findingCount ?? 0,
    repository: { owner: context.owner, name: context.name },
    pullRequest: {
      number: context.number,
      title: context.title,
      state: context.state,
      author: context.author,
    },
    duration: formatDuration(review?.createdAt, review?.completedAt),
  };
}

async function safeFindings(reviewId) {
  try {
    const response = await reviewService.getFindings(reviewId);
    return safeArray(response?.findings);
  } catch {
    return [];
  }
}

async function getRepositoryList() {
  try {
    const response = await githubService.getRepositories({ page: 1, perPage: 100 });
    return { connected: true, repositories: safeArray(response?.repositories) };
  } catch (error) {
    if ([400, 404, 501].includes(error?.status)) {
      return { connected: false, repositories: [], error: error.message };
    }
    throw error;
  }
}

async function getAllReviews({ limit = 100 } = {}) {
  const response = await reviewService.listReviews({ limit, offset: 0 });
  return {
    reviews: safeArray(response?.data),
    total: response?.total ?? 0,
  };
}

function buildTrend(reviews) {
  const days = 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    buckets.push({ date, reviews: 0, findings: 0 });
  }

  for (const review of safeArray(reviews)) {
    if (!review?.createdAt) continue;
    const date = new Date(review.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    date.setHours(0, 0, 0, 0);
    const bucket = buckets.find((item) => item.date.getTime() === date.getTime());
    if (!bucket) continue;
    bucket.reviews += 1;
    bucket.findings += Number(review?.findingCount ?? 0);
  }

  return buckets.map((bucket) => ({
    date: new Intl.DateTimeFormat("en", { weekday: "short" }).format(bucket.date),
    fullDate: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(bucket.date),
    reviews: bucket.reviews,
    findings: bucket.findings,
  }));
}

export async function getDashboardData() {
  const [repositoryResult, reviewResult] = await Promise.allSettled([
    getRepositoryList(),
    getAllReviews(),
  ]);

  if (repositoryResult.status === "rejected" && reviewResult.status === "rejected") {
    throw reviewResult.reason;
  }

  const repositories =
    repositoryResult.status === "fulfilled" ? repositoryResult.value.repositories : [];
  const connected =
    repositoryResult.status === "fulfilled" ? repositoryResult.value.connected : false;
  const connectionError =
    repositoryResult.status === "fulfilled"
      ? repositoryResult.value.error ?? null
      : repositoryResult.reason?.message ?? null;
  const reviews =
    reviewResult.status === "fulfilled" ? reviewResult.value.reviews : [];
  const totalReviews =
    reviewResult.status === "fulfilled" ? reviewResult.value.total : reviews.length;

  const recentCompleted = reviews
    .filter((review) => review?.status === "COMPLETED" && (review?.findingCount ?? 0) > 0)
    .slice(0, 10);

  const enriched = await mapWithConcurrency(recentCompleted, 4, async (review) => ({
    review,
    findings: await safeFindings(review.id),
  }));

  const findings = enriched.flatMap(({ review, findings: reviewFindings }) => {
    const context = reviewRepo(review);
    return reviewFindings.map((finding) => ({
      ...finding,
      reviewId: review.id,
      reviewStatus: review.status,
      repository: { owner: context.owner, name: context.name },
      pullRequest: { number: context.number, title: context.title },
    }));
  });

  const severityBreakdown = countBySeverity(findings);
  const uniquePullRequests = new Set(
    reviews.map((review) => {
      const context = reviewRepo(review);
      return `${context.owner}/${context.name}#${context.number}`;
    }),
  );

  const issuesDetected = reviews.reduce(
    (total, review) => total + Number(review?.findingCount ?? 0),
    0,
  );

  const criticalIssues = findings.filter(
    (finding) => String(finding.severity).toUpperCase() === "CRITICAL",
  ).length;

  const recentFindings = findings
    .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))
    .slice(0, 6);

  return {
    connected,
    connectionError,
    repositories,
    repositoryCount: repositories.length,
    totalReviews,
    pullRequestsAnalyzed: uniquePullRequests.size,
    issuesDetected,
    criticalIssues,
    recentReviews: reviews.slice(0, 6).map(reviewRow),
    recentFindings,
    severityBreakdown,
    trend: buildTrend(reviews),
    reviewStatusCounts: reviews.reduce((accumulator, review) => {
      const status = review?.status ?? "QUEUED";
      accumulator[status] = (accumulator[status] ?? 0) + 1;
      return accumulator;
    }, {}),
  };
}

export async function getRepositoryOptions() {
  return getRepositoryList();
}

export async function getRepositoryCards() {
  const repositoryResult = await getRepositoryList();
  if (!repositoryResult.connected) {
    return { connected: false, error: repositoryResult.error ?? null, repositories: [] };
  }

  const { reviews } = await getAllReviews();
  const byRepository = new Map();

  for (const review of reviews) {
    const context = reviewRepo(review);
    const key = `${context.owner}/${context.name}`;
    if (!byRepository.has(key)) byRepository.set(key, []);
    byRepository.get(key).push(review);
  }

  const cards = await mapWithConcurrency(
    repositoryResult.repositories,
    4,
    async (repository) => {
      const key = `${repository.owner}/${repository.name}`;
      const repoReviews = byRepository.get(key) ?? [];
      const latestReview = repoReviews[0] ?? null;
      const findings = latestReview ? await safeFindings(latestReview.id) : [];
      const severity = countBySeverity(findings);

      return {
        ...repository,
        fullName: repository.fullName ?? `${repository.owner}/${repository.name}`,
        lastAnalyzedAt: latestReview?.createdAt ?? null,
        totalReviews: repoReviews.length,
        openCritical: severity.CRITICAL,
        openHigh: severity.HIGH,
        latestReviewId: latestReview?.id ?? null,
      };
    },
  );

  return {
    connected: true,
    error: null,
    repositories: cards.sort((a, b) => a.fullName.localeCompare(b.fullName)),
  };
}

export async function getRepositoryDetail(owner, repo) {
  const repositoryResult = await getRepositoryList();
  if (!repositoryResult.connected) {
    return {
      connected: false,
      error: repositoryResult.error ?? null,
      repository: null,
      pullRequests: [],
    };
  }

  const repository =
    repositoryResult.repositories.find(
      (item) => item.owner === owner && item.name === repo,
    ) ?? null;

  if (!repository) {
    throw new ApiError("Repository not found in this installation.", { status: 404 });
  }

  const [pullRequestResult, reviewResult] = await Promise.allSettled([
    githubService.getPullRequests(owner, repo, { state: "all", page: 1, perPage: 100 }),
    getAllReviews(),
  ]);

  if (pullRequestResult.status === "rejected") throw pullRequestResult.reason;

  const pullRequests = safeArray(pullRequestResult.value?.pullRequests);
  const reviews = reviewResult.status === "fulfilled" ? reviewResult.value.reviews : [];

  const reviewsForRepo = reviews.filter((review) => {
    const context = reviewRepo(review);
    return context.owner === owner && context.name === repo;
  });

  const latestByPr = new Map();
  for (const review of reviewsForRepo) {
    const number = reviewRepo(review).number;
    if (number === null) continue;
    if (!latestByPr.has(number)) latestByPr.set(number, review);
  }

  const enriched = await mapWithConcurrency(pullRequests, 4, async (pullRequest) => {
    const latestReview = latestByPr.get(pullRequest.number) ?? null;
    const findings = latestReview ? await safeFindings(latestReview.id) : [];
    const severity = countBySeverity(findings);
    let sourceBranch = pullRequest.sourceBranch ?? null;

    if (!sourceBranch) {
      try {
        const detail = await githubService.getPullRequest(owner, repo, pullRequest.number);
        sourceBranch = detail?.head?.ref ?? null;
      } catch {
        sourceBranch = null;
      }
    }

    return {
      ...pullRequest,
      sourceBranch,
      targetBranch: pullRequest.baseBranch ?? pullRequest.targetBranch ?? "main",
      latestReview: latestReview
        ? {
            id: latestReview.id,
            status: latestReview.status,
            createdAt: latestReview.createdAt,
            findingCount: latestReview.findingCount ?? findings.length,
          }
        : null,
      severityCounts: severity,
      findingsCount: latestReview?.findingCount ?? findings.length,
    };
  });

  return {
    connected: true,
    error: null,
    repository,
    pullRequests: enriched,
    reviewsForRepo,
    connectedAt: null,
  };
}

export async function getPullsPageData() {
  const repositoryResult = await getRepositoryList();
  if (!repositoryResult.connected) {
    return {
      connected: false,
      error: repositoryResult.error ?? null,
      repositories: [],
      repository: null,
      pullRequests: [],
    };
  }

  if (repositoryResult.repositories.length === 0) {
    return {
      connected: true,
      error: null,
      repositories: [],
      repository: null,
      pullRequests: [],
    };
  }

  const first = repositoryResult.repositories[0];
  const detail = await getRepositoryDetail(first.owner, first.name);

  return {
    connected: true,
    error: null,
    repositories: repositoryResult.repositories,
    ...detail,
  };
}

export async function getPullRequestBundle(owner, repo, number) {
  const [pullRequest, reviewResult] = await Promise.allSettled([
    githubService.getPullRequest(owner, repo, number),
    getAllReviews(),
  ]);

  if (pullRequest.status === "rejected") throw pullRequest.reason;

  const reviews = reviewResult.status === "fulfilled" ? reviewResult.value.reviews : [];
  const matching = reviews
    .filter((review) => {
      const context = reviewRepo(review);
      return context.owner === owner && context.name === repo && context.number === Number(number);
    })
    .slice(0, 5);

  return { pullRequest: pullRequest.value, reviews: matching };
}

export async function getReviewListData({ limit = 20, offset = 0, status } = {}) {
  const response = await reviewService.listReviews({ limit, offset, status });
  const reviews = safeArray(response?.data);

  const enriched = await mapWithConcurrency(reviews, 5, async (review) => {
    const findings =
      review.status === "COMPLETED" && (review.findingCount ?? 0) > 0
        ? await safeFindings(review.id)
        : [];
    return {
      ...reviewRow(review),
      severityCounts: countBySeverity(findings),
      highestSeverity: highestSeverity(findings),
    };
  });

  return {
    reviews: enriched,
    total: response?.total ?? enriched.length,
    limit: response?.limit ?? limit,
    offset: response?.offset ?? offset,
  };
}

export async function getReviewBundle(id) {
  if (!isValidId(id)) {
    throw new ApiError("Invalid review id.", { status: 400 });
  }

  const [review, findingsResponse, status] = await Promise.all([
    reviewService.getReview(id),
    reviewService.getFindings(id),
    reviewService.getStatus(id),
  ]);

  const findings = safeArray(findingsResponse?.findings);
  const pullRequest = safeObject(review?.pullRequest);
  const repository = safeObject(pullRequest.repository);
  let pullRequestDetail = null;

  if (repository.owner && repository.name && pullRequest.number) {
    try {
      pullRequestDetail = await githubService.getPullRequest(
        repository.owner,
        repository.name,
        pullRequest.number,
      );
    } catch {
      pullRequestDetail = null;
    }
  }

  return {
    review,
    status,
    findings,
    counts: countBySeverity(findings),
    highestSeverity: highestSeverity(findings),
    duration: formatDuration(review?.createdAt, review?.completedAt),
    pullRequestDetail,
  };
}

export async function getGitHubPageData() {
  const repositoryResult = await getRepositoryList();
  if (!repositoryResult.connected) {
    return {
      connected: false,
      error: repositoryResult.error ?? null,
      repositories: [],
      installation: null,
      installUrl: githubService.getInstallUrl(),
    };
  }

  const installation = await githubService
    .getInstallation()
    .catch(() => ({ connected: true, account: repositoryResult.repositories[0]?.owner ?? null }));

  return {
    connected: true,
    error: null,
    repositories: repositoryResult.repositories,
    installation,
    installUrl: githubService.getInstallUrl(),
  };
}

export async function getConnectionStatus() {
  const repositoryResult = await getRepositoryList();
  return {
    connected: repositoryResult.connected,
    count: repositoryResult.repositories.length,
    account: repositoryResult.repositories[0]?.owner ?? null,
  };
}