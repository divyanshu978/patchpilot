"use client";
import { Github } from "@/components/icons/github";
import Link from "next/link";
import {
  ArrowRight,
  GitBranch,
  GitPullRequest,
  OctagonAlert,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/stat-card";
import { RecentReviewsTable } from "@/components/dashboard/recent-reviews-table";
import { ReviewActivityChart } from "@/components/dashboard/review-activity-chart";
import { RecentFindings } from "@/components/dashboard/recent-findings";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { ErrorState } from "@/components/common/error-state";
import { SeverityBadge } from "@/components/findings/severity-badge";
import { useAsyncData } from "@/lib/hooks";
import { getDashboardData } from "@/lib/services/enrich";
import { formatNumber, formatRelativeTime, safeArray, safeObject } from "@/lib/utils";

const SEVERITY_ROWS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default function OverviewPage() {
  const { data, error, loading, refetch } = useAsyncData(getDashboardData, "overview-dashboard");

  const dashboard = safeObject(data);
  const severityBreakdown = safeObject(dashboard.severityBreakdown);
  const recentReviews = safeArray(dashboard.recentReviews);
  const latestReview = recentReviews[0] ?? null;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card px-5 py-7 shadow-[0_1px_2px_rgba(16,12,40,0.04)] sm:px-8 sm:py-9">
        <div
          className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full bg-primary/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-center">
          <div className="min-w-0">
            <Badge variant="primary" className="mb-3 gap-1.5 font-normal">
              <Sparkles className="size-3" />
              AI code review for GitHub
            </Badge>
            <h1 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-[38px] sm:leading-[1.1]">
              Your code deserves a second look.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              PatchPilot reads your pull requests, finds bugs and security issues, checks for missing
              tests, and suggests fixes before your maintainers spend another evening reviewing.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button size="lg" asChild>
                <Link href="/github">
                  <Github className="size-4" />
                  Connect GitHub
                </Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/repositories">
                  <GitBranch className="size-4" />
                  View Repositories
                </Link>
              </Button>
            </div>
            {!loading && dashboard.connected === false ? (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                {dashboard.connectionError ??
                  "GitHub is not connected yet. Connect an installation to review real pull requests."}
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-border bg-background/80 p-4 shadow-[0_1px_2px_rgba(16,12,40,0.03)] backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Findings snapshot</span>
              <span className="text-[11px] text-muted-foreground">Recent reviews</span>
            </div>
            {loading ? (
              <div className="mt-4 space-y-2.5">
                {SEVERITY_ROWS.map((severity) => (
                  <Skeleton key={severity} className="h-5 w-full" />
                ))}
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {SEVERITY_ROWS.map((severity) => {
                  const count = severityBreakdown[severity] ?? 0;
                  return (
                    <div key={severity} className="flex items-center gap-2">
                      <SeverityBadge severity={severity} className="w-[92px] justify-center" />
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{
                            width: `${Math.min(100, (count / Math.max(1, dashboard.issuesDetected || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="w-6 text-right text-xs font-medium tabular-nums text-foreground">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
              {latestReview ? (
                <>
                  <span className="truncate">
                    Latest: {latestReview.repository.owner}/{latestReview.repository.name} #
                    {latestReview.pullRequest.number}
                  </span>
                  <span className="shrink-0">{formatRelativeTime(latestReview.createdAt)}</span>
                </>
              ) : (
                <span>No reviews yet</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <ErrorState
          title="Could not load the dashboard"
          description={error.message}
          onRetry={refetch}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <LoadingSkeleton count={4} className="sm:col-span-2 xl:col-span-4" />
        ) : (
          <>
            <StatCard
              label="Connected Repositories"
              value={formatNumber(dashboard.repositoryCount)}
              hint={dashboard.connected ? "Available through your GitHub App installation" : "Connect GitHub to get started"}
              icon={GitBranch}
              tone="primary"
            />
            <StatCard
              label="Pull Requests Analyzed"
              value={formatNumber(dashboard.pullRequestsAnalyzed)}
              hint={`${formatNumber(dashboard.totalReviews)} reviews run`}
              icon={GitPullRequest}
            />
            <StatCard
              label="Issues Detected"
              value={formatNumber(dashboard.issuesDetected)}
              hint="Across the latest loaded reviews"
              icon={ShieldAlert}
              tone="success"
            />
            <StatCard
              label="Critical Issues"
              value={formatNumber(dashboard.criticalIssues)}
              hint={dashboard.criticalIssues > 0 ? "Needs attention before merge" : "No critical findings in recent reviews"}
              icon={OctagonAlert}
              tone="danger"
            />
          </>
        )}
      </div>

      {!loading && !error ? (
        <>
          <div className="grid gap-5 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <RecentReviewsTable reviews={recentReviews} />
            </div>
            <ReviewActivityChart data={dashboard.trend} />
          </div>

          <RecentFindings findings={dashboard.recentFindings} />

          {dashboard.connected === false ? (
            <Card className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-medium text-foreground">Bring your own repositories</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Install the PatchPilot GitHub App to review real pull requests in this workspace.
                </p>
              </div>
              <Button asChild variant="secondary">
                <Link href="/github">
                  Connect GitHub
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}