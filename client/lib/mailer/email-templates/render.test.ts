import assert from "node:assert/strict";

import { renderEmailTemplate } from "./render";

function run() {
  const template = renderEmailTemplate({
    subject: "Confirm your email",
    previewText: "One click to confirm.",
    heading: "Confirm <you>",
    paragraphs: ["Hi Bob & Alice, please confirm.", "This link expires soon."],
    action: {
      label: "Confirm email",
      url: "https://listitup.test/confirm?token=abc",
    },
    footerNote: "If you didn't request this, ignore it.",
  });

  assert.equal(template.subject, "Confirm your email");
  assert.equal(template.previewText, "One click to confirm.");

  assert.ok(
    template.html.includes("&lt;you&gt;"),
    "html must escape HTML-significant characters in heading"
  );
  assert.ok(
    template.html.includes("Bob &amp; Alice"),
    "html must escape ampersands in paragraph text"
  );
  assert.ok(
    template.html.includes('href="https://listitup.test/confirm?token=abc"'),
    "html must include the action url as a link href"
  );
  assert.ok(
    template.html.includes("Confirm email"),
    "html must include the action label"
  );
  assert.ok(
    template.html.includes("If you didn&#39;t request this, ignore it."),
    "html must escape and include the footer note"
  );

  assert.ok(
    template.text.includes("Confirm <you>"),
    "text fallback must not escape plain text"
  );
  assert.ok(
    template.text.includes("Hi Bob & Alice, please confirm."),
    "text fallback must include paragraph content verbatim"
  );
  assert.ok(
    template.text.includes("https://listitup.test/confirm?token=abc"),
    "text fallback must include the raw action url since there is no href in plain text"
  );
  assert.ok(
    !template.text.includes("<html") && !template.text.includes("<p style"),
    "text fallback must not contain the html layout markup"
  );

  console.log("email template render test passed");
}

run();
