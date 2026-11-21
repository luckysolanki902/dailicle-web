"use client";

import { useEffect, useState } from "react";
import { ThumbsUp } from "lucide-react";

async function record(slug: string, action: "view" | "like" | "unlike", signal?: AbortSignal) {
  const response = await fetch("/api/startups/readership", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, action }), signal,
  });
  if (!response.ok) throw new Error("Could not record essay feedback");
  return (await response.json() as { liked: boolean }).liked;
}

export function StartupFeedback({ slug }: { slug: string }) {
  const [liked, setLiked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void record(slug, "view", controller.signal).then(setLiked).catch(() => {});
    return () => controller.abort();
  }, [slug]);

  if (liked === null) return null;
  return (
    <button type="button" disabled={busy} aria-pressed={liked}
      className="mt-10 inline-flex items-center gap-2 rounded-full border border-foreground/20 px-4 py-2 text-sm hover:border-foreground/50"
      onClick={async () => {
        setBusy(true);
        try { setLiked(await record(slug, liked ? "unlike" : "like")); } catch { /* Keep the last recorded value. */ }
        finally { setBusy(false); }
      }}>
      <ThumbsUp size={16} aria-hidden="true" /> {liked ? "Liked" : "Like this essay"}
    </button>
  );
}
