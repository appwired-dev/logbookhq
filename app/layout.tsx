import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Vercel Analytics — no cookies, no PII, country-level only. Enabled
            in Vercel Dashboard → project → Analytics. Privacy disclosed in /privacy. */}
        <Analytics />
      </body>
    </html>
  );
}
