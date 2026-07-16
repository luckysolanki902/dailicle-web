"use client";

import { useEffect } from "react";
import { useSupport, SUPPORTED_KEY } from "./SupportProvider";

/**
 * Opens the support dialog once, after ~3 minutes of genuine reading — the point
 * where a reader has actually gotten something from the essay. It is gentle by
 * design: shown at most once per day, never if the reader has already supported,
 * and the timer only advances while the tab is visible so a backgrounded tab
 * doesn't trip it.
 */
const READING_MS = 3 * 60 * 1000;
const PROMPTED_KEY = "dailicle:supportPromptedAt";
const ONE_DAY = 24 * 60 * 60 * 1000;

export function ReadingSupportTrigger() {
  const { open, isOpen } = useSupport();

  useEffect(() => {
    // Read the "already paid" flag straight from localStorage rather than the
    // context value: this effect runs once on mount and the context's
    // hasSupported flips to true a tick later, so a paid reader could otherwise
    // still arm the timer. A supporter must NEVER see the auto dialog again.
    try {
      if (localStorage.getItem(SUPPORTED_KEY) === "1") return;

      // Respect a recent prompt so returning readers aren't nagged.
      const last = Number(localStorage.getItem(PROMPTED_KEY) || 0);
      if (last && Date.now() - last < ONE_DAY) return;
    } catch {
      /* ignore */
    }

    let elapsed = 0;
    let lastTick = Date.now();
    let fired = false;

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        lastTick = Date.now();
        return;
      }
      const now = Date.now();
      elapsed += now - lastTick;
      lastTick = now;

      if (!fired && elapsed >= READING_MS) {
        fired = true;
        window.clearInterval(interval);
        // Don't interrupt if something else is already open.
        if (!isOpen) {
          try {
            localStorage.setItem(PROMPTED_KEY, String(Date.now()));
          } catch {
            /* ignore */
          }
          open("reader");
        }
      }
    }, 5000);

    return () => window.clearInterval(interval);
    // Intentionally run once per mount; open/isOpen are stable enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
