import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { config } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { createHttpError } from '../middleware/error.middleware.js';

// ---------------------------------------------------------------------------
// Octokit factory
// ---------------------------------------------------------------------------

/**
 * Octokit authenticated as the configured GitHub App installation.
 * The auth strategy transparently fetches and refreshes installation tokens.
 */
export function getOctokit() {
  if (!config.github.isAppConfigured()) {
    throw createHttpError(
      400,
      'GitHub App is not configured. Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY and GITHUB_WEBHOOK_SECRET.',
    );
  }
  if (!config.github.installationId) {
    throw createHttpError(400, 'GITHUB_INSTALLATION_ID is not set.');
  }

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: config.github.appId,
      privateKey: config.github.privateKey,
      installationId: config.github.installationId,
    },
  });
}

/**
 * Turn GitHub/Octokit errors into safe, actionable messages.
 * Never includes tokens or request headers.
 */
export function describeGithubError(err) {
  if (!err) return 'GitHub API request failed.';
  const status = err.status ?? err.statusCode;

  if (status === 401) {
    return 'GitHub authentication failed. Check the GitHub App private key and installation.';
  }
  if (status === 403) {
    const remaining = err.response?.headers?.['x-ratelimit-remaining'];
    if (String(remaining) === '0') {
      return 'GitHub API rate limit exceeded. Try again after the reset window.';
    }
    return 'GitHub refused the request. Check the App permissions for this repository.';
  }
  if (status === 404) {
    return 'Repository or pull request not found, or the GitHub App does not have access.';
  }
  if (status === 422) {
    return 'GitHub rejected the request because the pull request data is not in a reviewable state.';
  }
  if (status === 429) {
    return 'GitHub secondary rate limit hit. Try again shortly.';
  }
  return err.message || 'GitHub API request failed.';
}

// ---------------------------------------------------------------------------
// Pull requests
// ---------------------------------------------------------------------------

/**
 * Fetch a pull request and every changed file.
 * @returns {Promise<{ pr: object, files: object[] }>}
 */
export async function fetchPullRequest(owner, repo, pullNumber) {
  const octokit = getOctokit();
  const [prResponse, files] = await Promise.all([
    octokit.pulls.get({ owner, repo, pull_number: pullNumber }),
    octokit.paginate(octokit.pulls.listFiles, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    }),
  ]);
  return { pr: prResponse.data, files };
}

/**
 * List pull requests for a repository.
 */
export async function listPullRequests(owner, repo, state = 'open', page = 1, perPage = 30) {
  const octokit = getOctokit();
  const { data } = await octokit.pulls.list({ owner, repo, state, page, per_page: perPage });
  return data;
}

/**
 * Fetch a single pull request.
 */
export async function getPullRequest(owner, repo, pullNumber) {
  const octokit = getOctokit();
  const { data } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber });
  return data;
}

/**
 * Fetch a file at a specific commit. Returns null when the path does not exist.
 */
export async function fetchFileContent(owner, repo, path, ref) {
  const octokit = getOctokit();
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
    if (Array.isArray(data) || data.type !== 'file') return null;
    return Buffer.from(data.content, 'base64').toString('utf-8');
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

/**
 * Post the review summary as a PR review comment (does not approve or block).
 * @returns {Promise<{ id: number, htmlUrl: string }>}
 */
export async function publishReviewSummary({ owner, repo, pullNumber, headSha, body }) {
  const octokit = getOctokit();
  const { data } = await octokit.pulls.createReview({
    owner,
    repo,
    pull_number: pullNumber,
    commit_id: headSha,
    body,
    event: 'COMMENT',
  });
  return { id: data.id, htmlUrl: data.html_url };
}

// ---------------------------------------------------------------------------
// Installation repositories
// ---------------------------------------------------------------------------

/**
 * Repositories the App installation can access.
 */
export async function listInstallationRepos(page = 1, perPage = 30) {
  const octokit = getOctokit();
  const { data } = await octokit.apps.listReposAccessibleToInstallation({
    page,
    per_page: perPage,
  });
  return data;
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

/**
 * Upsert a repository row from a GitHub repository payload.
 *
 * @param {object} githubRepo
 * @param {number} [fallbackInstallationId] — used by webhook payloads
 */
export async function upsertRepository(githubRepo, fallbackInstallationId) {
  const installationId =
    githubRepo.installationId ?? fallbackInstallationId ?? config.github.installationId;

  if (!installationId) {
    throw new Error('Cannot store repository without an installation id.');
  }

  return prisma.repository.upsert({
    where: { githubRepositoryId: githubRepo.id },
    update: {
      owner: githubRepo.owner.login,
      name: githubRepo.name,
      installationId,
    },
    create: {
      githubRepositoryId: githubRepo.id,
      owner: githubRepo.owner.login,
      name: githubRepo.name,
      installationId,
    },
  });
}

/**
 * Upsert a pull request row.
 */
export async function upsertPullRequest(repositoryId, prData) {
  return prisma.pullRequest.upsert({
    where: {
      repositoryId_number: { repositoryId, number: prData.number },
    },
    update: {
      title: prData.title,
      state: prData.state ?? 'open',
      headSha: prData.head.sha,
      baseSha: prData.base.sha,
    },
    create: {
      repositoryId,
      number: prData.number,
      title: prData.title,
      state: prData.state ?? 'open',
      headSha: prData.head.sha,
      baseSha: prData.base.sha,
    },
  });
}