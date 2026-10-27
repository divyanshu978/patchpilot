"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, GitBranch, GitFork, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatNumber, formatRelativeTime } from "@/lib/utils";

export function RepositoryCard({ repository }) {
  const router = useRouter();
  const href = `/repositories/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`;
  const critical = repository.openCritical ?? 0;
  const high = repository.openHigh ?? 0;

  return (
    <Card
      className="group flex cursor-pointer flex-col p-5 transition-shadow hover:shadow-[0_6px_24px_rgba(16,12,40,0.08)]"
      onClick={(event) => {
        if (event.target.closest("a,button")) return;
        router.push(href);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted font-mono text-xs font-semibold uppercase text-foreground">
            {repository.name?.slice(0, 2) ?? "??"}
          </span>
          <div className="min-w-0">
            <Link
              href={href}
              className="block truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary"
            >
              <span className="font-normal text-muted-foreground">{repository.owner}/</span>
              {repository.name}
            </Link>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <GitBranch className="size-3" />
              {repository.defaultBranch ?? "main"}
              <span>·</span>
              {repository.private ? "Private" : "Public"}
            </p>
          </div>
        </div>
        {repository.private ? (
          <Badge variant="neutral" className="gap-1 font-normal">
            <Lock className="size-3" />
            Private
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 font-normal">
            <GitFork className="size-3" />
            Public
          </Badge>
        )}
      </div>

      {repository.description ? (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
          {repository.description}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No description</p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border bg-muted/30 px-3.5 py-3">
        <div>
          <dt className="text-[11px] text-muted-foreground">Last analyzed</dt>
          <dd className="mt-0.5 text-xs font-medium text-foreground">
            {repository.lastAnalyzedAt ? formatRelativeTime(repository.lastAnalyzedAt) : "Not yet"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">Reviews</dt>
          <dd className="mt-0.5 text-xs font-medium tabular-nums text-foreground">
            {formatNumber(repository.totalReviews)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">Critical</dt>
          <dd
            className={cn(
              "mt-0.5 text-xs font-medium tabular-nums",
              critical > 0 ? "text-red-600 dark:text-red-400" : "text-foreground",
            )}
          >
            {formatNumber(critical)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">High</dt>
          <dd
            className={cn(
              "mt-0.5 text-xs font-medium tabular-nums",
              high > 0 ? "text-orange-600 dark:text-orange-400" : "text-foreground",
            )}
          >
            {formatNumber(high)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          {critical + high > 0
            ? `${critical + high} critical/high in latest review`
            : "No critical findings in the latest review"}
        </span>
        <Button variant="secondary" size="sm" asChild>
          <Link href={`${href}`}>
            View Pull Requests
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}