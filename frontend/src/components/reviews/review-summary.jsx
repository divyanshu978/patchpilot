import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/findings/severity-badge";
import { ReviewStatusBadge } from "./review-status-badge";
import { formatDateTime, formatRelativeTime, shortSha } from "@/lib/utils";

const SEVERITY_TILES = [
  { key: "CRITICAL", label: "Critical", tone: "text-red-600 dark:text-red-400" },
  { key: "HIGH", label: "High", tone: "text-orange-600 dark:text-orange-400" },
  { key: "MEDIUM", label: "Medium", tone: "text-amber-600 dark:text-amber-400" },
  { key: "LOW", label: "Low", tone: "text-sky-600 dark:text-sky-400" },
];

export function ReviewSummary({
  review,
  counts,
  total,
  highestSeverity,
  duration,
  sourceBranch,
  targetBranch,
  repository,
  pullRequest,
  status,
}) {
  const summary =
    review?.summary ??
    (status === "QUEUED"
      ? "This review is queued. PatchPilot will analyze the changed lines as soon as a worker picks it up."
      : status === "RUNNING"
        ? "PatchPilot is analyzing the changed lines. The summary and findings will appear here when it finishes."
        : status === "FAILED"
          ? review?.errorMessage ?? "The review failed before producing a summary."
          : "The review completed without a written summary.");

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Review summary</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Automated assessment of the changed lines
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {highestSeverity ? (
            <SeverityBadge severity={highestSeverity} />
          ) : (
            <Badge variant="success" className="font-normal">No issues</Badge>
          )}
          <ReviewStatusBadge status={status} />
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-foreground/90">{summary}</p>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-foreground">{total}</span>
        <span className="text-sm text-muted-foreground">
          finding{total === 1 ? "" : "s"} across the changed files
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SEVERITY_TILES.map((tile) => (
          <div key={tile.key} className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">{tile.label}</span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                {tile.key}
              </span>
            </div>
            <p className={`mt-1.5 text-xl font-semibold tabular-nums ${tile.tone}`}>
              {counts?.[tile.key] ?? 0}
            </p>
          </div>
        ))}
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-3 text-xs">
        <div>
          <dt className="text-muted-foreground">Duration</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {duration ??
              (status === "RUNNING" || status === "QUEUED" ? "In progress" : "—")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Commit</dt>
          <dd className="mt-0.5 font-mono font-medium text-foreground">{shortSha(review?.headSha)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Branches</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {sourceBranch ?? "unknown"} → {targetBranch ?? "main"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Reviewed</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {review?.completedAt ? formatDateTime(review.completedAt) : formatRelativeTime(review?.createdAt)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Repository</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {repository?.owner}/{repository?.name}
            {pullRequest?.number ? ` · #${pullRequest.number}` : ""}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Automated review — not a guarantee that the code is bug-free or secure.
      </p>
    </Card>
  );
}