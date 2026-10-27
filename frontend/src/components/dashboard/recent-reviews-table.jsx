"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Inbox } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReviewStatusBadge } from "@/components/reviews/review-status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { formatRelativeTime } from "@/lib/utils";

export function RecentReviewsTable({ reviews }) {
  const router = useRouter();
  const rows = reviews ?? [];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Recent reviews</CardTitle>
          <CardDescription>Latest pull request analyses across your repositories.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild className="shrink-0">
          <Link href="/reviews">
            View all
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>

      {rows.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState
            compact
            icon={Inbox}
            title="No reviews yet"
            description="Run a review on a pull request to see the results here."
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href="/pulls">Browse pull requests</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-5 py-2.5 font-medium">Repository</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Pull request</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Issues</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Last updated</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((review) => (
                  <tr
                    key={review.id}
                    className="cursor-pointer transition-colors hover:bg-muted/40"
                    onClick={(event) => {
                      if (event.target.closest("a")) return;
                      router.push(`/reviews/${review.id}`);
                    }}
                  >
                    <td className="px-5 py-3">
                      <span className="font-medium text-foreground">
                        {review.repository.owner}/{review.repository.name}
                      </span>
                    </td>
                    <td className="max-w-[320px] px-5 py-3">
                      <Link
                        href={`/reviews/${review.id}`}
                        className="block truncate font-medium text-foreground transition-colors hover:text-primary"
                      >
                        #{review.pullRequest.number} {review.pullRequest.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <ReviewStatusBadge status={review.status} />
                    </td>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">
                      {review.findingCount ?? 0}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                      {formatRelativeTime(review.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/reviews/${review.id}`}
                        aria-label={`View review for pull request ${review.pullRequest.number}`}
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <ArrowRight className="size-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-border md:hidden">
            {rows.map((review) => (
              <li key={review.id}>
                <Link href={`/reviews/${review.id}`} className="block px-5 py-4 transition-colors hover:bg-muted/40">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {review.repository.owner}/{review.repository.name}
                    </span>
                    <ReviewStatusBadge status={review.status} />
                  </div>
                  <p className="truncate text-sm font-medium text-foreground">
                    #{review.pullRequest.number} {review.pullRequest.title}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{review.findingCount ?? 0} issues</span>
                    <span>·</span>
                    <span>{formatRelativeTime(review.createdAt)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}