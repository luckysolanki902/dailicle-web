import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feedback - Help Shape The Dailicle",
  description: "Share your thoughts, suggestions, and ideas to help us improve The Dailicle. We value your feedback on our daily essays and reading experience.",
  keywords: [
    "feedback",
    "contact",
    "suggestions",
    "user feedback",
    "improve reading experience",
    "daily essay feedback",
    "content suggestions"
  ],
  openGraph: {
    title: "Feedback - Help Shape The Dailicle",
    description: "Share your thoughts and help us improve the daily reading experience.",
    url: "https://dailicle.com/feedback",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Feedback - Help Shape The Dailicle",
    description: "Share your thoughts and help us improve the daily reading experience.",
  },
  alternates: {
    canonical: "https://dailicle.com/feedback",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function FeedbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
