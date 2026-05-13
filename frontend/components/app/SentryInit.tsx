"use client";

import { useEffect } from "react";

/**
 * Loads Sentry in the browser when `NEXT_PUBLIC_SENTRY_DSN` is set.
 * Server-side errors are handled separately (optional `SENTRY_DSN` on the API).
 */
export function SentryInit() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    let cancelled = false;
    void import("@sentry/browser").then((Sentry) => {
      if (cancelled) return;
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV,
        tracesSampleRate: 0,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
