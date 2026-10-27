"use client";
import { Github } from "@/components/icons/github";
import { useMemo, useState } from "react";
import Link from "next/link";
import { GitPullRequest, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/common/page-header";
import { FilterSelect } from "@/components/common/filter-select";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { PullRequestsPanel } from "@/components/pull-requests/pull-requests-panel";
import { useAsyncData } from "@/lib/hooks";
import { useCreateReview } from "@/lib/use-create-review";
import { getRepositoryDetail, getRepositoryOptions } from "@/lib/services/enrich";
import { safeArray, safeObject } from "@/lib/utils";

export default function PullsPage() {
  const { createReview, pendingKey } = useCreateReview();
  const [selection, setSelection] = useState("");

  const {
    data: optionsData,
    error: optionsError,
    loading: optionsLoading,
    refetch: refetchOptions,
  } = useAsyncData(getRepositoryOptions, "pulls-repositories");

  const result = safeObject(optionsData);
  const repositories = safeArray(result.repositories);

  const options = useMemo(
    () =>
      repositories.map((repository) => ({
        value: `${repository.owner}/${repository.name}`,
        label: `${repository.owner}/${repository.name}`,
      })),
    [repositories],
  );

  const defaultSelection = options[0]?.value ?? "";
  const selected = options.some((option) => option.value === selection)
    ? selection
    : defaultSelection;

  const selectedRepository =
    repositories.find((repository) => `${repository.owner}/${repository.name}` === selected) ?? null;

  const {
    data: detailData,
    error: detailError,
    loading: detailLoading,
    refetch: refetchDetail,
  } = useAsyncData(
    () =>
      selectedRepository
        ? getRepositoryDetail(selectedRepository.owner, selectedRepository.name)
        : null,
    `pulls-detail-${selected}`,
    { enabled: Boolean(selectedRepository) },
  );

  const detail = safeObject(detailData);
  const pullRequests = safeArray(detail.pullRequests);
  const repository = safeObject(detail.repository);

  const refreshAll = () => {
    refetchOptions();
    if (selectedRepository) refetchDetail();
  };

  const handleReview = (pr) => {
    if (!selectedRepository || !pr) return;
    createReview({
      owner: selectedRepository.owner,
      repo: selectedRepository.name,
      number: pr.number,
    });
  };

  if (optionsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (optionsError) {
    return (
      <ErrorState
        title="Could not load pull requests"
        description={optionsError.message}
        onRetry={refetchOptions}
      />
    );
  }

  if (result.connected === false) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Reviews"
          title="Pull Requests"
          description="Choose a repository and ask PatchPilot to review a pull request."
        />
        <EmptyState
          icon={Github}
          title="Connect GitHub to review pull requests"
          description={
            result.error ??
            "Install the PatchPilot GitHub App, then return here to browse pull requests."
          }
          action={
            <Button asChild>
              <Link href="/github">Connect GitHub</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reviews"
        title="Pull Requests"
        description="Choose a repository and ask PatchPilot to review a pull request."
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/github">
                <Github className="size-4" />
                Connect GitHub
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={refreshAll} aria-label="Refresh" title="Refresh">
              <RefreshCw className="size-4" />
            </Button>
          </>
        }
      />

      {repositories.length === 0 ? (
        <EmptyState
          icon={GitPullRequest}
          title="No repositories available"
          description="The GitHub App installation does not have access to any repositories yet."
          action={
            <Button asChild variant="secondary">
              <Link href="/github">Manage installation</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Repository</span>
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold text-foreground">
                  {repository.fullName ?? selected}
                </span>
                {repository.private ? (
                  <Badge variant="neutral" className="font-normal">Private</Badge>
                ) : (
                  <Badge variant="outline" className="font-normal">Public</Badge>
                )}
              </div>
              {repository.description ? (
                <p className="line-clamp-1 text-xs text-muted-foreground">{repository.description}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
              <FilterSelect
                label="Select repository"
                value={selected}
                onChange={setSelection}
                options={options}
                className="w-full sm:w-64"
              />
              <Button variant="secondary" asChild>
                <Link href={`/repositories/${encodeURIComponent(selected.split("/")[0])}/${encodeURIComponent(selected.split("/")[1] ?? "")}`}>
                  Open repository
                </Link>
              </Button>
            </div>
          </Card>

          {detailLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : detailError ? (
            <ErrorState
              title="Could not load this repository"
              description={detailError.message}
              onRetry={refetchDetail}
            />
          ) : (
            <PullRequestsPanel
              pullRequests={pullRequests}
              onReview={handleReview}
              pendingKey={pendingKey}
              emptyTitle="No pull requests in this repository"
              emptyDescription="Open a pull request on GitHub, then refresh this page."
              emptyAction={
                <Button variant="secondary" size="sm" onClick={refetchDetail}>
                  <RefreshCw className="size-3.5" />
                  Refresh
                </Button>
              }
            />
          )}
        </>
      )}
    </div>
  );
}