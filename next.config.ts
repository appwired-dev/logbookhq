import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Document vault accepts files up to 10 MB; the default 1 MB rejects
      // most PDF medicals and passport scans.
      bodySizeLimit: "10mb",
    },
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
