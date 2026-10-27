"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { reviewService } from "@/lib/services/review.service";
import { useToast } from "@/components/providers/toast-provider";

export function useCreateReview() {
  const router = useRouter();
  const { toast } = useToast();
  const [pendingKey, setPendingKey] = useState(null);

  const createReview = useCallback(
    async ({ owner, repo, number }) => {
      if (pendingKey) return;
      const key = String(number);
      setPendingKey(key);

      try {
        const result = await reviewService.createReview({
          owner,
          repo,
          pullNumber: number,
        });

        if (!result?.id) {
          throw new Error("The backend did not return a review id.");
        }

        toast({
          variant: "success",
          title: `Review queued for #${number}`,
          description: "PatchPilot is analyzing the pull request.",
        });
        router.push(`/reviews/${result.id}`);
      } catch (error) {
        toast({
          variant: "error",
          title: "Could not start the review",
          description: error.message,
        });
      } finally {
        setPendingKey(null);
      }
    },
    [pendingKey, router, toast],
  );

  return { createReview, pendingKey };
}