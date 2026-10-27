import { Badge } from "@/components/ui/badge";
import { cn, sentenceCase } from "@/lib/utils";

const STATUS_STYLES = {
  QUEUED: {
    wrapper: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  RUNNING: {
    wrapper: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    dot: "animate-pulse bg-sky-500",
  },
  COMPLETED: {
    wrapper: "border-success/25 bg-success-soft text-success",
    dot: "bg-success",
  },
  FAILED: {
    wrapper: "border-danger/25 bg-danger-soft text-danger",
    dot: "bg-danger",
  },
};

export function ReviewStatusBadge({ status, className }) {
  const key = String(status ?? "QUEUED").toUpperCase();
  const style = STATUS_STYLES[key] ?? STATUS_STYLES.QUEUED;

  return (
    <Badge variant="outline" className={cn("font-medium", style.wrapper, className)}>
      <span className={cn("size-1.5 rounded-full", style.dot)} />
      {sentenceCase(key)}
    </Badge>
  );
}
