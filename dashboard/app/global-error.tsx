"use client";

import { useEffect } from "react";
import { logAppError } from "@/app/actions/error-tracking";

/* Next.js special file: catches React render errors that escape the root layout.
   Must define its own <html>/<body> since it replaces the whole tree. Part of
   TAWD's in-house error tracker (see components/system/error-tracker.tsx). */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logAppError({
      message: error.message,
      stack: error.stack,
      severity: "high",
      context: { digest: error.digest, kind: "react-render-error", url: typeof window !== "undefined" ? window.location.href : undefined },
    });
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          background: "#0a0a0b", color: "#f4f4f5", fontFamily: "system-ui, sans-serif",
          display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", margin: 0,
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem" }}>حدث خطأ غير متوقع</p>
          <p style={{ fontSize: "0.85rem", color: "#a1a1aa", marginBottom: "1.25rem" }}>تم إبلاغ الفريق تلقائياً — جرّب مرة أخرى</p>
          <button
            onClick={() => reset()}
            style={{
              background: "var(--accent-1)", color: "#0a0a0b", border: "none", padding: "0.6rem 1.5rem",
              borderRadius: "0.75rem", fontWeight: 700, cursor: "pointer",
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
