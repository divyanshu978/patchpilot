"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchX, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/common/search-input";
import { FilterSelect } from "@/components/common/filter-select";
import { EmptyState } from "@/components/common/empty-state";
import { FindingCard } from "./finding-card";
import { FindingDetails } from "./finding-details";
import { useDebouncedValue } from "@/lib/hooks";
import { SEVERITIES } from "@/lib/constants";
import { CATEGORY_LABELS } from "./severity-badge";
import { cn, safeArray, sortBySeverity } from "@/lib/utils";

export function FindingsPanel({ findings, selectedId, onSelect, repository, pullRequest, reviewId }) {
  const list = useMemo(() => sortBySeverity(safeArray(findings)), [findings]);
  const [severity, setSeverity] = useState("all");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 180);

  const counts = useMemo(() => {
    const result = {};
    for (const item of list) {
      const key = String(item.severity ?? "INFO").toUpperCase();
      result[key] = (result[key] ?? 0) + 1;
    }
    return result;
  }, [list]);

  const categories = useMemo(() => {
    const found = new Set(list.map((item) => item.category).filter(Boolean));
    return [
      { value: "all", label: "All categories" },
      ...[...found].map((value) => ({ value, label: CATEGORY_LABELS[value] ?? value })),
    ];
  }, [list]);

  const filtered = useMemo(() => {
    const term = debouncedQuery.trim().toLowerCase();
    return list.filter((finding) => {
      if (severity !== "all" && String(finding.severity).toUpperCase() !== severity) return false;
      if (category !== "all" && finding.category !== category) return false;
      if (!term) return true;
      return [finding.title, finding.description, finding.filePath]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [list, severity, category, debouncedQuery]);

  useEffect(() => {
    if (filtered.length === 0) {
      if (selectedId !== null) onSelect(null);
      return;
    }
    if (!filtered.some((finding) => finding.id === selectedId)) {
      onSelect(filtered[0].id);
    }
  }, [filtered, selectedId, onSelect]);

  const selected = list.find((finding) => finding.id === selectedId) ?? null;

  const handleSelect = (id) => {
    onSelect(id);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      window.setTimeout(() => {
        document.getElementById("finding-details")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 60);
    }
  };

  if (list.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No issues detected"
        description="PatchPilot reviewed the changed lines and did not flag any bugs, security problems or missing tests."
      />
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSeverity("all")}
            aria-pressed={severity === "all"}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              severity === "all"
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            All {list.length}
          </button>
          {SEVERITIES.filter((item) => (counts[item] ?? 0) > 0).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSeverity(item)}
              aria-pressed={severity === item}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                severity === item
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {item.charAt(0) + item.slice(1).toLowerCase()} {counts[item]}
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search findings…"
            label="Search findings"
          />
          <FilterSelect
            label="Finding category"
            value={category}
            onChange={setCategory}
            options={categories}
            className="sm:w-44"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            compact
            icon={SearchX}
            title="No findings match these filters"
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSeverity("all");
                  setCategory("all");
                  setQuery("");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <ul className="scrollbar-thin space-y-2 lg:max-h-[68vh] lg:overflow-y-auto lg:pr-1">
            {filtered.map((finding) => (
              <li key={finding.id}>
                <FindingCard
                  finding={finding}
                  selected={finding.id === selectedId}
                  onSelect={handleSelect}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div id="finding-details" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-xl border border-border bg-card p-5">
          <FindingDetails
            finding={selected}
            repository={repository}
            pullRequest={pullRequest}
            reviewId={reviewId}
          />
        </div>
      </div>
    </div>
  );
}