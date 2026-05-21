// Browser-side Sentry init. Next.js runs this in the client bundle on every
// page. Captures unhandled errors, unhandled promise rejections, and (with
// browserTracingIntegration) basic page-load performance traces.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Browser performance traces — light sample rate to stay under the free
  // quota. Bump up later once paid plan is in place.
  tracesSampleRate: 0.1,
  // No-op in local dev; only ship from prod/preview deployments.
  enabled: process.env.NODE_ENV === "production",
  integrations: [Sentry.browserTracingIntegration()],
});

// Required so Next.js's client-side navigation transitions get linked to the
// same trace as the underlying page load — gives cleaner waterfalls.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
