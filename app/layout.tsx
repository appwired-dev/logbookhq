import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Barlow_Condensed } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Self-hosted by next/font — no runtime request to Google.
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
// Condensed display face — cockpit-label voice, used only on the marketing pages.
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  // metadataBase lets Next.js resolve relative OG/Twitter image URLs against
  // the live domain when crawlers fetch them.
  metadataBase: new URL("https://pilotlogbookhq.com"),
  title: "Pilot Logbook HQ — Pilot Logbook for Every Regime",
  description:
    "The pilot logbook that doesn't treat international pilots as second-class. Multi-regime (CA, FAA, EASA, ICAO, and more), clean, $4.99/mo.",
  openGraph: {
    title: "Pilot Logbook HQ — multi-regime pilot logbook",
    description:
      "Log under Canadian, ICAO, FAA, or EASA. Currency that matches your jurisdiction. Clean PDF for the hiring office. $4.99/mo.",
    siteName: "Pilot Logbook HQ",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pilot Logbook HQ — multi-regime pilot logbook",
    description:
      "Log under Canadian, ICAO, FAA, or EASA. Currency that matches your jurisdiction. Clean PDF for the hiring office. $4.99/mo.",
  },
  alternates: {
    canonical: "/",
  },
  // Google Search Console domain ownership (renders <meta name="google-site-verification">).
  verification: {
    google: "iKVGGCyMWsye_ia9_8-GntSvIoLZ49zP4mflB7UEp-U",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Matches --surface-inverse (the app header) so the browser chrome blends in.
  themeColor: "#0b1f3a",
};

// Site-wide identity graph — emitted on every page so Organization + WebSite
// are asserted everywhere (page-level schema references publisher via @id #org).
const SITE_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://pilotlogbookhq.com/#org",
      name: "Pilot Logbook HQ",
      url: "https://pilotlogbookhq.com",
      logo: "https://pilotlogbookhq.com/logo",
    },
    {
      "@type": "WebSite",
      "@id": "https://pilotlogbookhq.com/#website",
      name: "Pilot Logbook HQ",
      url: "https://pilotlogbookhq.com",
      publisher: { "@id": "https://pilotlogbookhq.com/#org" },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable}`}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_LD) }} />
        {children}
        {/* Vercel Analytics — no cookies, no PII, country-level only. Enabled
            in Vercel Dashboard → project → Analytics. Privacy disclosed in /privacy. */}
        <Analytics />
      </body>
    </html>
  );
}
