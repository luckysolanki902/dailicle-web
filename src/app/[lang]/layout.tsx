import type { Metadata } from "next";
import { Inter, Merriweather, Space_Grotesk, Lora } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { SupportProvider } from "@/components/support/SupportProvider";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { Analytics } from "@vercel/analytics/next";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { I18nProvider } from "@/i18n/I18nProvider";
import { getMessages } from "@/i18n/getMessages";
import { LOCALES, LOCALE_CODES, isLocale, type Locale } from "@/i18n/config";

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

export function generateStaticParams() {
  return LOCALE_CODES.map((lang) => ({ lang }));
}

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
    types: {
      "application/rss+xml": [
        { url: "https://dailicle.com/feed.xml", title: "The Dailicle – weekly essay" },
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

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const messages = await getMessages(locale);

  return (
    <html lang={LOCALES[locale].htmlLang}>
      <head>
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-X79NX0FTRG"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-X79NX0FTRG');
            `,
          }}
        />
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
        <I18nProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <SupportProvider>
              <Navbar />
              {children}
              <Footer />
              <Analytics />
              <AnalyticsProvider />
            </SupportProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
