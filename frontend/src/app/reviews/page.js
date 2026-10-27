"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/common/page-header";
import { SearchInput } from "@/components/common/search-input";
import { FilterSelect } from "@/components/common/filter-select";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { ReviewTable } from "@/components/reviews/review-table";
import { useAsyncData, useDebouncedValue } from "@/lib/hooks";
import { getReviewListData } from "@/lib/services/enrich";
import { REVIEW_STATUSES, SEVERITIES } from "@/lib/constants";
import { safeArray, safeObject } from "@/lib/utils";

const PAGE_SIZE = 12;

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "QUEUED", label: "Queued" },
  { value: "RUNNING", label: "Running" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
];

const SEVERITY_OPTIONS = [
  { value: "all", label: "All severities" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const SORT_OPTIONS = [
  { value: "latest", label: "Latest first" },
  { value: "oldest", label: "Oldest first" },
];

function ReviewsContent() {
  const searchParams = useSearchParams();
  const { data, error, loading, refetch } = useAsyncData(
    () => getReviewListData({ limit: 100, offset: 0 }),
    "reviews-list",
  );

  const reviews = safeArray(safeObject(data).reviews);

  const initialStatus = (searchParams.get("status") ?? "").toUpperCase();
  const initialSeverity = (searchParams.get("severity") ?? "").toUpperCase();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(REVIEW_STATUSES.includes(initialStatus) ? initialStatus : "all");
  const [severity, setSeverity] = useState(SEVERITIES.includes(initialSeverity) ? initialSeverity : "all");
  const [sort, setSort] = useState("latest");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const debouncedQuery = useDebouncedValue(query, 180);

  const hasFilters =
    Boolean(query) || status !== "all" || severity !== "all" || sort !== "latest";

  const filtered = useMemo(() => {
    const term = debouncedQuery.trim().toLowerCase();
    const list = reviews.filter((review) => {
      if (status !== "all" && review.status !== status) return false;
      if (severity !== "all" && (review.severityCounts?.[severity] ?? 0) === 0) return false;
      if (!term) return true;

      const repository = review.repository ?? {};
      const pullRequest = review.pullRequest ?? {};
      const haystack = [
        repository.owner,
        repository.name,
        pullRequest.number ? `#${pullRequest.number}` : "",
        pullRequest.title,
        review.summary,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });

    return list.sort((a, b) => {
      const aTime = new Date(a.createdAt ?? 0).getTime();
      const bTime = new Date(b.createdAt ?? 0).getTime();
      return sort === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [reviews, status, severity, debouncedQuery, sort]);

  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setSeverity("all");
    setSort("latest");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Reviews"
        description="Every pull request PatchPilot has analyzed, with its findings and summary."
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/pulls">
                <Sparkles className="size-4" />
                Review a pull request
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={refetch} aria-label="Refresh reviews" title="Refresh reviews">
              <RefreshCw className="size-4" />
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-full max-w-xl" />
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load reviews"
          description={error.message}
          onRetry={refetch}
        />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No reviews yet"
          description="Pick a pull request and run your first PatchPilot review. Results will show up here."
          action={
            <Button asChild>
              <Link href="/pulls">Review a pull request</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search repository, PR number or title…"
                label="Search reviews"
                className="lg:max-w-sm"
              />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:ml-auto">
                <FilterSelect label="Review status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
                <FilterSelect label="Severity" value={severity} onChange={setSeverity} options={SEVERITY_OPTIONS} />
                <FilterSelect label="Sort reviews" value={sort} onChange={setSort} options={SORT_OPTIONS} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {filtered.length} review{filtered.length === 1 ? "" : "s"}
                {hasFilters ? " match your filters" : ""}
              </p>
              {hasFilters ? (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          </div>

          <ReviewTable
            reviews={filtered.slice(0, visible)}
            emptyAction={
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />

          {filtered.length > visible ? (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
                Load more reviews
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function ReviewsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <Suspense fallback={<ReviewsSkeleton />}>
      <ReviewsRoute />
    </Suspense>
  );
}

function ReviewsRoute() {
  const searchParams = useSearchParams();
  return <ReviewsContent key={searchParams.toString()} />;
}