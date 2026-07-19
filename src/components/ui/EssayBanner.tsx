import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The editorial banner illustration. Two looks:
 *  - framed (default): a clean rounded, bordered card with a soft shadow — an
 *    intentional "framed print" that reads well on every theme.
 *  - transparent: for PNGs with a transparent background, the subject floats
 *    directly on the page (no card), so it blends into any theme.
 *
 * Renders nothing without a source, so every caller keeps its plain layout.
 */
export function EssayBanner({
  src,
  alt,
  className,
  sizes = "(max-width: 768px) 100vw, 640px",
  priority = false,
  transparent = false,
  rounded = "rounded-2xl",
}: {
  src?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  transparent?: boolean;
  rounded?: string;
}) {
  if (!src) return null;

  // Transparent PNG: the subject floats directly on the page — no card, so it
  // blends on every theme. A soft drop shadow follows the alpha shape.
  if (transparent) {
    return (
      <div className={cn("relative w-full aspect-[5/2]", className)}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          style={{opacity: 0.8}}
          className="object-contain [filter:drop-shadow(0_12px_22px_rgba(0,0,0,0.16))]"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden border border-foreground/10 bg-foreground/[0.04] aspect-[5/2] shadow-[0_18px_45px_-28px_rgba(0,0,0,0.45)]",
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
    </div>
  );
}
