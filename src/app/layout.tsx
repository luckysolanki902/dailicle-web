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
    default: "The Dailicle - One Essay a Week, Written to Be Read Slowly",
    template: "%s | The Dailicle"
  },
  description: "A weekly essay on the mind, meaning, money, and how to live. Carefully researched, free to read, nothing to sign up for - a new one every Monday.",
  keywords: [
    "weekly essay",
    "deep reading",
    "distraction-free reading",
    "thoughtful essays",
    "long-form articles",
    "intellectual reading",
    "one essay a week",
    "alternatives to doomscrolling",
    "philosophy essays",
    "psychology essays",
    "essays about money",
    "essays about life",
    "slow web",
    "digital wellbeing",
    "mindful reading"
  ],
  authors: [{ name: "The Dailicle Desk" }],
  creator: "The Dailicle",
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
    title: "The Dailicle - One Essay a Week, Written to Be Read Slowly",
    description: "A weekly essay on the mind, meaning, money, and how to live. Free to read, nothing to sign up for - a new one every Monday.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "The Dailicle - One Essay a Week",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Dailicle - One Essay a Week, Written to Be Read Slowly",
    description: "A weekly essay on the mind, meaning, money, and how to live. A new one every Monday.",
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
    types: {
      "application/rss+xml": [
        { url: "https://dailicle.com/feed.xml", title: "The Dailicle — weekly essay" },
      ],
    },
  },
  verification: {
    google: "google-site-verification-code",
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'icon', url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { rel: 'icon', url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "uga30fkmri");
            `,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${merriweather.variable} ${spaceGrotesk.variable} ${lora.variable} antialiased transition-colors duration-500`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "The Dailicle",
              url: "https://dailicle.com",
              logo: "https://dailicle.com/logo.png",
              description:
                "A weekly essay on the mind, meaning, money, and how to live. Written to be read slowly.",
            }),
          }}
        />
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
