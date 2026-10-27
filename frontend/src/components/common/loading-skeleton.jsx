import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function LoadingSkeleton({ variant = "cards", count = 3, className }) {
  if (variant === "table") {
    return (
      <div className={cn("space-y-2", className)} aria-busy="true" aria-label="Loading">
        <div className="h-9 w-full rounded-lg bg-muted" />
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="h-14 w-full rounded-lg bg-muted/70" />
        ))}
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className={cn("space-y-2", className)} aria-busy="true" aria-label="Loading">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="h-20 w-full rounded-lg bg-muted/70" />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}
