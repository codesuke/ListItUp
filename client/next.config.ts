import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  // Lets a second `next dev` instance (the browser suite's SMTP-failure
  // project, see client/playwright.config.ts) run against its own build
  // cache instead of racing the primary dev server over `.next`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // The repo root has its own pnpm-lock.yaml for formatting tooling,
  // which makes Next.js infer the wrong workspace root. Pin it to this app.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
