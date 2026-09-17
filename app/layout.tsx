import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import LocaleProvider from "@/components/LocaleProvider";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ai.teosegypt.com";

export const metadata: Metadata = {
  title: {
    default: "Ask-Teos-AI Engine | Secure AI. Official Sources. Competitive Edge.",
    template: "%s | Ask-Teos-AI Engine",
  },
  description:
    "Secure AI content engine with official sources and competitive edge. Built for sovereign enterprises.",
  keywords: [
    "Secure AI",
    "official sources",
    "competitive intelligence",
    "sovereign AI",
    "content engine",
    "Ask-Teos-AI",
    "enterprise AI",
    "AI governance",
  ],
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Ask-Teos-AI Engine",
    title: "Ask-Teos-AI Engine | Secure AI. Official Sources. Competitive Edge.",
    description:
      "Secure AI content engine with official sources and competitive edge. Built for sovereign enterprises.",
    url: siteUrl,
    images: [
      {
        url: `${siteUrl}/og-image.svg`,
        width: 1200,
        height: 630,
        alt: "Ask-Teos-AI Engine | Secure AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ask-Teos-AI Engine | Secure AI. Official Sources. Competitive Edge.",
    description:
      "Secure AI content engine with official sources and competitive edge. Built for sovereign enterprises.",
    images: [`${siteUrl}/og-image.svg`],
    creator: "@king_teos",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  other: {
    "application/ld+json": JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Ask-Teos-AI Engine",
      description:
        "Secure AI content engine with official sources and competitive edge. Built for sovereign enterprises.",
      url: siteUrl,
      applicationCategory: "AI Application",
      operatingSystem: "Web",
      offers: [
        { "@type": "Offer", name: "Pro", price: "29", priceCurrency: "USD" },
        { "@type": "Offer", name: "Agency", price: "69", priceCurrency: "USD" },
        { "@type": "Offer", name: "Lifetime", price: "149", priceCurrency: "USD" },
      ],
      author: {
        "@type": "Organization",
        name: "Teos Network",
        url: siteUrl,
      },
    }),
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth" dir="ltr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Noto+Kufi+Arabic:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-bg antialiased">
        <Providers>
          <LocaleProvider>
            {children}
          </LocaleProvider>
        </Providers>
      </body>
    </html>
  );
}
