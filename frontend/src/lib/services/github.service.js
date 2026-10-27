import { apiFetch, buildApiUrl, IS_MOCK_MODE } from "@/lib/api-client";
import * as mock from "@/lib/mock-service";

export const githubService = {
  isMock: IS_MOCK_MODE,

  async getRepositories({ page = 1, perPage = 30 } = {}) {
    if (IS_MOCK_MODE) return mock.mockGetRepositories({ page, perPage });
    return apiFetch("/api/github/repositories", { query: { page, perPage } });
  },

  async getPullRequests(owner, repo, { state = "open", page = 1, perPage = 30 } = {}) {
    if (IS_MOCK_MODE) return mock.mockGetPullRequests(owner, repo, { state, page, perPage });
    return apiFetch(`/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`, {
      query: { state, page, perPage },
    });
  },

  async getPullRequest(owner, repo, number) {
    if (IS_MOCK_MODE) return mock.mockGetPullRequest(owner, repo, number);
    return apiFetch(
      `/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${encodeURIComponent(number)}`,
    );
  },

  async getInstallation() {
    if (IS_MOCK_MODE) return mock.mockGetInstallation();
    const response = await apiFetch("/api/github/repositories", { query: { page: 1, perPage: 100 } });
    const repositories = response?.repositories ?? [];
    return {
      connected: true,
      account: repositories[0]?.owner ?? null,
      installationId: null,
      repositoryCount: repositories.length,
    };
  },

  getInstallUrl() {
    return buildApiUrl("/api/github/install");
  },
};