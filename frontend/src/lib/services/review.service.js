import { apiFetch, IS_MOCK_MODE } from "@/lib/api-client";
import * as mock from "@/lib/mock-service";

export const reviewService = {
  isMock: IS_MOCK_MODE,

  async createReview({ owner, repo, pullNumber }) {
    if (IS_MOCK_MODE) return mock.mockCreateReview({ owner, repo, pullNumber });
    return apiFetch("/api/reviews", {
      method: "POST",
      body: { owner, repo, pullNumber: Number(pullNumber) },
    });
  },

  async listReviews({ limit = 20, offset = 0, status, repositoryId } = {}) {
    if (IS_MOCK_MODE) return mock.mockListReviews({ limit, offset, status });
    return apiFetch("/api/reviews", { query: { limit, offset, status, repositoryId } });
  },

  async getReview(id) {
    if (IS_MOCK_MODE) return mock.mockGetReview(id);
    return apiFetch(`/api/reviews/${encodeURIComponent(id)}`);
  },

  async getFindings(id) {
    if (IS_MOCK_MODE) return mock.mockGetFindings(id);
    return apiFetch(`/api/reviews/${encodeURIComponent(id)}/findings`);
  },

  async getStatus(id) {
    if (IS_MOCK_MODE) return mock.mockGetStatus(id);
    return apiFetch(`/api/reviews/${encodeURIComponent(id)}/status`);
  },

  async publishReview(id) {
    if (IS_MOCK_MODE) return mock.mockPublishReview(id);
    return apiFetch(`/api/reviews/${encodeURIComponent(id)}/publish`, { method: "POST" });
  },
};