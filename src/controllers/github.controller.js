import { config } from '../../config/env.js';
import {
  listInstallationRepos,
  listPullRequests as fetchPullRequests,
  getPullRequest as fetchPullRequest,
  upsertRepository,
  describeGithubError,
} from '../services/github.service.js';
import { ok, badRequest, serverError } from '../utils/response.js';
import {
  repoSchema,
  prParamsSchema,
  paginationSchema,
  listPullRequestsQuerySchema,
} from '../validators/github.validator.js';

/**
 * GET /api/github/install
 * Redirect to the GitHub App installation screen.
 */
export function install(_req, res) {
  if (!config.github.isAppConfigured()) {
    return badRequest(res, 'GitHub App is not configured.');
  }
  const slug = config.github.appSlug;
  return res.redirect(302, `https://github.com/apps/${encodeURIComponent(slug)}/installations/new`);
}

/**
 * GET /api/github/repositories
 */
export async function listRepositories(req, res) {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) return badRequest(res, parsed.error.flatten().fieldErrors);

  const { page, perPage } = parsed.data;

  try {
    const data = await listInstallationRepos(page, perPage);
    const repositories = data.repositories ?? [];

    // Best-effort persistence so reviews can resolve repositories later.
    for (const repo of repositories) {
      await upsertRepository(repo).catch(() => {});
    }

    return ok(res, {
      totalCount: data.total_count ?? repositories.length,
      page,
      perPage,
      repositories: repositories.map((repo) => ({
        id: repo.id,
        owner: repo.owner.login,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        description: repo.description,
        defaultBranch: repo.default_branch,
      })),
    });
  } catch (err) {
    const status = err.status ?? err.statusCode;
    if (status && status < 500) return badRequest(res, describeGithubError(err));
    return serverError(res, 'Failed to list repositories.');
  }
}

/**
 * GET /api/github/repositories/:owner/:repo/pulls
 */
export async function listPullRequests(req, res) {
  const params = repoSchema.safeParse(req.params);
  const query = listPullRequestsQuerySchema.safeParse(req.query);
  if (!params.success) return badRequest(res, params.error.flatten().fieldErrors);
  if (!query.success) return badRequest(res, query.error.flatten().fieldErrors);

  const { owner, repo } = params.data;
  const { state, page, perPage } = query.data;

  try {
    const pullRequests = await fetchPullRequests(owner, repo, state, page, perPage);
    return ok(res, {
      page,
      perPage,
      pullRequests: pullRequests.map((pr) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        draft: pr.draft,
        author: pr.user?.login,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        headSha: pr.head?.sha,
        baseBranch: pr.base?.ref,
      })),
    });
  } catch (err) {
    const status = err.status ?? err.statusCode;
    if (status === 404) return badRequest(res, describeGithubError(err));
    return serverError(res, describeGithubError(err));
  }
}

/**
 * GET /api/github/repositories/:owner/:repo/pulls/:number
 */
export async function getPullRequest(req, res) {
  const parsed = prParamsSchema.safeParse(req.params);
  if (!parsed.success) return badRequest(res, parsed.error.flatten().fieldErrors);

  const { owner, repo, number } = parsed.data;

  try {
    const pr = await fetchPullRequest(owner, repo, number);
    return ok(res, {
      number: pr.number,
      title: pr.title,
      state: pr.state,
      draft: pr.draft,
      body: pr.body?.slice(0, 5000) ?? null,
      author: pr.user?.login,
      head: { ref: pr.head?.ref, sha: pr.head?.sha },
      base: { ref: pr.base?.ref, sha: pr.base?.sha },
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      mergeable: pr.mergeable,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
    });
  } catch (err) {
    const status = err.status ?? err.statusCode;
    if (status === 404) return badRequest(res, describeGithubError(err));
    return serverError(res, describeGithubError(err));
  }
}