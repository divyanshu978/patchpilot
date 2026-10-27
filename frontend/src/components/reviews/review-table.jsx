"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ReviewStatusBadge } from "@/components/reviews/review-status-badge";
import { SeverityBadge } from "@/components/findings/severity-badge";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";

function reviewSeverity(review) {
  const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
  return order.find((severity) => (review.severityCounts?.[severity] ?? 0) > 0) ?? null;
}

function summaryText(review) {
  if (review.summary) return review.summary;
  if (review.status === "FAILED") return review.errorMessage ?? "The review failed before producing a summary.";
  if (review.status === "RUNNING") return "PatchPilot is analyzing the changed lines…";
  if (review.status === "QUEUED") return "Waiting for an available review worker…";
  return "No summary available.";
}

export function ReviewTable({ reviews, emptyAction }) {
  const rows = reviews ?? [];
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No reviews match these filters"
        description="Try a different search or clear the filters to see all reviews."
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
              <th scope="col" className="px-5 py-2.5 font-medium">Repository</th>
              <th scope="col" className="px-5 py-2.5 font-medium">Pull request</th>
              <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-5 py-2.5 font-medium">Summary</th>
              <th scope="col" className="px-5 py-2.5 font-medium">Findings</th>
              <th scope="col" className="px-5 py-2.5 font-medium">Created</th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((review) => {
              const severity = reviewSeverity(review);
              return (
                <tr
                  key={review.id}
                  className="cursor-pointer transition-colors hover:bg-muted/30"
                  onClick={(event) => {
                    if (event.target.closest("a")) return;
                    router.push(`/reviews/${review.id}`);
                  }}
                >
                  <td className="whitespace-nowrap px-5 py-3">
                    <span className="font-medium text-foreground">
                      {review.repository.owner}/{review.repository.name}
                    </span>
                  </td>
                  <td className="max-w-[300px] px-5 py-3">
                    <Link
                      href={`/reviews/${review.id}`}
                      className="block truncate font-medium text-foreground transition-colors hover:text-primary"
                    >
                      #{review.pullRequest.number} {review.pullRequest.title}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <ReviewStatusBadge status={review.status} />
                  </td>
                  <td className="max-w-[360px] px-5 py-3">
                    <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {summaryText(review)}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums text-foreground">{review.findingCount ?? 0}</span>
                      {severity ? (
                        <SeverityBadge
                          severity={severity}
                          showDot={false}
                          className="px-1.5 py-0 text-[10px]"
                        />
                      ) : null}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                    {formatRelativeTime(review.createdAt)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/reviews/${review.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      View review
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border lg:hidden">
        {rows.map((review) => {
          const severity = reviewSeverity(review);
          return (
            <li key={review.id}>
              <Link href={`/reviews/${review.id}`} className="block space-y-2.5 p-4 transition-colors hover:bg-muted/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">
                      {review.repository.owner}/{review.repository.name}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                      #{review.pullRequest.number} {review.pullRequest.title}
                    </p>
                  </div>
                  <ReviewStatusBadge status={review.status} />
                </div>
                <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {summaryText(review)}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{review.findingCount ?? 0} findings</span>
                  {severity ? <SeverityBadge severity={severity} showDot={false} className="px-1.5 py-0 text-[10px]" /> : null}
                  <span>·</span>
                  <span>{formatRelativeTime(review.createdAt)}</span>
                  <span className="ml-auto font-medium text-primary">View review →</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}