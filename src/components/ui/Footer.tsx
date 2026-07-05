"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import {
  CheckCircle2,
  Loader2,
  Mail,
  Moon,
  Rocket,
  Sparkles,
  Sun,
  TreeDeciduous,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SubscribeStatus = "idle" | "submitting" | "success" | "already" | "error";

function getInitialSubscribeState() {
  if (typeof window === "undefined") {
    return {
      email: "",
      status: "idle" as SubscribeStatus,
      message: "",
    };
  }

  const savedEmail = window.localStorage.getItem("dailicle:subscriberEmail");

  return {
    email: savedEmail || "",
    status: savedEmail ? ("success" as SubscribeStatus) : ("idle" as SubscribeStatus),
    message: savedEmail ? "You are on the list." : "",
  };
}

export function Footer() {
  const { theme, setTheme } = useTheme();
  const [subscribeState, setSubscribeState] = useState(getInitialSubscribeState);
  const { email, status, message } = subscribeState;

  const themes = [
    { id: "light", icon: Sun, label: "Day" },
    { id: "dark", icon: Moon, label: "Night" },
    { id: "wooden", icon: TreeDeciduous, label: "Study" },
    { id: "space", icon: Rocket, label: "Void" },
    { id: "fairytale", icon: Sparkles, label: "Dream" },
  ] as const;

  const handleSubscribe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || status === "submitting") return;

    setSubscribeState((current) => ({
      ...current,
      status: "submitting",
      message: "",
    }));

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (response.ok) {
        window.localStorage.setItem("dailicle:subscriberEmail", normalizedEmail);
        setSubscribeState({
          email: normalizedEmail,
          status: "success",
          message: data.message || "Subscribed. See you on Monday.",
        });
        return;
      }

      if (response.status === 409) {
        window.localStorage.setItem("dailicle:subscriberEmail", normalizedEmail);
        setSubscribeState({
          email: normalizedEmail,
          status: "already",
          message: data.message || "Already subscribed with this email.",
        });
        return;
      }

      setSubscribeState((current) => ({
        ...current,
        status: "error",
        message: data.message || "Could not subscribe. Please try again.",
      }));
    } catch {
      setSubscribeState((current) => ({
        ...current,
        status: "error",
        message: "Could not subscribe. Please try again.",
      }));
    }
  };

  return (
    <footer className="py-12 px-6 border-t border-foreground/5 mt-20">
      <div className="max-w-5xl mx-auto grid gap-10 md:grid-cols-[1fr_1.35fr] md:items-start">
        <div className="text-center md:text-left">
          <h3 className="font-bold text-lg tracking-tight">The Dailicle</h3>
          <p className="text-sm text-foreground/40 mt-2">
            One essay a week. Nothing else.
          </p>
        </div>

        <div className="flex flex-col items-center md:items-end gap-6">
          <form
            onSubmit={handleSubscribe}
            className="w-full max-w-md space-y-3"
          >
            <label
              htmlFor="footer-subscribe-email"
              className="block text-center md:text-right text-sm font-medium text-foreground/60"
            >
              Subscribe for updates
            </label>
            <div className="flex items-center gap-2 rounded-full border border-foreground/10 bg-background/45 p-1.5 shadow-[0_18px_60px_color-mix(in_srgb,var(--foreground)_6%,transparent)] backdrop-blur">
              <div className="pl-3 text-foreground/35">
                <Mail size={17} aria-hidden="true" />
              </div>
              <input
                id="footer-subscribe-email"
                type="email"
                required
                value={email}
                onChange={(event) => {
                  setSubscribeState((current) => ({
                    email: event.target.value,
                    status: current.status === "submitting" ? "submitting" : "idle",
                    message: current.status === "submitting" ? current.message : "",
                  }));
                }}
                placeholder="you@example.com"
                autoComplete="email"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-foreground/30"
              />
              <button
                type="submit"
                disabled={status === "submitting" || !email.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                aria-label="Subscribe for updates"
              >
                {status === "submitting" ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : status === "success" || status === "already" ? (
                  <CheckCircle2 size={16} aria-hidden="true" />
                ) : (
                  <Mail size={16} aria-hidden="true" />
                )}
              </button>
            </div>
            <p
              className={cn(
                "min-h-5 text-center md:text-right text-xs transition-colors",
                status === "error" ? "text-red-500" : "text-foreground/45"
              )}
              aria-live="polite"
            >
              {message || "A quiet note when a new essay lands."}
            </p>
          </form>

          <nav className="flex flex-wrap justify-center gap-6 text-sm font-medium text-foreground/60">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/archive" className="hover:text-foreground transition-colors">Archive</Link>
            <Link href="/manifesto" className="hover:text-foreground transition-colors">Why Read?</Link>
            <Link href="/feedback" className="hover:text-foreground transition-colors">Feedback</Link>
          </nav>

          {/* Mobile Theme Switcher */}
          <div className="flex md:hidden items-center gap-2 p-1 rounded-full bg-foreground/5">
            {themes.map((t) => {
              const Icon = t.icon;
              const isActive = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    "p-2 rounded-full transition-all",
                    isActive ? "bg-foreground text-background" : "text-foreground/40"
                  )}
                  aria-label={t.label}
                >
                  <Icon size={14} />
                </button>
              );
            })}
          </div>

          <div className="text-xs text-foreground/20">
            © {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </footer>
  );
}
