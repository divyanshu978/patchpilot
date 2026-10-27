"use client";
import { Github } from "@/components/icons/github";
import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Clock3,
  Loader2,
  RefreshCw,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { ReviewSummary } from "@/components/reviews/review-summary";
import { ReviewStatusBadge } from "@/components/reviews/review-status-badge";
import { FindingsPanel } from "@/components/findings/findings-panel";
import { useToast } from "@/components/providers/toast-provider";
import { useAsyncData, usePolling } from "@/lib/hooks";
import { useCreateReview } from "@/lib/use-create-review";
import { getReviewBundle } from "@/lib/services/enrich";
import { reviewService } from "@/lib/services/review.service";
import {
  safeArray,
  safeObject,
  formatRelativeTime,
  shortSha,
  firstParam,
  isValidId,
} from "@/lib/utils";

function ReviewDetail() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { createReview, pendingKey } = useCreateReview();

  const reviewId = firstParam(params?.id);
  const requestedFinding = searchParams.get("finding");

  const { data, error, loading, refetch } = useAsyncData(
    () => getReviewBundle(reviewId),
    `review-${reviewId}`,
    { enabled: isValidId(reviewId) },
  );

  const [liveStatus, setLiveStatus] = useState(null);
  const [selectedFindingId, setSelectedFindingId] = useState(requestedFinding ?? null);
  const [publishing, setPublishing] = useState(false);
  const review = safeObject(data?.review);
  const status = safeObject(data?.status);
  const findings = safeArray(data?.findings);
  const counts = safeObject(data?.counts);
  const pullRequestDetail = safeObject(data?.pullRequestDetail);
  const pullRequest = safeObject(review.pullRequest);
  const repository = safeObject(pullRequest.repository);

  const currentStatus = liveStatus?.status ?? status.status ?? review.status ?? null;
  const totalFindings = findings.length;
  const sourceBranch = pullRequestDetail?.head?.ref ?? pullRequest.sourceBranch ?? null;
  const targetBranch = pullRequestDetail?.base?.ref ?? pullRequest.targetBranch ?? null;
  const canRun = Boolean(repository.owner && repository.name && pullRequest.number);
  const runPending = pendingKey === String(pullRequest.number);
  const isActive = Boolean(review.status) && (currentStatus === "QUEUED" || currentStatus === "RUNNING");
  const published = Boolean(review?.publishing?.publishedAt);

  const poll = useCallback(async () => {
    try {
      const next = await reviewService.getStatus(reviewId);
      if (!next) return;
      setLiveStatus(next);
      if (next.status === "COMPLETED" || next.status === "FAILED") {
        await refetch();
      }
    } catch {
      // Transient polling failures are ignored; the next tick retries.
    }
  }, [reviewId, refetch]);

  const { gaveUp } = usePolling(poll, {
    enabled: isValidId(reviewId) && isActive,
    intervalMs: 2500,
    maxAttempts: 30,
  });

  const handleRun = () => {
    if (!canRun) return;
    createReview({
      owner: repository.owner,
      repo: repository.name,
      number: pullRequest.number,
    });
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const result = await reviewService.publishReview(reviewId);
      if (result?.published) {
        toast({
          variant: "success",
          title: "Summary published",
          description: "PatchPilot posted the review summary to GitHub.",
        });
      } else {
        toast({
          variant: "error",
          title: "Could not publish the summary",
          description: result?.error ?? "The backend did not accept the publish request.",
        });
      }
      await refetch();
    } catch (publishError) {
      toast({
        variant: "error",
        title: "Could not publish the summary",
        description: publishError.message,
      });
    } finally {
      setPublishing(false);
    }
  };

  if (!isValidId(reviewId)) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Invalid review id"
        description="This review link is missing a valid identifier."
        action={
          <Button variant="secondary" asChild>
            <Link href="/reviews">Back to reviews</Link>
          </Button>
        }
      />
    );
  }

  if (loading) {
    return <ReviewSkeleton />;
  }

  if (error) {
    if (error.status === 404) {
      return (
        <EmptyState
          icon={Sparkles}
          title="Review not found"
          description="This review may have been removed, or the link belongs to another workspace."
          action={
            <Button variant="secondary" asChild>
              <Link href="/reviews">Back to reviews</Link>
            </Button>
          }
        />
      );
    }

    return (
      <ErrorState
        title="Could not load this review"
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  const title = pullRequest.number
    ? `#${pullRequest.number} ${pullRequest.title ?? ""}`.trim()
    : "Review details";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Review"
        title={title}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/repositories/${encodeURIComponent(repository.owner ?? "")}/${encodeURIComponent(repository.name ?? "")}`}
              className="font-medium text-foreground hover:text-primary"
            >
              {repository.owner}/{repository.name}
            </Link>
            <span>Â·</span>
            <span>
              {sourceBranch ?? "unknown"} â†’ {targetBranch ?? "main"}
            </span>
            <span>Â·</span>
            <span className="font-mono text-xs">{shortSha(review.headSha)}</span>
            <span>Â·</span>
            <ReviewStatusBadge status={currentStatus ?? "QUEUED"} />
          </span>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/reviews">
                <ArrowLeft className="size-3.5" />
                All reviews
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={refetch}
              aria-label="Refresh review"
              title="Refresh review"
            >
              <RefreshCw className="size-4" />
            </Button>
            {currentStatus === "COMPLETED" ? (
              <Button variant="secondary" onClick={handlePublish} disabled={publishing || published}>
                {publishing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : published ? (
                  <Check className="size-4" />
                ) : (
                  <Github className="size-4" />
                )}
                {published ? "Published" : publishing ? "Publishingâ€¦" : "Publish to GitHub"}
              </Button>
            ) : null}
            <Button onClick={handleRun} disabled={!canRun || runPending || isActive}>
              {runPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCw className="size-4" />
              )}
              {isActive
                ? "Review in progress"
                : currentStatus === "COMPLETED" || currentStatus === "FAILED"
                  ? "Re-run review"
                  : "Run review"}
            </Button>
          </>
        }
      />

      {review?.publishing?.error ? (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3.5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Summary not published.</span>{" "}
            {review.publishing.error}
          </p>
          <Button variant="secondary" size="sm" onClick={handlePublish} disabled={publishing}>
            Retry publish
          </Button>
        </div>
      ) : null}

      {published ? (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <Check className="size-3.5" />
          Summary published to GitHub {formatRelativeTime(review.publishing.publishedAt)}
        </p>
      ) : null}

      {currentStatus === "QUEUED" || currentStatus === "RUNNING" ? (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Loader2 className="size-4 animate-spin" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {currentStatus === "QUEUED" ? "Review queued" : "Review in progress"}
                </p>
                <ReviewStatusBadge status={currentStatus} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                PatchPilot is fetching the diff, running static analysis and checking the changed
                lines. This page refreshes automatically.
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock3 className="size-3.5" />
                  Started {formatRelativeTime(review.createdAt)}
                </span>
                <span>{gaveUp ? "Automatic refresh paused" : "Checking every 2.5 seconds"}</span>
              </div>
              {gaveUp ? (
                <div className="mt-3 flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={refetch}>
                    <RefreshCw className="size-3.5" />
                    Refresh now
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    The review is taking longer than usual.
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {currentStatus === "FAILED" ? (
        <ErrorState
          title="Review failed"
          description={review.errorMessage ?? "PatchPilot could not complete this review."}
          onRetry={canRun ? handleRun : undefined}
          retryLabel="Re-run review"
        />
      ) : null}

      {currentStatus !== "FAILED" ? (
        <ReviewSummary
          review={review}
          counts={counts}
          total={totalFindings}
          highestSeverity={data?.highestSeverity ?? null}
          duration={data?.duration ?? null}
          sourceBranch={sourceBranch}
          targetBranch={targetBranch}
          repository={repository}
          pullRequest={pullRequest}
          status={currentStatus ?? "QUEUED"}
        />
      ) : null}

      {totalFindings > 0 ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {currentStatus === "COMPLETED" ? "Findings" : "Findings so far"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {currentStatus === "COMPLETED"
                  ? "Select a finding to inspect its evidence and suggested fix."
                  : "Partial results while the review is still running."}
              </p>
            </div>
            <Badge variant="neutral" className="font-normal">
              {totalFindings} finding{totalFindings === 1 ? "" : "s"}
            </Badge>
          </div>
          <FindingsPanel
            findings={findings}
            selectedId={selectedFindingId}
            onSelect={setSelectedFindingId}
            repository={repository}
            pullRequest={pullRequest}
            reviewId={review.id}
          />
        </section>
      ) : currentStatus === "COMPLETED" ? (
        <EmptyState
          icon={Check}
          title="No issues detected"
          description="PatchPilot did not find bugs, security issues or missing tests in the changed lines. This is not a guarantee that the code is free of defects."
        />
      ) : null}
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-80 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function ReviewDetailPage() {
  return (
    <Suspense fallback={<ReviewSkeleton />}>
      <ReviewDetail />
    </Suspense>
  );
}