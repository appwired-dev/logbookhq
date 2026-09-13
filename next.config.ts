import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Document vault + logbook imports; bumped past 10 MB because Numbers/
      // Excel exports of long flight histories can approach 15 MB.
      bodySizeLimit: "25mb",
    },
  },
  // Canonicalise to the apex domain: www serves the same app, so 308-redirect it
  // to non-www (matching the canonical tags) instead of serving a duplicate copy.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.pilotlogbookhq.com" }],
        destination: "https://pilotlogbookhq.com/:path*",
        permanent: true,
      },
    ];
  },
};

// Wrap with Sentry's config — uploads source maps at build time (if
// SENTRY_AUTH_TOKEN is set), tunnels errors through a same-origin route to
// dodge ad-blockers, and a few other niceties.
export default withSentryConfig(config, {
  // From the DSN: org slug and project slug.
  org: "appwired",
  project: "pilotlogbookhq",
  // Quiet down the build logs; show only warnings/errors.
  silent: !process.env.CI,
  // Route /monitoring → Sentry's edge ingest so ad-blockers don't drop client
  // errors. No-op without it, but recommended.
  tunnelRoute: "/monitoring",
  // Don't fail the build if source-map upload fails (e.g., missing auth token).
  // Errors still get reported, just with minified stacktraces.
  widenClientFileUpload: true,
  disableLogger: true,
});
