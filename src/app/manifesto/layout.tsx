import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Our Manifesto - Why Read Dailicle?",
  description: "The Dailicle manifesto: a rebellion against the noise. Learn why we publish one deeply researched essay a week, no algorithms, no infinite scrolls.",
  keywords: [
    "slow web manifesto",
    "digital wellbeing",
    "mindful reading",
    "anti-doomscrolling",
    "distraction-free reading",
    "philosophy of reading",
    "deep work",
    "intentional content consumption",
    "scarcity creates value",
    "reading philosophy"
  ],
  openGraph: {
    title: "Our Manifesto - Why Read Dailicle? | The Slow Web Movement",
    description: "A rebellion against the noise. One essay a week. No recommendations. No infinite scroll. Just deep, thoughtful reading.",
    url: "https://dailicle.com/manifesto",
    type: "article",
    images: [
      {
        url: "/og-manifesto.png",
        width: 1200,
        height: 630,
        alt: "The Dailicle Manifesto - The Slow Web",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Our Manifesto - Why Read Dailicle?",
    description: "A rebellion against the noise. One essay a week. No recommendations. No infinite scroll.",
    images: ["/og-manifesto.png"],
  },
  alternates: {
    canonical: "https://dailicle.com/manifesto",
  },
};

export default function ManifestoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
