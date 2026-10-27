import { SEVERITIES } from "@/lib/constants";

export function filterPullRequests(pullRequests, { query = "", state = "all", reviewStatus = "all", severity = "all" } = {}) {
  const term = query.trim().toLowerCase();

  return (pullRequests ?? []).filter((pr) => {
    if (state !== "all" && pr.state !== state) return false;

    const latestStatus = pr.latestReview?.status ?? "NONE";
    if (reviewStatus !== "all" && latestStatus !== reviewStatus) return false;

    if (severity !== "all") {
      const hasSeverity = SEVERITIES.includes(severity)
        ? (pr.severityCounts?.[severity] ?? 0) > 0
        : false;
      if (!hasSeverity) return false;
    }

    if (!term) return true;

    return [String(pr.number), pr.title, pr.author, pr.sourceBranch, pr.targetBranch]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });
}

export function highestSeverityFromCounts(counts) {
  if (!counts) return null;
  for (const severity of SEVERITIES) {
    if ((counts[severity] ?? 0) > 0) return severity;
  }
  return null;
}