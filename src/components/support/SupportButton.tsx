"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSupport, type SupportSource } from "./SupportProvider";

/**
 * The "Support" affordance for the navbar and footer.
 *
 * Two shapes. `link` is the original: a small heart and a word, styled exactly
 * like the navigation around it. `pill` gives it a faint accent-tinted outline
 * so it reads as a distinct invitation rather than a fourth nav item — which is
 * what it was doing at `text-foreground/40`, indistinguishable from Home and
 * Archive. Still quiet: an invitation, not a pitch.
 */
export function SupportButton({
  source,
  className,
  label = "Support",
  showIcon = true,
  variant = "link",
}: {
  source: SupportSource;
  className?: string;
  label?: string;
  showIcon?: boolean;
  variant?: "link" | "pill";
}) {
  const { open, hasSupported } = useSupport();

  return (
    <button
      onClick={() => open(source)}
      className={cn(
        "group inline-flex items-center gap-1.5 transition-colors",
        variant === "pill" && [
          "rounded-full border px-3 py-1",
          "border-accent/25 bg-accent/[0.07] text-accent",
          "hover:border-accent/50 hover:bg-accent/[0.12]",
        ],
        className
      )}
    >
      {showIcon && (
        <Heart
          size={13}
          className={cn(
            "transition-transform group-hover:scale-110",
            variant === "pill"
              ? "text-accent"
              : "text-accent/70 group-hover:text-accent",
            // Filled once they've given — a small, private acknowledgement
            // rather than a badge shown to everyone.
            hasSupported && "fill-current"
          )}
        />
      )}
      <span>{label}</span>
    </button>
  );
}
