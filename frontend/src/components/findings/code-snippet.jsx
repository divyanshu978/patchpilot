"use client";

import { cn } from "@/lib/utils";

function normalizeCode(value) {
  if (!value) return "";
  return value
    .trim()
    .replace(/^```[a-zA-Z]*\s*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

function isDiff(code) {
  return code
    .split("\n")
    .some((line) => line.startsWith("@@") || line.startsWith("--- ") || line.startsWith("+++ "));
}

export function CodeSnippet({
  code,
  label,
  startLine = null,
  variant = "evidence",
  className,
}) {
  const normalized = normalizeCode(code);

  if (!normalized) {
    return (
      <div className={cn("rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground", className)}>
        No code snippet was provided.
      </div>
    );
  }

  const lines = normalized.split("\n");
  const diff = variant === "fix" && isDiff(normalized);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-[#0d1117] dark:border-white/10",
        variant === "fix" && "ring-1 ring-primary/20",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2",
          variant === "fix" ? "bg-white/[0.04]" : "bg-white/[0.02]",
        )}
      >
        <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
          <span
            className={cn(
              "size-1.5 rounded-full",
              variant === "fix" ? "bg-emerald-400" : "bg-slate-500",
            )}
            aria-hidden="true"
          />
          {label ?? (variant === "fix" ? "Suggested fix" : "Existing code")}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          {variant === "fix" ? "Not applied" : diff ? "Diff" : "Code"}
        </span>
      </div>
      <div className="scrollbar-thin max-h-[420px] overflow-auto">
        <pre className="min-w-full p-3 font-mono text-[12.5px] leading-6">
          <code>
            {lines.map((line, index) => {
              const diffClass = diff
                ? line.startsWith("+") && !line.startsWith("+++")
                  ? "bg-emerald-500/10 text-emerald-300"
                  : line.startsWith("-") && !line.startsWith("---")
                    ? "bg-red-500/10 text-red-300"
                    : line.startsWith("@@")
                      ? "text-violet-300"
                      : "text-slate-300"
                : "text-slate-200";

              return (
                <span key={index} className={cn("flex min-h-6", diffClass)}>
                  {startLine && !diff ? (
                    <span
                      className="w-9 shrink-0 select-none pr-3 text-right text-slate-600"
                      aria-hidden="true"
                    >
                      {startLine + index}
                    </span>
                  ) : null}
                  <span className="whitespace-pre">{line || " "}</span>
                </span>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}