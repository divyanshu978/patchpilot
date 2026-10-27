"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({ children, ...props }) {
  return (
    <TooltipPrimitive.Root delayDuration={250}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="right"
          sideOffset={8}
          className={cn(
            "z-50 rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-[0_4px_16px_rgba(16,12,40,0.12)]",
          )}
          {...props}
        />
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
