import { expect, test } from "./support/fixtures";

import {
  WORKSPACE_HOME_URL,
  signUpAndVerify,
  uniqueTestUser,
} from "./support/auth-flows";
import { pageAlert } from "./support/locators";
import { waitForMailpitLink } from "./support/mailpit";
import { currentTotpCode, enrollTwoFactorViaUI } from "./support/two-factor";

test("a User must acknowledge saved recovery codes before 2FA enrollment confirms", async ({
  page,
}) => {
  // This flow makes several full round trips (sign-up, verify, enable,
  // confirm), and the confirm step alone can wait up to 45s per attempt —
  // give it real headroom under CI load.
  test.setTimeout(120_000);

  const user = uniqueTestUser("two-factor-enroll");
  await signUpAndVerify(page, user);

  const { backupCodes } = await enrollTwoFactorViaUI(page, user.password);
  expect(backupCodes).toHaveLength(10);
});

test("a 2FA-enabled User is challenged at sign-in, and password reset still requires the challenge afterward", async ({
  page,
  context,
}) => {
  // This is the heaviest journey in the suite: enrollment (whose confirm
  // step alone can wait up to 45s per attempt), then a fresh sign-in/
  // reset/challenge cycle — give it real headroom under CI load.
  test.setTimeout(180_000);

  const user = uniqueTestUser("two-factor-challenge");
  await signUpAndVerify(page, user);
  const { secret, backupCodes } = await enrollTwoFactorViaUI(
    page,
    user.password
  );

  // Password sign-in for a 2FA-enabled User must challenge, not grant a session.
  await context.clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("textbox", { name: "Password" }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/two-factor/);
  await expect(
    page.getByRole("heading", { name: "Enter your two-factor code" })
  ).toBeVisible();

  await page.getByLabel("Authenticator code").fill("000000");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(pageAlert(page)).toContainText(
    "That code didn't work. Try again."
  );

  await page
    .getByLabel("Authenticator code")
    .fill(await currentTotpCode(secret));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(WORKSPACE_HOME_URL);

  // Resetting the password must not skip the 2FA challenge on the next sign-in.
  await context.clearCookies();
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText(
    "reset link is on its way"
  );

  const newPassword = "a-brand-new-long-password";
  await page.goto(await waitForMailpitLink(user.email));
  await page.getByRole("textbox", { name: "New password" }).fill(newPassword);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page).toHaveURL(/sign-in/);

  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("textbox", { name: "Password" }).fill(newPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/two-factor/);

  await page
    .getByRole("button", { name: "Use a recovery code instead" })
    .click();
  await expect(page.getByLabel("Recovery code")).toBeVisible();
  await page.getByLabel("Recovery code").fill(backupCodes[0]);
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(WORKSPACE_HOME_URL);
});
