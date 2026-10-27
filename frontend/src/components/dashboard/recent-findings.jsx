"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/findings/severity-badge";
import { EmptyState } from "@/components/common/empty-state";

export function RecentFindings({ findings }) {
  const rows = findings ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Recent findings</CardTitle>
          <CardDescription>Issues surfaced in the latest completed reviews.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild className="shrink-0">
          <Link href="/reviews">
            All reviews
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>

      {rows.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState
            compact
            icon={ShieldCheck}
            title="No findings to show"
            description="Completed reviews will surface their most important findings here."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {rows.map((finding) => {
            const href = `/reviews/${finding.reviewId}?finding=${encodeURIComponent(finding.id)}`;
            return (
              <li
                key={finding.id}
                className="flex flex-col gap-2 px-5 py-3.5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-start sm:gap-4"
              >
                <div className="flex items-center gap-2 sm:w-28 sm:shrink-0 sm:flex-col sm:items-start">
                  <SeverityBadge severity={finding.severity} />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={href}
                    className="text-sm font-medium text-foreground transition-colors hover:text-primary"
                  >
                    {finding.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {finding.repository?.owner}/{finding.repository?.name}
                    <span className="mx-1.5">·</span>#{finding.pullRequest?.number}{" "}
                    {finding.pullRequest?.title}
                  </p>
                  {finding.filePath ? (
                    <code className="mt-1.5 inline-block max-w-full truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {finding.filePath}
                      {finding.startLine ? `:${finding.startLine}` : ""}
                    </code>
                  ) : null}
                </div>
                <Button variant="ghost" size="sm" asChild className="self-start text-muted-foreground">
                  <Link href={href} aria-label={`View details for ${finding.title}`}>
                    View details
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}