/**
 * Streamed ahead of the essay, so it is also what anything reading the raw HTML
 * sees first — crawlers, link unfurlers, article importers. It therefore says
 * nothing: no headings, no copy, just the shape of the page. A talkative
 * fallback ("Preparing your essay…") gets mistaken for the article itself.
 */
export default function Loading() {
  return (
    <div
      aria-hidden
      className="min-h-screen px-4 py-12 md:px-6 md:py-20"
    >
      <div className="mx-auto max-w-2xl animate-pulse">
        {/* Top bar */}
        <div className="mb-12 flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-foreground/10" />
          <div className="flex gap-2">
            <div className="h-8 w-8 rounded-lg bg-foreground/10" />
            <div className="h-8 w-8 rounded-lg bg-foreground/10" />
            <div className="h-8 w-8 rounded-lg bg-foreground/10" />
          </div>
        </div>

        {/* Banner */}
        <div className="mb-8 h-44 rounded-2xl bg-foreground/[0.07] md:mb-10 md:h-56" />

        {/* Header */}
        <div className="mb-14 flex flex-col items-center gap-4">
          <div className="h-3 w-40 rounded bg-foreground/10" />
          <div className="h-9 w-full max-w-lg rounded bg-foreground/10" />
          <div className="h-9 w-3/5 rounded bg-foreground/10" />
          <div className="h-4 w-72 max-w-full rounded bg-foreground/[0.07]" />
          <div className="h-3 w-48 rounded bg-foreground/[0.07]" />
        </div>

        {/* Body */}
        <div className="space-y-8">
          {[0, 1, 2].map((block) => (
            <div key={block} className="space-y-3">
              <div className="h-4 w-full rounded bg-foreground/[0.07]" />
              <div className="h-4 w-full rounded bg-foreground/[0.07]" />
              <div className="h-4 w-11/12 rounded bg-foreground/[0.07]" />
              <div className="h-4 w-4/5 rounded bg-foreground/[0.07]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
