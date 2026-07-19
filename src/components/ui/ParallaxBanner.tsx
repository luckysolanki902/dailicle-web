"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * A full-bleed banner for the home hero. The image drifts slower than the page
 * (a gentle parallax) and fades into the background at top and bottom, so it
 * reads as part of the front page rather than a card pasted on top of it.
 */
export function ParallaxBanner({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  // Image sits taller than the frame so it can travel without exposing an edge.
  const y = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);

  return (
    <div
      ref={ref}
      className={cn(
        "relative w-full overflow-hidden aspect-[5/2] max-h-[64vh]",
        className
      )}
    >
      <motion.div style={{ y }} className="absolute inset-x-0 -inset-y-[12%]">
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </motion.div>
      {/* Melt into the page, top and bottom. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-b from-transparent to-background"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1/6 bg-gradient-to-t from-transparent to-background"
        aria-hidden
      />
    </div>
  );
}
