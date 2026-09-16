import { expect, test } from "./support/fixtures";

import { WORKSPACE_HOME_URL, uniqueTestUser } from "./support/auth-flows";
import { pageAlert } from "./support/locators";
import { waitForMailpitLink } from "./support/mailpit";

// This spec runs under the "chromium-smtp-failure" project (see
// playwright.config.ts), whose dedicated dev server is started with an
// unreachable SMTP host/port so every send genuinely fails.
const HEALTHY_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173";

test("a User is told to retry when the password reset email cannot be delivered", async ({
  page,
}) => {
  test.setTimeout(60_000);

  // Sign up and verify against the healthy server first: this project's own
  // server has broken SMTP, so it can't deliver the verification email either.
  const user = uniqueTestUser("smtp-failure");
  await page.goto(`${HEALTHY_BASE_URL}/sign-up`);
  await page.getByLabel("Display Name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("textbox", { name: "Password" }).fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/verify-email/);
  await page.goto(await waitForMailpitLink(user.email));
  await expect(page).toHaveURL(WORKSPACE_HOME_URL);

  // Now exercise the broken-SMTP server for the actual scenario under test.
  await page.context().clearCookies();
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(pageAlert(page)).toContainText(
    "We couldn't send that email. Please try again."
  );
});
