import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Type errors now fail the build (the codebase is type-clean as of the
  // 2026-07 audit). Do NOT re-enable ignoreBuildErrors — fix the types instead.
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
