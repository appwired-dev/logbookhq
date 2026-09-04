import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Self-hosted by next/font — no runtime request to Google.
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  // metadataBase lets Next.js resolve relative OG/Twitter image URLs against
  // the live domain when crawlers fetch them.
  metadataBase: new URL("https://pilotlogbookhq.com"),
  title: "Pilot Logbook HQ — Pilot Logbook for Every Regime",
  description:
    "The pilot logbook that doesn't treat international pilots as second-class. Multi-regime (CA, FAA, EASA, ICAO, and more), clean, $3/mo.",
  openGraph: {
    title: "Pilot Logbook HQ — multi-regime pilot logbook",
    description:
      "Log under Canadian, ICAO, FAA, or EASA. Currency that matches your jurisdiction. Clean PDF for the hiring office. $3/mo.",
    url: "https://pilotlogbookhq.com",
    siteName: "Pilot Logbook HQ",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pilot Logbook HQ — multi-regime pilot logbook",
    description:
      "Log under Canadian, ICAO, FAA, or EASA. Currency that matches your jurisdiction. Clean PDF for the hiring office. $3/mo.",
  },
  alternates: {
    canonical: "https://pilotlogbookhq.com",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Matches --surface-inverse (the app header) so the browser chrome blends in.
  themeColor: "#0b1f3a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        {children}
        {/* Vercel Analytics — no cookies, no PII, country-level only. Enabled
            in Vercel Dashboard → project → Analytics. Privacy disclosed in /privacy. */}
        <Analytics />
      </body>
    </html>
  );
}
