import { expect, test } from "./support/fixtures";

import {
  WORKSPACE_HOME_URL,
  signUp,
  signUpAndVerify,
  uniqueTestUser,
} from "./support/auth-flows";
import { knownMailpitMessageIds, waitForMailpitLink } from "./support/mailpit";

test("a User can sign up, verify through Mailpit, and reach Home", async ({
  page,
}) => {
  const user = uniqueTestUser("browser");

  await signUp(page, user);
  await expect(page).toHaveURL(/verify-email/);

  await page.goto(await waitForMailpitLink(user.email));
  await expect(page).toHaveURL(WORKSPACE_HOME_URL);
});

test("a verified User can sign in with a password and a Mailpit magic link", async ({
  page,
  context,
}) => {
  const user = uniqueTestUser("browser-sign-in");

  await signUpAndVerify(page, user);
  await expect(page).toHaveURL(WORKSPACE_HOME_URL);

  await context.clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("textbox", { name: "Password" }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(WORKSPACE_HOME_URL);

  await context.clearCookies();
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Email magic link" }).click();
  await expect(
    page.getByRole("button", { name: "Send sign-in link" })
  ).toBeVisible();
  await page.getByLabel("Email").fill(user.email);
  const knownMessageIds = await knownMailpitMessageIds(user.email);
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText(
    "sign-in link is on its way"
  );
  await page.goto(await waitForMailpitLink(user.email, knownMessageIds));
  await expect(page).toHaveURL(WORKSPACE_HOME_URL);
});
