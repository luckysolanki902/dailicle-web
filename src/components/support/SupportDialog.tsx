"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Heart, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SupportSource } from "./SupportProvider";
import { track, getGaClientId, getCurrentEssay } from "@/lib/analytics";
import { getVisitorId, getJourneySessionId, journeyEvent } from "@/lib/journey";
import { useT } from "@/i18n/I18nProvider";

type TierId = "t1" | "t2" | "t3";

interface Config {
  currency: string;
  symbol: string;
  presets: Record<TierId, number>;
  min: number;
  max: number;
}

// Minimal typing for the Razorpay Checkout global loaded from their CDN.
interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (resp: unknown) => void) => void;
}
interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image?: string;
  theme?: { color?: string; backdrop_color?: string };
  handler: (resp: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
}
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SRC}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const s = document.createElement("script");
    s.src = CHECKOUT_SRC;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function readAccent(): string {
  if (typeof window === "undefined") return "#8a5a2b";
  const v = getComputedStyle(document.body).getPropertyValue("--accent").trim();
  return v || "#8a5a2b";
}

type Status = "idle" | "processing" | "success" | "error";

export function SupportDialog({
  isOpen,
  source,
  onClose,
  onSupported,
}: {
  isOpen: boolean;
  source: SupportSource;
  onClose: () => void;
  onSupported: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [config, setConfig] = useState<Config | null>(null);
  const [selected, setSelected] = useState<TierId | "custom">("t2");
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const MESSAGE_MAX = 500;

  // Fetch pricing the first time the dialog is opened.
  useEffect(() => {
    if (!isOpen || config) return;
    let cancelled = false;
    fetch("/api/support/config")
      .then((r) => r.json())
      .then((c: Config) => {
        if (!cancelled) setConfig(c);
      })
      .catch(() => {
        if (!cancelled)
          setConfig({
            currency: "USD",
            symbol: "$",
            presets: { t1: 3, t2: 5, t3: 15 },
            min: 1,
            max: 10000,
          });
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, config]);

  // Reset transient state whenever the dialog closes.
  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setStatus("idle");
        setError("");
        setMessage("");
      }, 250);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const pay = useCallback(async () => {
    if (!config || status === "processing") return;
    setStatus("processing");
    setError("");

    const essay = getCurrentEssay();
    const payload: {
      tier?: TierId;
      amount?: number;
      source: string;
      gaClientId?: string;
      vid?: string;
      sid?: string;
      essayId?: string;
      category?: string;
      message?: string;
    } = {
      source,
      // The anonymous visitor id is what joins this payment to everything the
      // reader did before it — the whole point of the journey record.
      vid: getVisitorId() || undefined,
      sid: getJourneySessionId() || undefined,
      essayId: essay?.id,
      category: essay?.category,
      message: message.trim() || undefined,
    };
    if (selected === "custom") {
      const n = Number(custom);
      if (!Number.isFinite(n) || n < config.min) {
        setStatus("error");
        setError(t("support.errMin", { amount: `${config.symbol}${config.min}` }));
        return;
      }
      payload.amount = n;
    } else {
      payload.tier = selected;
    }

    track("support_checkout_start", {
      source,
      tier: payload.tier,
      amount: payload.amount,
      category: essay?.category,
      essay_id: essay?.id,
    });
    journeyEvent("checkout_start", {
      source,
      essayId: essay?.id,
      title: essay?.title,
      category: essay?.category,
    });

    try {
      // Stitch the eventual server-side "verified payment" event to this
      // browser session; best-effort, never blocks checkout.
      payload.gaClientId = (await getGaClientId()) || undefined;

      const scriptOk = await loadCheckout();
      if (!scriptOk || !window.Razorpay) {
        throw new Error(t("support.errCheckout"));
      }

      const orderRes = await fetch("/api/support/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(order?.message || t("support.errStart"));
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "The Dailicle",
        description: t("support.checkoutDescription"),
        theme: { color: readAccent() },
        handler: async (resp) => {
          onSupported();
          track("support_payment_success", {
            source,
            tier: payload.tier,
            amount: payload.amount,
            currency: order.currency,
            order_id: order.orderId,
            category: essay?.category,
            essay_id: essay?.id,
          });
          journeyEvent("payment_success", {
            source,
            essayId: essay?.id,
            title: essay?.title,
            category: essay?.category,
          });
          // Confirm to the server (the webhook is a redundant safety net if
          // this fails), then send the reader to the thank-you page.
          try {
            await fetch("/api/support/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(resp),
            });
          } catch {
            // Payment likely still succeeded; the webhook records it.
          }
          setStatus("success");
          router.push("/thank-you");
        },
        modal: {
          ondismiss: () => {
            setStatus("idle");
            track("support_checkout_dismissed", {
              source,
              tier: payload.tier,
              amount: payload.amount,
            });
            journeyEvent("checkout_dismiss", {
              source,
              essayId: essay?.id,
              title: essay?.title,
              category: essay?.category,
            });
          },
        },
      });
      rzp.open();
      track("support_checkout_opened", {
        source,
        tier: payload.tier,
        amount: payload.amount,
      });
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : t("support.errGeneric")
      );
    }
  }, [config, status, selected, custom, source, onSupported]);

  const chooseTier = useCallback(
    (tier: TierId | "custom") => {
      setSelected(tier);
      track("support_tier_select", {
        source,
        tier,
        amount:
          tier === "custom" ? Number(custom) || undefined : config?.presets[tier],
      });
    },
    [source, custom, config]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
          aria-modal="true"
          role="dialog"
        >
          {/* Scrim */}
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", damping: 26, stiffness: 260 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-foreground/10 bg-background text-foreground shadow-[0_40px_120px_-20px_rgba(0,0,0,0.55)]"
          >
            {/* Soft accent wash at the top */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-32"
              style={{
                background:
                  "linear-gradient(to bottom, color-mix(in srgb, var(--accent) 14%, transparent), transparent)",
              }}
            />

            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-foreground/40 transition-colors hover:bg-foreground/5 hover:text-foreground"
              aria-label={t("support.close")}
            >
              <X size={18} />
            </button>

            <div className="relative px-7 pb-7 pt-9">
              {status === "success" ? (
                <div className="flex flex-col items-center gap-4 py-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <Check size={26} />
                  </div>
                  <h2 className="font-display text-2xl tracking-tight">
                    {t("support.thanksTitle")}
                  </h2>
                  <p className="max-w-xs font-serif text-foreground/60">
                    {t("support.thanksBody")}
                  </p>
                  <button
                    onClick={onClose}
                    className="mt-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
                  >
                    {t("support.backToReading")}
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-accent">
                    <Heart size={16} className="fill-current" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">
                      The Dailicle
                    </span>
                  </div>

                  <h2 className="mt-4 font-display text-2xl leading-snug tracking-tight text-balance">
                    {t("support.title")}
                  </h2>
                  <p className="mt-2 font-serif text-[15px] leading-relaxed text-foreground/60">
                    {t("support.body")}
                  </p>

                  {/* Tiers */}
                  <div className="mt-6 grid grid-cols-3 gap-2.5">
                    {(["t1", "t2", "t3"] as TierId[]).map((tier) => {
                      const active = selected === tier;
                      return (
                        <button
                          key={tier}
                          onClick={() => chooseTier(tier)}
                          className={cn(
                            "group flex flex-col items-center gap-1 rounded-2xl border px-2 py-4 transition-all",
                            active
                              ? "border-accent bg-accent/10 shadow-[0_0_0_1px_var(--accent)]"
                              : "border-foreground/10 hover:border-foreground/25"
                          )}
                        >
                          <span className="font-display text-lg tracking-tight">
                            {config ? (
                              <>
                                {config.symbol}
                                {config.presets[tier]}
                              </>
                            ) : (
                              <span className="opacity-30">···</span>
                            )}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] uppercase tracking-wide",
                              active ? "text-accent" : "text-foreground/40"
                            )}
                          >
                            {t(`support.tiers.${tier}`)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom amount */}
                  <button
                    onClick={() => chooseTier("custom")}
                    className={cn(
                      "mt-2.5 flex w-full items-center gap-2 rounded-2xl border px-4 py-3 transition-all",
                      selected === "custom"
                        ? "border-accent bg-accent/10"
                        : "border-foreground/10 hover:border-foreground/25"
                    )}
                  >
                    <span className="text-sm text-foreground/50">
                      {config?.symbol}
                    </span>
                    <input
                      inputMode="numeric"
                      value={custom}
                      onFocus={() => setSelected("custom")}
                      onChange={(e) =>
                        setCustom(e.target.value.replace(/[^0-9]/g, ""))
                      }
                      placeholder={t("support.anotherAmount")}
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/35"
                    />
                  </button>

                  {/* Optional note to the writer */}
                  <div className="mt-2.5">
                    <textarea
                      value={message}
                      onChange={(e) =>
                        setMessage(e.target.value.slice(0, MESSAGE_MAX))
                      }
                      rows={2}
                      placeholder={t("support.notePlaceholder")}
                      className="w-full resize-none rounded-2xl border border-foreground/10 bg-transparent px-4 py-3 text-sm outline-none transition-colors placeholder:text-foreground/35 focus:border-foreground/25"
                    />
                    {message.trim() && (
                      <p className="mt-1 pr-1 text-right text-[10px] text-foreground/30">
                        {message.length}/{MESSAGE_MAX}
                      </p>
                    )}
                  </div>

                  {error && (
                    <p className="mt-3 text-center text-xs text-red-500">
                      {error}
                    </p>
                  )}

                  <button
                    onClick={pay}
                    disabled={status === "processing" || !config}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {status === "processing" ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        {t("support.processing")}
                      </>
                    ) : (
                      <>{t("support.cta")}</>
                    )}
                  </button>

                  <button
                    onClick={onClose}
                    className="mt-3 w-full text-center text-xs text-foreground/40 transition-colors hover:text-foreground/70"
                  >
                    {t("support.maybeLater")}
                  </button>

                  <p className="mt-4 text-center text-[11px] text-foreground/35">
                    {t("support.secure")}
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
