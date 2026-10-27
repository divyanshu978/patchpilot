const DEFAULT_API_URL = "http://localhost:4000";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");

export const IS_MOCK_MODE =
  (process.env.NEXT_PUBLIC_USE_MOCK_DATA ?? "false").toString().toLowerCase() === "true";

export const DATA_SOURCE_LABEL = IS_MOCK_MODE ? "Demo data" : "Live backend";

export class ApiError extends Error {
  constructor(message, { status = null, details = null, cause = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    if (cause) this.cause = cause;
  }
}

function buildQuery(params) {
  if (!params) return "";
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function apiFetch(path, { method = "GET", body, query, signal, timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(`${API_URL}${path}${buildQuery(query)}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body && method !== "GET" ? { "Content-Type": "application/json" } : {}),
      },
      body: body && method !== "GET" ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);

    if (!response.ok) {
      const message =
        (payload && typeof payload === "object" && payload.error) ||
        (typeof payload === "string" && payload) ||
        `Request failed with status ${response.status}`;
      throw new ApiError(
        typeof message === "string" ? message : "Request failed",
        { status: response.status, details: payload },
      );
    }

    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === "AbortError") {
      throw new ApiError("The request timed out. Check that the backend is running.", {
        status: null,
        cause: error,
      });
    }
    throw new ApiError(
      `Could not reach the PatchPilot API at ${API_URL}. Check that the backend is running.`,
      { status: null, cause: error },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function buildApiUrl(path) {
  return `${API_URL}${path}`;
}
