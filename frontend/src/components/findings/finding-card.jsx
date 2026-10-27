"use client";

import { CategoryBadge, SeverityBadge } from "./severity-badge";
import { cn, formatLocation } from "@/lib/utils";

export function FindingCard({ finding, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(finding.id)}
      aria-pressed={selected}
      className={cn(
        "w-full rounded-lg border p-3.5 text-left transition-colors",
        selected
          ? "border-primary bg-primary-soft/70 shadow-[0_0_0_1px_var(--primary)]"
          : "border-border bg-card hover:bg-muted/50",
      )}
    >
      <div className="flex items-start gap-2.5">
        <SeverityBadge severity={finding.severity} className="mt-0.5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium leading-5 text-foreground">{finding.title}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <CategoryBadge category={finding.category} className="px-1.5 py-0 text-[10px]" />
            <code className="max-w-full truncate font-mono">{formatLocation(finding.filePath, finding.startLine)}</code>
          </span>
        </span>
      </div>
    </button>
  );
}