"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { bumpVisit, markRouteEntered, track } from "@/lib/analytics";

/**
 * App-wide analytics bootstrap. Counts visits once per session boundary and
 * marks each client-side route change as a page_view (gtag's config only fires
 * one automatically on the initial load, not on App Router navigations).
 */
export function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    bumpVisit();
  }, []);

  useEffect(() => {
    markRouteEntered();
    track("page_view", { page_path: pathname });
  }, [pathname]);

  return null;
}
