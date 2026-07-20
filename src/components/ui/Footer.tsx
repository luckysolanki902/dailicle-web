"use client";

import { FormEvent, useState } from "react";
import { LocalizedLink as Link } from "@/i18n/Link";
import { useTheme } from "@/context/ThemeContext";
import { useT } from "@/i18n/I18nProvider";
import { SupportButton } from "@/components/support/SupportButton";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
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
import { track } from "@/lib/analytics";

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
    message: "",
  };
}

export function Footer() {
  const { theme, setTheme } = useTheme();
  const t = useT();
  const [subscribeState, setSubscribeState] = useState(getInitialSubscribeState);
  const { email, status, message } = subscribeState;

  const themes = [
    { id: "light", icon: Sun, label: t("footer.themes.light") },
    { id: "dark", icon: Moon, label: t("footer.themes.dark") },
    { id: "wooden", icon: TreeDeciduous, label: t("footer.themes.wooden") },
    { id: "space", icon: Rocket, label: t("footer.themes.space") },
    { id: "fairytale", icon: Sparkles, label: t("footer.themes.fairytale") },
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
        track("subscribe", { result: "new" });
        setSubscribeState({
          email: normalizedEmail,
          status: "success",
          message: data.message || t("footer.success"),
        });
        return;
      }

      if (response.status === 409) {
        track("subscribe", { result: "already" });
        window.localStorage.setItem("dailicle:subscriberEmail", normalizedEmail);
        setSubscribeState({
          email: normalizedEmail,
          status: "already",
          message: data.message || t("footer.already"),
        });
        return;
      }

      setSubscribeState((current) => ({
        ...current,
        status: "error",
        message: data.message || t("footer.error"),
      }));
    } catch {
      setSubscribeState((current) => ({
        ...current,
        status: "error",
        message: t("footer.error"),
      }));
    }
  };

  const statusMessage =
    message ||
    (status === "success" || status === "already" ? t("footer.onList") : "");

  return (
    <footer className="py-12 px-6 border-t border-foreground/5 mt-20">
      <div className="max-w-5xl mx-auto grid gap-10 md:grid-cols-[1fr_1.35fr] md:items-start">
        <div className="text-center md:text-left">
          <h3 className="font-bold text-lg tracking-tight">{t("common.siteName")}</h3>
          <p className="text-sm text-foreground/40 mt-2">{t("footer.tagline")}</p>
        </div>

        <div className="flex flex-col items-center md:items-end gap-6">
          <form onSubmit={handleSubscribe} className="w-full max-w-md space-y-3">
            <label
              htmlFor="footer-subscribe-email"
              className="block text-center md:text-right text-sm font-medium text-foreground/60"
            >
              {t("footer.subscribeLabel")}
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
                placeholder={t("footer.subscribePlaceholder")}
                autoComplete="email"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-foreground/30"
              />
              <button
                type="submit"
                disabled={status === "submitting" || !email.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                aria-label={t("footer.subscribeAria")}
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
              {statusMessage || t("footer.subscribeHint")}
            </p>
          </form>

          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-foreground/60">
            <Link href="/" className="hover:text-foreground transition-colors">{t("nav.home")}</Link>
            <Link href="/archive" className="hover:text-foreground transition-colors">{t("nav.archive")}</Link>
            <Link href="/manifesto" className="hover:text-foreground transition-colors">{t("nav.manifesto")}</Link>
            <Link href="/feedback" className="hover:text-foreground transition-colors">{t("nav.feedback")}</Link>
            <SupportButton source="footer" label={t("nav.support")} className="hover:text-foreground" />
            <LanguageSwitcher variant="inline" align="left" />
          </nav>

          {/* Mobile Theme Switcher */}
          <div className="flex md:hidden items-center gap-2 p-1 rounded-full bg-foreground/5">
            {themes.map((tItem) => {
              const Icon = tItem.icon;
              const isActive = theme === tItem.id;
              return (
                <button
                  key={tItem.id}
                  onClick={() => setTheme(tItem.id)}
                  className={cn(
                    "p-2 rounded-full transition-all",
                    isActive ? "bg-foreground text-background" : "text-foreground/40"
                  )}
                  aria-label={tItem.label}
                >
                  <Icon size={14} />
                </button>
              );
            })}
          </div>

          <div className="text-xs text-foreground/20" suppressHydrationWarning>
            © {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </footer>
  );
}
