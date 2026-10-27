"use client";
import { Github } from "@/components/icons/github";
import { Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, GitBranch, GitPullRequest, Lock, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { PullRequestsPanel } from "@/components/pull-requests/pull-requests-panel";
import { useAsyncData } from "@/lib/hooks";
import { useCreateReview } from "@/lib/use-create-review";
import { getRepositoryDetail } from "@/lib/services/enrich";
import { firstParam, formatNumber, formatRelativeTime, safeArray, safeObject } from "@/lib/utils";

function RepositoryPullsContent() {
  const params = useParams();
  const owner = firstParam(params?.owner);
  const repo = firstParam(params?.repo);
  const { createReview, pendingKey } = useCreateReview();

  const { data, error, loading, refetch } = useAsyncData(
    () => getRepositoryDetail(owner, repo),
    `repository-${owner}/${repo}`,
    { enabled: Boolean(owner && repo) },
  );

  const result = safeObject(data);
  const repository = safeObject(result.repository);
  const pullRequests = safeArray(result.pullRequests);
  const reviews = safeArray(result.reviewsForRepo);

  const openCount = pullRequests.filter((pr) => pr.state === "open").length;
  const criticalCount = pullRequests.reduce(
    (total, pr) => total + (pr.severityCounts?.CRITICAL ?? 0),
    0,
  );
  const highCount = pullRequests.reduce((total, pr) => total + (pr.severityCounts?.HIGH ?? 0), 0);
  const latestReview = reviews[0] ?? null;

  const handleReview = (pr) => {
    if (!pr) return;
    createReview({ owner: repository.owner ?? owner, repo: repository.name ?? repo, number: pr.number });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-7 w-12" />
            </Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    if (error.status === 404) {
      return (
        <EmptyState
          icon={GitBranch}
          title="Repository not found"
          description={`${owner}/${repo} is not available in this GitHub App installation.`}
          action={
            <Button variant="secondary" asChild>
              <Link href="/repositories">
                <ArrowLeft className="size-4" />
                Back to repositories
              </Link>
            </Button>
          }
        />
      );
    }

    return (
      <ErrorState
        title="Could not load this repository"
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  if (result.connected === false) {
    return (
      <EmptyState
        icon={Github}
        title="GitHub is not connected"
        description={result.error ?? "Connect the PatchPilot GitHub App to browse this repository."}
        action={
          <Button asChild>
            <Link href="/github">Connect GitHub</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Repository"
        title={`${repository.owner ?? owner}/${repository.name ?? repo}`}
        description={repository.description ?? "Pull requests and review activity for this repository."}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/repositories">
                <ArrowLeft className="size-4" />
                All repositories
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={refetch}
              aria-label="Refresh repository"
              title="Refresh repository"
            >
              <RefreshCw className="size-4" />
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {repository.private ? (
          <Badge variant="neutral" className="gap-1 font-normal">
            <Lock className="size-3" />
            Private
          </Badge>
        ) : (
          <Badge variant="outline" className="font-normal">Public</Badge>
        )}
        <Badge variant="neutral" className="gap-1 font-normal">
          <GitBranch className="size-3" />
          {repository.defaultBranch ?? "main"}
        </Badge>
        {latestReview ? (
          <span className="text-xs text-muted-foreground">
            Last analyzed {formatRelativeTime(latestReview.createdAt)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No reviews yet</span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="Pull requests" value={formatNumber(pullRequests.length)} icon={GitPullRequest} />
        <SummaryTile label="Open" value={formatNumber(openCount)} />
        <SummaryTile
          label="Critical findings"
          value={formatNumber(criticalCount)}
          tone={criticalCount > 0 ? "danger" : "default"}
        />
        <SummaryTile
          label="High findings"
          value={formatNumber(highCount)}
          tone={highCount > 0 ? "warning" : "default"}
        />
      </div>

      <PullRequestsPanel
        pullRequests={pullRequests}
        onReview={handleReview}
        pendingKey={pendingKey}
        emptyTitle="No pull requests in this repository"
        emptyDescription="When someone opens a pull request, it will appear here for review."
        emptyAction={
          <Button variant="secondary" size="sm" onClick={refetch}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        }
      />
    </div>
  );
}

function SummaryTile({ label, value, icon: Icon, tone = "default" }) {
  const valueClass =
    tone === "danger"
      ? "text-red-600 dark:text-red-400"
      : tone === "warning"
        ? "text-orange-600 dark:text-orange-400"
        : "text-foreground";

  return (
    <Card className="flex items-center justify-between p-5">
      <div>
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
      </div>
      {Icon ? (
        <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
      ) : null}
    </Card>
  );
}
function RepositoryPullsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-12" />
          </Card>
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export default function RepositoryPullsPage() {
  return (
    <Suspense fallback={<RepositoryPullsSkeleton />}>
      <RepositoryPullsContent />
    </Suspense>
  );
}