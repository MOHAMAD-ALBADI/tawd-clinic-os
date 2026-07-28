"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

/* Product analytics — no-ops entirely if the key isn't configured, so this is safe
   to ship even before the founder finishes the PostHog signup. Free-tier, no card. */
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

let initialized = false;

/* Identifiers never leave the building.

   Half the routes in a clinic system carry a patient's id — /reception/patients/…,
   /accountant/patients/…, /doctor/patients/… — and this was sending the whole
   path to a third party. A uuid is not a name, but it is a stable handle on one
   real patient, and shipping a stream of them to an outside processor is exactly
   the thing a health system must not do casually. Which SCREEN was opened is the
   useful signal; whose record it was is nobody's business but the clinic's.

   The same masking covers invoice and appointment ids, which are equally
   re-identifiable against the clinic's own data. */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function maskPath(path: string): string {
  return path
    .replace(UUID, ":id")
    /* Long digit runs are ids too — and a phone number typed into a URL would be
       one of them. */
    .replace(/\/\d{4,}(?=\/|$)/g, "/:id");
}

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
    /* Only the parameters that describe the VIEW travel — the finance period and
       nothing else. A query string is a good place for a search term to end up,
       and forwarding it wholesale is how a patient's name reaches an analytics
       vendor without anyone deciding to send it. */
    const keep = new URLSearchParams();
    for (const k of ["period", "tab"]) {
      const v = searchParams.get(k);
      if (v) keep.set(k, v);
    }
    const qs = keep.toString();
    posthog.capture("$pageview", {
      $current_url: qs ? `${maskPath(pathname)}?${qs}` : maskPath(pathname),
    });
  }, [pathname, searchParams]);

  return null;
}
