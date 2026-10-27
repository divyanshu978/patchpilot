"use client";

import { useMemo, useState } from "react";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/common/search-input";
import { FilterSelect } from "@/components/common/filter-select";
import { EmptyState } from "@/components/common/empty-state";
import { PullRequestTable } from "./pull-request-table";
import { filterPullRequests } from "@/lib/filters";
import { useDebouncedValue } from "@/lib/hooks";

const PAGE_SIZE = 8;

const STATE_OPTIONS = [
  { value: "all", label: "All states" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

const REVIEW_OPTIONS = [
  { value: "all", label: "All review states" },
  { value: "QUEUED", label: "Queued" },
  { value: "RUNNING", label: "Running" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
  { value: "NONE", label: "Not reviewed" },
];

const SEVERITY_OPTIONS = [
  { value: "all", label: "All severities" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

export function PullRequestsPanel({
  pullRequests,
  onReview,
  pendingKey,
  emptyTitle = "No pull requests yet",
  emptyDescription = "Open a pull request on GitHub to review it with PatchPilot.",
  emptyAction,
}) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState("all");
  const [reviewStatus, setReviewStatus] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const debouncedQuery = useDebouncedValue(query, 180);

  const filtered = useMemo(
    () =>
      filterPullRequests(pullRequests, {
        query: debouncedQuery,
        state,
        reviewStatus,
        severity,
      }),
    [pullRequests, debouncedQuery, state, reviewStatus, severity],
  );

  if (!pullRequests?.length) {
    return (
      <EmptyState
        icon={SearchX}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  const visibleRows = filtered.slice(0, visible);
  const hasFilters =
    Boolean(query) || state !== "all" || reviewStatus !== "all" || severity !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search pull requests…"
          label="Search pull requests"
          className="lg:max-w-xs"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:ml-auto">
          <FilterSelect label="Pull request state" value={state} onChange={setState} options={STATE_OPTIONS} />
          <FilterSelect
            label="Review status"
            value={reviewStatus}
            onChange={setReviewStatus}
            options={REVIEW_OPTIONS}
          />
          <FilterSelect
            label="Severity"
            value={severity}
            onChange={setSeverity}
            options={SEVERITY_OPTIONS}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Showing {visibleRows.length} of {filtered.length} pull request{filtered.length === 1 ? "" : "s"}
        </p>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              setState("all");
              setReviewStatus("all");
              setSeverity("all");
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      <PullRequestTable
        pullRequests={visibleRows}
        onReview={onReview}
        pendingKey={pendingKey}
        emptyAction={
          hasFilters ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setQuery("");
                setState("all");
                setReviewStatus("all");
                setSeverity("all");
              }}
            >
              Clear filters
            </Button>
          ) : null
        }
      />

      {filtered.length > visible ? (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
            Load more pull requests
          </Button>
        </div>
      ) : null}
    </div>
  );
}