import type { MetadataRoute } from "next";

import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo/site-metadata";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#171717",
    theme_color: "#FF6B4A",
    categories: ["productivity", "business", "utilities"],
    icons: [
      {
        src: "/brand/listitup-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/listitup-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
