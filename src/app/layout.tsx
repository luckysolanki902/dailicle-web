import type { Metadata } from "next";
import { Inter, Merriweather, Space_Grotesk, Lora } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const merriweather = Merriweather({
  weight: ["300", "400", "700", "900"],
  variable: "--font-merriweather",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://dailicle.com'),
  title: {
    default: "The Dailicle - One Transformative Essay Every Day | Deep Reading for Curious Minds",
    template: "%s | The Dailicle"
  },
  description: "Escape doomscrolling with The Dailicle. One deeply researched, AI-powered essay daily on psychology, philosophy, and startup wisdom. Free, no signup, distraction-free reading for ambitious builders and curious minds.",
  keywords: [
    "daily essays",
    "deep reading",
    "distraction-free reading",
    "thoughtful essays",
    "curated daily content",
    "AI-generated essays",
    "personalized learning",
    "long-form articles",
    "daily wisdom",
    "intellectual reading",
    "minimalist reading app",
    "one essay per day",
    "alternatives to doomscrolling",
    "philosophy essays",
    "psychology essays",
    "startup wisdom",
    "deep focus reading",
    "slow web",
    "digital wellbeing",
    "mindful reading"
  ],
  authors: [{ name: "Lucky Solanki" }],
  creator: "Lucky Solanki",
  publisher: "The Dailicle",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://dailicle.com",
    siteName: "The Dailicle",
    title: "The Dailicle - One Transformative Essay Every Day",
    description: "Escape doomscrolling with deeply researched essays on psychology, philosophy, and startup wisdom. Free, no signup required.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "The Dailicle - Daily Essays for Curious Minds",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Dailicle - One Transformative Essay Every Day",
    description: "Escape doomscrolling with deeply researched essays on psychology, philosophy, and startup wisdom.",
    images: ["/og-image.png"],
    creator: "@dailicle",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: "https://dailicle.com",
  },
  verification: {
    google: "google-site-verification-code",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${merriweather.variable} ${spaceGrotesk.variable} ${lora.variable} antialiased transition-colors duration-500`}
      >
        <ThemeProvider>
          <Navbar />
          {children}
          <Footer />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
