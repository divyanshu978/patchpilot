"use client";

import Link from "next/link";
import { GitBranch, GitPullRequest, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ReviewStatusBadge } from "@/components/reviews/review-status-badge";
import { SeverityBadge } from "@/components/findings/severity-badge";
import { ReviewPrButton } from "./review-pr-button";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { highestSeverityFromCounts } from "@/lib/filters";
import { formatRelativeTime } from "@/lib/utils";

export function PullRequestTable({ pullRequests, onReview, pendingKey, emptyAction }) {
  const rows = pullRequests ?? [];

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No pull requests match these filters"
        description="Try clearing the filters or pick another repository."
        action={emptyAction}
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-5 py-2.5 font-medium">Pull request</th>
              <th scope="col" className="px-5 py-2.5 font-medium">Author</th>
              <th scope="col" className="px-5 py-2.5 font-medium">Branches</th>
              <th scope="col" className="px-5 py-2.5 font-medium">State</th>
              <th scope="col" className="px-5 py-2.5 font-medium">Latest review</th>
              <th scope="col" className="px-5 py-2.5 font-medium">Findings</th>
              <th scope="col" className="px-5 py-2.5 font-medium">Updated</th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((pr) => {
              const key = `${pr.number}`;
              const pending = pendingKey === key;
              const highest = highestSeverityFromCounts(pr.severityCounts);
              return (
                <tr key={key} className="transition-colors hover:bg-muted/30">
                  <td className="max-w-[320px] px-5 py-3">
                    <Link
                      href={
                        pr.latestReview
                          ? `/reviews/${pr.latestReview.id}`
                          : `/reviews?q=${encodeURIComponent(`#${pr.number}`)}`
                      }
                      className="flex items-start gap-2"
                    >
                      <GitPullRequest className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">
                          #{pr.number} {pr.title}
                        </span>
                        {pr.draft ? (
                          <span className="mt-1 inline-block text-[11px] text-muted-foreground">
                            Draft
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                    {pr.author ? `@${pr.author}` : "—"}
                  </td>
                  <td className="max-w-[220px] px-5 py-3">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <GitBranch className="size-3 shrink-0" />
                      <span className="truncate">{pr.sourceBranch ?? "unknown"}</span>
                      <span className="shrink-0 text-muted-foreground/60">→</span>
                      <span className="truncate">{pr.targetBranch ?? "main"}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Badge
                      variant={pr.state === "open" ? "success" : "neutral"}
                      className="font-normal capitalize"
                    >
                      {pr.state ?? "unknown"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    {pr.latestReview ? (
                      <ReviewStatusBadge status={pr.latestReview.status} />
                    ) : (
                      <Badge variant="muted" className="font-normal">Not reviewed</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums text-muted-foreground">{pr.findingsCount ?? 0}</span>
                      {highest ? <SeverityBadge severity={highest} showDot={false} className="px-1.5 py-0 text-[10px]" /> : null}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                    {formatRelativeTime(pr.updatedAt)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <ReviewPrButton
                      onReview={() => onReview(pr)}
                      pending={pending}
                      reviewHref={pr.latestReview ? `/reviews/${pr.latestReview.id}` : null}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border lg:hidden">
        {rows.map((pr) => {
          const pending = pendingKey === `${pr.number}`;
          const highest = highestSeverityFromCounts(pr.severityCounts);
          return (
            <li key={pr.number} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    #{pr.number} {pr.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {pr.author ? `@${pr.author}` : "Unknown author"} · {formatRelativeTime(pr.updatedAt)}
                  </p>
                </div>
                <Badge
                  variant={pr.state === "open" ? "success" : "neutral"}
                  className="shrink-0 font-normal capitalize"
                >
                  {pr.state ?? "unknown"}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <GitBranch className="size-3" />
                  {pr.sourceBranch ?? "unknown"} → {pr.targetBranch ?? "main"}
                </span>
                <span>·</span>
                <span>{pr.findingsCount ?? 0} findings</span>
                {highest ? <SeverityBadge severity={highest} showDot={false} className="px-1.5 py-0 text-[10px]" /> : null}
              </div>

              <div className="flex items-center justify-between gap-2">
                {pr.latestReview ? (
                  <ReviewStatusBadge status={pr.latestReview.status} />
                ) : (
                  <Badge variant="muted" className="font-normal">Not reviewed</Badge>
                )}
                <ReviewPrButton
                  onReview={() => onReview(pr)}
                  pending={pending}
                  reviewHref={pr.latestReview ? `/reviews/${pr.latestReview.id}` : null}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}