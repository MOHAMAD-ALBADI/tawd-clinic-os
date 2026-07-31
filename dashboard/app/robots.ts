import type { MetadataRoute } from "next";

const BASE = (process.env.NEXT_PUBLIC_APP_URL ?? "https://tawd-clinic-os.vercel.app").replace(/\/$/, "");

/* robots.txt

   Everything behind auth is already unreachable to a crawler, so this is not a
   security control — it is there so the paths never appear in an index by way
   of a link someone pasted, and so crawl budget goes to the pages meant to be
   found.

   /book and /pay are excluded for a different reason: those URLs belong to a
   clinic and its patient. A booking link surfacing in a search result is a
   privacy problem, not an SEO one. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/login",
          "/auth/",
          "/clinic-admin/",
          "/platform-admin/",
          "/doctor/",
          "/reception/",
          "/accountant/",
          "/profile/",
          "/book/",
          "/pay/",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
