"use client";

import { useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { track, getCurrentEssay } from "@/lib/analytics";

/**
 * A deliberately quiet like/dislike. No counts, no crowd just a private
 * nudge that tells us whether an essay landed. One vote per visitor (deduped
 * server-side by IP); tapping the same choice again clears it.
 */
export function ReactionBar({ essayId }: { essayId: string }) {
  const [value, setValue] = useState<number>(0);

  useEffect(() => {
    let active = true;
    fetch(`/api/reaction?essayId=${encodeURIComponent(essayId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (active) setValue(typeof d?.value === "number" ? d.value : 0);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [essayId]);

  const vote = (choice: 1 | -1) => {
    const next = value === choice ? 0 : choice; // toggle off if unchanged
    setValue(next);
    if (next !== 0) {
      track("reaction", {
        essay_id: essayId,
        reaction: next === 1 ? "up" : "down",
        category: getCurrentEssay()?.category,
      });
    }
    fetch("/api/reaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ essayId, value: next }),
    }).catch(() => {});
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-foreground/40">
        Did this essay land for you?
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => vote(1)}
          aria-label="Yes, this landed"
          aria-pressed={value === 1}
          className={cn(
            "p-3 rounded-full border transition-colors",
            value === 1
              ? "border-accent text-accent bg-accent/10"
              : "border-foreground/15 text-foreground/40 hover:text-foreground hover:border-foreground/40"
          )}
        >
          <ThumbsUp size={18} />
        </button>
        <button
          type="button"
          onClick={() => vote(-1)}
          aria-label="Not really"
          aria-pressed={value === -1}
          className={cn(
            "p-3 rounded-full border transition-colors",
            value === -1
              ? "border-foreground/50 text-foreground bg-foreground/10"
              : "border-foreground/15 text-foreground/40 hover:text-foreground hover:border-foreground/40"
          )}
        >
          <ThumbsDown size={18} />
        </button>
      </div>
      <p
        className={cn(
          "text-xs italic text-foreground/40 transition-opacity",
          value === 0 ? "opacity-0" : "opacity-100"
        )}
      >
        Noted – thank you.
      </p>
    </div>
  );
}
