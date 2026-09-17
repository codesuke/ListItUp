import assert from "node:assert/strict";
import test from "node:test";

import {
  ROOT_METADATA,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  VIEWPORT,
} from "@/lib/seo/site-metadata";

test("root metadata describes ListItUp and its share cards", () => {
  assert.equal(SITE_NAME, "ListItUp");
  assert.equal(SITE_URL.href, "https://listitup.virtunode.tech/");
  assert.match(SITE_DESCRIPTION, /lists/i);
  assert.deepEqual(ROOT_METADATA.title, {
    default: "ListItUp — From scattered to sorted",
    template: "%s | ListItUp",
  });
  assert.equal(ROOT_METADATA.description, SITE_DESCRIPTION);
  assert.equal(ROOT_METADATA.manifest, "/manifest.webmanifest");
  assert.ok(ROOT_METADATA.openGraph && "type" in ROOT_METADATA.openGraph);
  assert.equal(ROOT_METADATA.openGraph.siteName, SITE_NAME);
  assert.equal(ROOT_METADATA.openGraph.type, "website");
  assert.ok(ROOT_METADATA.twitter && "card" in ROOT_METADATA.twitter);
  assert.equal(ROOT_METADATA.twitter.card, "summary_large_image");
  assert.equal(VIEWPORT.themeColor, "#171717");
});
