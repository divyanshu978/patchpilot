"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  className,
  id,
}) {
  const selectId = id ?? `filter-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className={cn("relative", className)}>
      <select
        id={selectId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="h-9 w-full appearance-none rounded-lg border border-input bg-card pl-3 pr-8 text-sm text-foreground shadow-[0_1px_2px_rgba(16,12,40,0.03)] transition-colors hover:border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
}
