"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/I18nProvider";
import { track, getCurrentEssay } from "@/lib/analytics";
import { journeyEvent } from "@/lib/journey";

type State = "idle" | "loading" | "done" | "already" | "error";

/**
 * The email-capture form used both in the end-of-essay box and the mid-scroll
 * nudge. Posts to /api/subscribe with a `source` so the admin can see which
 * surface actually captures readers. Low-friction: one field, inline feedback,
 * never a modal.
 */
export function SubscribeForm({
  source,
  compact = false,
}: {
  source: string;
  compact?: boolean;
}) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (state === "loading" || state === "done") return;
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setState("error");
      return;
    }
    setState("loading");
    track("subscribe_submit", { source });
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, source }),
      });
      if (res.ok || res.status === 409) {
        // Remember so the mid-scroll nudge stops asking a reader who's on the list.
        try {
          localStorage.setItem("dailicle:subscribed", "1");
        } catch {
          /* ignore */
        }
      }
      if (res.ok) {
        setState("done");
        track("subscribe_success", { source });
        // Timeline only — the journey records *that* they subscribed, never
        // the address they typed.
        const essay = getCurrentEssay();
        journeyEvent("subscribe", {
          source,
          essayId: essay?.id,
          title: essay?.title,
          category: essay?.category,
        });
      } else if (res.status === 409) {
        setState("already");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  if (state === "done" || state === "already") {
    return (
      <p className="flex items-center justify-center gap-2 text-sm font-medium text-accent">
        <Check size={16} />
        {t(state === "done" ? "reader.subscribe.done" : "reader.subscribe.already")}
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={cn("mx-auto flex w-full max-w-md gap-2", compact ? "flex-row" : "flex-col sm:flex-row")}
    >
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (state === "error") setState("idle");
        }}
        placeholder={t("reader.subscribe.placeholder")}
        aria-label={t("reader.subscribe.placeholder")}
        className={cn(
          "min-w-0 flex-1 rounded-full border bg-background/60 px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-foreground/35 focus:border-accent/60",
          state === "error" ? "border-red-500/60" : "border-foreground/15"
        )}
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {state === "loading" ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <>
            {t("reader.subscribe.cta")}
            <ArrowRight size={15} />
          </>
        )}
      </button>
    </form>
  );
}
