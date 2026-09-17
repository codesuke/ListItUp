import type { Metadata, Viewport } from "next";

export const SITE_NAME = "ListItUp";
export const SITE_URL = new URL("https://listitup.virtunode.tech");
export const SITE_TITLE = "ListItUp — From scattered to sorted";
export const SITE_DESCRIPTION =
  "Capture scattered thoughts, organize them into useful lists, and coordinate the work that follows—alone or with your team.";

export const ROOT_METADATA: Metadata = {
  metadataBase: SITE_URL,
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "list maker",
    "task management",
    "team collaboration",
    "personal organization",
    "work management",
  ],
  creator: "VirtuNode",
  publisher: "VirtuNode",
  category: "productivity",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const VIEWPORT: Viewport = {
  colorScheme: "dark light",
  themeColor: "#171717",
};
