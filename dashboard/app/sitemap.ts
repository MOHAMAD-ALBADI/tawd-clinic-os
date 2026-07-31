import type { MetadataRoute } from "next";
import { ROUTES } from "@/lib/site/meta";
import { SECTORS } from "@/lib/site/content/solutions";

/* The sitemap.

   Built from the same two files the pages and the navigation are built from,
   so a route cannot end up in the menu and out of the sitemap. The one thing a
   hand-written sitemap always gets wrong is going stale, and this cannot.

   Only the public company site is listed. The dashboard is behind auth, /book
   and /pay are per-clinic links that belong to the clinic rather than to us,
   and none of them should be in an index. */

const BASE = (process.env.NEXT_PUBLIC_APP_URL ?? "https://tawd-clinic-os.vercel.app").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...ROUTES.map((r) => ({
      url: `${BASE}/${r}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      /* The pages a clinic owner lands on from a search are worth more than the
         ones they reach from the menu once they are already here. */
      priority: r.startsWith("products") || r === "pricing" ? 0.9 : 0.7,
    })),
    ...SECTORS.map((s) => ({
      url: `${BASE}/solutions/${s.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${BASE}/legal/privacy`, lastModified: now, changeFrequency: "yearly" as const, priority: 0.3 },
    { url: `${BASE}/legal/terms`, lastModified: now, changeFrequency: "yearly" as const, priority: 0.3 },
  ];
}
