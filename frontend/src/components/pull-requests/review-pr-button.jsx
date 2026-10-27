"use client";

import Link from "next/link";
import { Loader2, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReviewPrButton({ onReview, pending, reviewHref }) {
  if (reviewHref) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Button variant="secondary" size="sm" asChild>
          <Link href={reviewHref}>View review</Link>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onReview}
          disabled={pending}
          aria-label="Re-run review"
          title="Re-run review"
        >
          <RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} />
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={onReview} disabled={pending}>
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
      {pending ? "Starting…" : "Review PR"}
    </Button>
  );
}