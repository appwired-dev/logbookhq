import type { Metadata } from "next";

// Login is a utility page: keep it out of the index (it earns no rankings and
// would only dilute crawl budget) but follow links so it still passes equity.
export const metadata: Metadata = {
  title: "Sign in — Pilot Logbook HQ",
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
