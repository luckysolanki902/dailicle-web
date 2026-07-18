"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSupport, type SupportSource } from "./SupportProvider";

/**
 * A quiet "Support" affordance for the navbar and footer. Deliberately understated
 * a small heart and a word so it reads as an invitation, not a pitch.
 */
export function SupportButton({
  source,
  className,
  label = "Support",
  showIcon = true,
}: {
  source: SupportSource;
  className?: string;
  label?: string;
  showIcon?: boolean;
}) {
  const { open } = useSupport();
  return (
    <button
      onClick={() => open(source)}
      className={cn(
        "group inline-flex items-center gap-1.5 transition-colors",
        className
      )}
    >
      {showIcon && (
        <Heart
          size={13}
          className="text-accent/70 transition-transform group-hover:scale-110 group-hover:text-accent"
        />
      )}
      <span>{label}</span>
    </button>
  );
}
