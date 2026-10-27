import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function StatCard({ label, value, hint, icon: Icon, tone = "default", className }) {
  const tones = {
    default: "bg-muted text-foreground/70",
    primary: "bg-primary-soft text-primary",
    danger: "bg-red-500/10 text-red-600 dark:text-red-400",
    success: "bg-success-soft text-success",
  };

  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
            {value}
          </p>
        </div>
        {Icon ? (
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}