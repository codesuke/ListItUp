import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The repo root has its own pnpm-lock.yaml for tooling (husky, prettier),
  // which makes Next.js infer the wrong workspace root. Pin it to this app.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
