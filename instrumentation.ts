// Next.js auto-runs this on server boot (Node.js and Edge runtimes). We
// dispatch to the right Sentry init based on which runtime is loading.
//
// Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      // Sample rate for performance traces. 0.1 = 10%, plenty for a small SaaS;
      // bump down if Sentry quota gets tight.
      tracesSampleRate: 0.1,
      // Don't spam Sentry in local dev — only ship errors from prod/preview.
      enabled: process.env.NODE_ENV === "production",
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      enabled: process.env.NODE_ENV === "production",
    });
  }
}

// Forwards request errors (route handlers, server actions) to Sentry. Required
// for Sentry to capture errors thrown in the server-side request lifecycle.
export const onRequestError = Sentry.captureRequestError;
