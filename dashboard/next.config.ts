import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Type errors now fail the build (the codebase is type-clean as of the
  // 2026-07 audit). Do NOT re-enable ignoreBuildErrors — fix the types instead.
  typescript: { ignoreBuildErrors: false },

  /* The site was reorganised into sections. These three URLs were live and
     shared before that, so they redirect permanently rather than 404 — a link
     already sent to a clinic has to keep working. */
  async redirects() {
    return [
      { source: "/product", destination: "/products/clinic", permanent: true },
      { source: "/faq", destination: "/resources/faq", permanent: true },
      { source: "/about", destination: "/company/about", permanent: true },

      /* The sub-brands are gone. There is one company and one system, so
         /products/ai was a second page about Sura competing with /ai for the
         same search, and the other two described things the system does not
         need a separate page for. */
      { source: "/products/ai", destination: "/ai", permanent: true },
      { source: "/products/analytics", destination: "/products", permanent: true },
      { source: "/resources/api", destination: "/resources", permanent: true },
    ];
  },
};

export default nextConfig;
