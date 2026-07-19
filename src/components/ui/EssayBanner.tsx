import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The editorial banner illustration shown at the top of an essay and in
 * listings. Fixed 5:2 crop, theme-aware frame. Renders nothing when there is
 * no image, so every caller degrades to its original bannerless layout.
 */
export function EssayBanner({
  src,
  alt,
  className,
  sizes = "(max-width: 768px) 100vw, 768px",
  priority = false,
  rounded = "rounded-2xl",
}: {
  src?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  rounded?: string;
}) {
  if (!src) return null;
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden border border-foreground/10 bg-foreground/[0.04] aspect-[5/2]",
        rounded,
        className
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
      {/* Soft inner vignette so the frame reads as part of the page, not a sticker. */}
      <div
        className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5"
        aria-hidden
      />
    </div>
  );
}
