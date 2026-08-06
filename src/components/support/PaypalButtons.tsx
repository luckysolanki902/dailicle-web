"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * PayPal's own buttons, rendered inside the support dialog for readers outside
 * India. PayPal insists on drawing these itself — the branded button is not
 * something an integrator is allowed to fake — so this mounts their SDK into a
 * container div rather than rendering markup of our own.
 *
 * The amount is never passed to the browser SDK. `createOrder` calls our server,
 * which prices the tier and creates the PayPal order; the SDK only ever learns
 * an order id. That keeps the "the client never decides how much is charged"
 * rule identical across both gateways.
 */

interface PaypalNamespace {
  Buttons: (config: Record<string, unknown>) => {
    render: (target: HTMLElement) => Promise<void>;
    close?: () => void;
  };
}
declare global {
  interface Window {
    paypal?: PaypalNamespace;
  }
}

function sdkUrl(clientId: string, currency: string): string {
  const params = new URLSearchParams({
    "client-id": clientId,
    currency,
    intent: "capture",
    components: "buttons",
    // A one-off contribution has no business offering instalment credit.
    "disable-funding": "credit,paylater",
  });
  return `https://www.paypal.com/sdk/js?${params.toString()}`;
}

/**
 * Load the SDK once per (client id, currency). PayPal keys its global on the
 * currency baked into the script URL, so switching currency needs a fresh
 * script — but within a session the currency never changes, so in practice this
 * loads exactly once.
 */
function loadSdk(clientId: string, currency: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    const src = sdkUrl(clientId, currency);
    if (window.paypal) return resolve(true);

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function PaypalButtons({
  clientId,
  currency,
  /**
   * Read the *current* selection at click time. A ref-backed getter rather than
   * a prop, because PayPal renders its buttons into an iframe once and closes
   * over whatever it was given — a plain prop would freeze the reader on
   * whichever amount happened to be selected when the dialog opened.
   */
  getPayload,
  onSuccess,
  onError,
  onCancel,
  labels,
}: {
  clientId: string;
  currency: string;
  getPayload: () => Record<string, unknown> | null;
  onSuccess: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
  labels: { loading: string; failed: string };
}) {
  const container = useRef<HTMLDivElement | null>(null);
  /** Set when we threw on purpose, so onError knows not to talk over us. */
  const suppressError = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Keep the callbacks fresh without re-rendering the buttons. Written in an
  // effect rather than during render: PayPal's iframe reads these long after
  // the fact, so what matters is that the ref is current by the time the reader
  // clicks, and mutating a ref mid-render is not allowed.
  const handlers = useRef({ getPayload, onSuccess, onError, onCancel });
  useEffect(() => {
    handlers.current = { getPayload, onSuccess, onError, onCancel };
  }, [getPayload, onSuccess, onError, onCancel]);

  useEffect(() => {
    let cancelled = false;
    let instance: ReturnType<PaypalNamespace["Buttons"]> | null = null;

    (async () => {
      const ok = await loadSdk(clientId, currency);
      if (cancelled) return;
      if (!ok || !window.paypal || !container.current) {
        setFailed(true);
        return;
      }

      instance = window.paypal.Buttons({
        style: { layout: "vertical", shape: "pill", label: "paypal", height: 46 },

        createOrder: async () => {
          const payload = handlers.current.getPayload();
          if (!payload) {
            // The dialog has already shown the reader a precise reason (an
            // empty or too-small custom amount). PayPal routes any throw here
            // into onError, so flag it: replacing "Enter at least $1" with a
            // generic "could not load checkout" would send them hunting for a
            // problem that isn't there.
            suppressError.current = true;
            throw new Error("no-amount");
          }
          const res = await fetch("/api/support/paypal/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok || !data?.orderId) {
            throw new Error(data?.message || "order-failed");
          }
          return data.orderId as string;
        },

        onApprove: async (data: { orderID: string }) => {
          // The capture is the charge, so a failure here matters: tell the
          // reader rather than showing a success they did not get.
          const res = await fetch("/api/support/paypal/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: data.orderID }),
          });
          const body = await res.json().catch(() => null);
          if (!res.ok || !body?.success) {
            handlers.current.onError(body?.message || labels.failed);
            return;
          }
          handlers.current.onSuccess();
        },

        onCancel: () => handlers.current.onCancel(),

        onError: (err: unknown) => {
          if (suppressError.current) {
            suppressError.current = false;
            return;
          }
          console.error("paypal button error:", err);
          handlers.current.onError(labels.failed);
        },
      });

      try {
        await instance.render(container.current);
        if (!cancelled) setReady(true);
      } catch (err) {
        console.error("paypal render failed:", err);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      try {
        instance?.close?.();
      } catch {
        /* the SDK throws if it was never rendered; nothing to do */
      }
    };
  }, [clientId, currency, labels.failed]);

  return (
    <div className="mt-5">
      {!ready && !failed && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-foreground/45">
          <Loader2 size={16} className="animate-spin" />
          {labels.loading}
        </div>
      )}
      {failed && (
        <p className="py-3 text-center text-xs text-red-500">{labels.failed}</p>
      )}
      {/* PayPal renders into this node. Kept mounted even while loading so the
          SDK always has a target to draw into. */}
      <div ref={container} className={failed ? "hidden" : undefined} />
    </div>
  );
}
