"use client";

import { AlertTriangle, FileCode2, Info, ShieldCheck } from "lucide-react";
import { CategoryBadge, SeverityBadge } from "./severity-badge";
import { CodeSnippet } from "./code-snippet";
import { CopyButton } from "./copy-button";
import { formatLocation } from "@/lib/utils";

function ConfidenceMeter({ confidence }) {
  const value = typeof confidence === "number" ? Math.round(confidence * 100) : null;
  if (value === null) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums text-foreground">{value}%</span>
    </div>
  );
}

export function FindingDetails({ finding, reviewId, repository, pullRequest }) {
  if (!finding) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-8 text-center">
        <Info className="size-5 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Select a finding</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Choose an issue on the left to see the evidence and the suggested fix.
        </p>
      </div>
    );
  }

  const lineRange = finding.startLine
    ? finding.endLine && finding.endLine !== finding.startLine
      ? `${finding.startLine}–${finding.endLine}`
      : `${finding.startLine}`
    : null;

  return (
    <div className="space-y-5">
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={finding.severity} />
          <CategoryBadge category={finding.category} />
        </div>
        <h3 className="text-base font-semibold leading-6 text-foreground">{finding.title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{finding.description}</p>
      </div>

      <dl className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-[11px] text-muted-foreground">File</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-foreground">
            <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{finding.filePath ?? "Repository-wide"}</span>
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">Lines</dt>
          <dd className="mt-0.5 text-xs text-foreground">{lineRange ?? "Not line specific"}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">Confidence</dt>
          <dd className="mt-1">
            <ConfidenceMeter confidence={finding.confidence} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] text-muted-foreground">Location</dt>
          <dd className="mt-0.5 truncate text-xs text-foreground">
            {repository?.owner}/{repository?.name}
            {pullRequest?.number ? ` · #${pullRequest.number}` : ""}
          </dd>
        </div>
      </dl>

      {finding.evidence ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Code evidence
            </h4>
            <CopyButton value={finding.evidence} label="Copy evidence" />
          </div>
          <CodeSnippet
            code={finding.evidence}
            startLine={finding.startLine ?? null}
            variant="evidence"
            label="Existing code"
          />
        </section>
      ) : null}

      {finding.suggestedFix ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Suggested fix
            </h4>
            <CopyButton value={finding.suggestedFix} label="Copy fix" />
          </div>
          <CodeSnippet code={finding.suggestedFix} variant="fix" label="Suggested fix" />
        </section>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          No automated fix was proposed for this finding.
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs leading-5 text-muted-foreground">
        {finding.suggestedFix ? (
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
        ) : (
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
        )}
        <span>
          Suggested fixes are reviewed suggestions only. PatchPilot never edits, commits or pushes
          code to your repository.
        </span>
      </div>

      {reviewId ? (
        <p className="text-[11px] text-muted-foreground">
          Finding from review <span className="font-mono">{reviewId.slice(0, 8)}</span>
        </p>
      ) : null}
    </div>
  );
}