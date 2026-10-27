import { Badge } from "@/components/ui/badge";
import { cn, sentenceCase } from "@/lib/utils";

const SEVERITY_STYLES = {
  CRITICAL: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
  HIGH: "border-orange-500/25 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  MEDIUM: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  LOW: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  INFO: "border-border bg-muted text-muted-foreground",
};

const SEVERITY_DOTS = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-sky-500",
  INFO: "bg-muted-foreground",
};

export function SeverityBadge({ severity, className, showDot = true }) {
  const key = String(severity ?? "INFO").toUpperCase();
  const style = SEVERITY_STYLES[key] ?? SEVERITY_STYLES.INFO;

  return (
    <Badge
      variant="outline"
      className={cn("font-medium", style, className)}
      title={`${sentenceCase(key)} severity`}
    >
      {showDot ? <span className={cn("size-1.5 rounded-full", SEVERITY_DOTS[key])} /> : null}
      {sentenceCase(key)}
    </Badge>
  );
}

export const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

export const CATEGORY_LABELS = {
  SECURITY: "Security",
  BUG: "Bug",
  PERFORMANCE: "Performance",
  TEST: "Testing",
  MAINTAINABILITY: "Maintainability",
  STYLE: "Style",
  DEPENDENCY: "Dependency",
};

export function CategoryBadge({ category, className }) {
  return (
    <Badge variant="neutral" className={cn("font-normal", className)}>
      {CATEGORY_LABELS[category] ?? sentenceCase(category)}
    </Badge>
  );
}
