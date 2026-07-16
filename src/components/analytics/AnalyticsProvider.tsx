"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { bumpVisit, markRouteEntered, track } from "@/lib/analytics";

/**
 * App-wide analytics bootstrap. Counts visits once per session boundary and
 * marks each client-side route change as a page_view (gtag's config only fires
 * one automatically on the initial load, not on App Router navigations).
 */
export function AnalyticsProvider() {
  const pathname = usePathname();
  // gtag's config already sends the first page_view; only emit on client nav.
  const firstLoad = useRef(true);

  useEffect(() => {
    bumpVisit();
  }, []);

  useEffect(() => {
    markRouteEntered();
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    track("page_view", { page_path: pathname });
  }, [pathname]);

  return null;
}
