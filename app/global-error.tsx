"use client";

// Catches errors that escape the React tree (rare but real). Reports them to
// Sentry before rendering a fallback. Required for Sentry to capture
// crashes at the root level under the App Router.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "2rem",
          textAlign: "center",
          background: "linear-gradient(135deg, #fefcf6 0%, #f4ecdb 100%)",
          color: "#1e293b",
        }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "1rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#64748b", marginBottom: "2rem", maxWidth: 500 }}>
            We&rsquo;ve been notified and are looking into it. Try reloading, or
            email{" "}
            <a href="mailto:support@pilotlogbookhq.com" style={{ color: "#0284c7" }}>
              support@pilotlogbookhq.com
            </a>{" "}
            if it persists.
          </p>
          <a
            href="/"
            style={{
              padding: "0.75rem 1.5rem",
              background: "#0f172a",
              color: "white",
              borderRadius: "0.5rem",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Go home
          </a>
        </div>
      </body>
    </html>
  );
}
