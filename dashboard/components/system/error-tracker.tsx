"use client";

import { useEffect } from "react";
import { logAppError } from "@/app/actions/error-tracking";

/** Mounted once in the root layout — catches errors React's render-boundary misses:
    uncaught exceptions in event handlers/timers, and unhandled promise rejections.
    Paired with app/global-error.tsx (which catches render errors), this is TAWD's
    in-house Sentry-equivalent — built because Sentry's free signup is geo-blocked
    for the founder's account. Renders nothing. */
export function ErrorTracker() {
  useEffect(() => {
    function onError(e: ErrorEvent) {
      logAppError({
        message: e.message || "Unknown window error",
        stack: e.error?.stack,
        severity: "medium",
        context: { url: window.location.href, kind: "window.onerror" },
      });
    }
    function onRejection(e: PromiseRejectionEvent) {
      const reason = e.reason as { message?: string; stack?: string } | string | undefined;
      logAppError({
        message: typeof reason === "string" ? reason : reason?.message ?? "Unhandled promise rejection",
        stack: typeof reason === "object" ? reason?.stack : undefined,
        severity: "medium",
        context: { url: window.location.href, kind: "unhandledrejection" },
      });
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
