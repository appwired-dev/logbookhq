// Browser-side Sentry init. Next.js runs this in the client bundle on every
// page. Captures unhandled errors, unhandled promise rejections, and (with
// browserTracingIntegration) basic page-load performance traces.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // No-op in local dev; only ship from prod/preview deployments.
  enabled: process.env.NODE_ENV === "production",
  // Error capture only. browserTracingIntegration was dropped so the tracing
  // code tree-shakes out of the client bundle that loads on the static
  // marketing/conversion pages (a top Core Web Vitals lever for a tiny SaaS).
  // Web Vitals are still covered by Vercel Analytics. Re-add
  // Sentry.browserTracingIntegration() + tracesSampleRate to restore traces.
  integrations: [],
});

// Required so Next.js's client-side navigation transitions get linked to the
// same trace as the underlying page load — gives cleaner waterfalls.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
