import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/seo/site-metadata";

const PRIVATE_PATHS = [
  "/api/",
  "/my-tasks/",
  "/profile/",
  "/settings/",
  "/two-factor/",
  "/updates/",
  "/workspaces/",
  "/accept-invitation/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_PATHS,
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).href,
    host: SITE_URL.origin,
  };
}
