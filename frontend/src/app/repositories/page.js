"use client";
import { Github } from "@/components/icons/github";
import { useMemo, useState } from "react";
import Link from "next/link";
import { GitBranch, RefreshCw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { SearchInput } from "@/components/common/search-input";
import { FilterSelect } from "@/components/common/filter-select";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { RepositoryCard } from "@/components/repositories/repository-card";
import { useAsyncData, useDebouncedValue } from "@/lib/hooks";
import { getRepositoryCards } from "@/lib/services/enrich";
import { safeArray, safeObject } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "recent", label: "Recent activity" },
  { value: "name", label: "Name Aâ€“Z" },
  { value: "name-desc", label: "Name Zâ€“A" },
  { value: "reviews", label: "Most reviews" },
];

function sortRepositories(repositories, sort) {
  const list = [...repositories];
  switch (sort) {
    case "name":
      return list.sort((a, b) => a.fullName.localeCompare(b.fullName));
    case "name-desc":
      return list.sort((a, b) => b.fullName.localeCompare(a.fullName));
    case "reviews":
      return list.sort((a, b) => (b.totalReviews ?? 0) - (a.totalReviews ?? 0));
    case "recent":
    default:
      return list.sort((a, b) => {
        const aTime = a.lastAnalyzedAt ? new Date(a.lastAnalyzedAt).getTime() : 0;
        const bTime = b.lastAnalyzedAt ? new Date(b.lastAnalyzedAt).getTime() : 0;
        return bTime - aTime;
      });
  }
}

export default function RepositoriesPage() {
  const { data, error, loading, refetch } = useAsyncData(getRepositoryCards, "repositories");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const debouncedQuery = useDebouncedValue(query, 180);

  const result = safeObject(data);
  const repositories = safeArray(result.repositories);

  const filtered = useMemo(() => {
    const term = debouncedQuery.trim().toLowerCase();
    const matching = term
      ? repositories.filter(
          (repository) =>
            repository.fullName?.toLowerCase().includes(term) ||
            repository.description?.toLowerCase().includes(term),
        )
      : repositories;
    return sortRepositories(matching, sort);
  }, [repositories, debouncedQuery, sort]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Repositories"
        description="Repositories available to the PatchPilot GitHub App. Open one to review its pull requests."
        actions={
          <>
            <Button variant="secondary" size="md" asChild>
              <Link href="/github">
                <Github className="size-4" />
                Connect GitHub
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={refetch}
              aria-label="Refresh repositories"
              title="Refresh repositories"
            >
              <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="mt-4 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-2/3" />
              <Skeleton className="mt-4 h-20 w-full" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load repositories"
          description={error.message}
          onRetry={refetch}
        />
      ) : result.connected === false ? (
        <EmptyState
          icon={Github}
          title="Connect GitHub to get started"
          description={
            result.error ??
            "Install the PatchPilot GitHub App to list repositories and start reviewing pull requests."
          }
          action={
            <Button asChild>
              <Link href="/github">
                <Github className="size-4" />
                Connect GitHub
              </Link>
            </Button>
          }
        />
      ) : repositories.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No repositories found"
          description="The GitHub App installation does not have access to any repositories yet."
          action={
            <Button asChild variant="secondary">
              <Link href="/github">Manage installation</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search repositoriesâ€¦"
              label="Search repositories"
              className="sm:max-w-xs"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {filtered.length} of {repositories.length}
              </span>
              <FilterSelect
                label="Sort repositories"
                value={sort}
                onChange={setSort}
                options={SORT_OPTIONS}
                className="w-44"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No matching repositories"
              description={`No repository matches â€œ${debouncedQuery}â€. Try a different search.`}
              action={
                <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((repository) => (
                <RepositoryCard key={repository.id ?? repository.fullName} repository={repository} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}