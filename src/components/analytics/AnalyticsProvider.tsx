"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { bumpVisit, markRouteEntered, track } from "@/lib/analytics";
import { initJourney, journeyRouteChange, stopJourney } from "@/lib/journey";

/**
 * App-wide analytics bootstrap. Counts visits once per session boundary, marks
 * each client-side route change as a page_view (gtag's config only fires one
 * automatically on the initial load, not on App Router navigations), and drives
 * the first-party journey recorder that measures per-essay reading time.
 */
export function AnalyticsProvider() {
  const pathname = usePathname();
  // gtag's config already sends the first page_view; only emit on client nav.
  const firstLoad = useRef(true);

  useEffect(() => {
    bumpVisit();
    initJourney();
    return () => stopJourney();
  }, []);

  useEffect(() => {
    markRouteEntered();
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    // Closes out the previous page's dwell before starting the new one.
    journeyRouteChange(pathname);
    track("page_view", { page_path: pathname });
  }, [pathname]);

  return null;
}
