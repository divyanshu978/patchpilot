"use client";

import { useCopyToClipboard } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { Check, Copy } from "lucide-react";

export function CopyButton({ value, label = "Copy", className, size = "sm" }) {
  const { copied, copy } = useCopyToClipboard();
  const { toast } = useToast();

  const handleCopy = async () => {
    const success = await copy(value ?? "");
    if (success) {
      toast({ variant: "success", title: "Copied to clipboard" });
    } else {
      toast({
        variant: "error",
        title: "Could not copy",
        description: "Select the code manually and copy it from the snippet.",
      });
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size={size}
      onClick={handleCopy}
      className={className}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}