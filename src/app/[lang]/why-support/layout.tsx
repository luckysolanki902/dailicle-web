import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: "Why support The Dailicle?",
    description: "How The Dailicle is made and what one-time reader contributions help cover.",
    alternates: { canonical: "https://www.dailicle.com/why-support" },
    // The explanation is currently written in English. Locale-prefixed routes
    // still work for readers, but should not be submitted as translated pages.
    robots: lang === "en" ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default function WhySupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
