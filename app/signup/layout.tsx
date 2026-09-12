import type { Metadata } from "next";

// Signup is a real entry/conversion page: give it its own title, description and
// canonical so it indexes cleanly instead of inheriting the homepage canonical.
export const metadata: Metadata = {
  title: "Create your account — Pilot Logbook HQ",
  description:
    "Start your multi-regime pilot logbook free — up to 100 flights, no card required. Import from any format in minutes.",
  alternates: { canonical: "/signup" },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
