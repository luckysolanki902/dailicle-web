"use client";

import { useEffect } from "react";

export function StartupLandingSignal({ source }: { source?: string }) {
  useEffect(() => {
    void fetch("/api/startups/funnel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source }), keepalive: true,
    }).catch(() => {});
  }, [source]);

  return null;
}
