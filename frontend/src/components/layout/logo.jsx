import Link from "next/link";
import { GitPullRequest } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ collapsed = false, className }) {
  return (
    <Link
      href="/"
      aria-label="PatchPilot overview"
      className={cn(
        "flex items-center gap-2.5 rounded-lg focus-visible:outline-none",
        collapsed ? "justify-center" : "",
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(76,29,149,0.3)]">
        <GitPullRequest className="size-4.5" strokeWidth={2.2} />
      </span>
      {!collapsed ? (
        <span className="flex flex-col leading-tight">
          <span className="text-[15px] font-semibold tracking-tight text-foreground">PatchPilot</span>
          <span className="text-[11px] text-muted-foreground">AI code review</span>
        </span>
      ) : null}
    </Link>
  );
}