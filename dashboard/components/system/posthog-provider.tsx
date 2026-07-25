"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

/* Product analytics — no-ops entirely if the key isn't configured, so this is safe
   to ship even before the founder finishes the PostHog signup. Free-tier, no card. */
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

let initialized = false;

export function PostHogProvider() {
  useEffect(() => {
    if (!KEY || initialized) return;
    posthog.init(KEY, {
      api_host: HOST,
      capture_pageview: false, // fired manually below (App Router has no route-change event)
      capture_pageleave: true,
      person_profiles: "identified_only", // stay anonymous unless we explicitly identify
    });
    initialized = true;
  }, []);

  if (!KEY) return null;
  return (
    <Suspense fallback={null}>
      <PageViewTracker />
    </Suspense>
  );
}

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!KEY || !initialized) return;
    const url = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
