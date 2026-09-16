import { expect, test } from "./support/fixtures";

import {
  signUpAndVerify,
  signInWithPassword,
  uniqueTestUser,
} from "./support/auth-flows";
import { waitForMailpitLink } from "./support/mailpit";
import {
  cleanupSeededInvitation,
  seedWorkspaceInvitation,
  type SeededInvitation,
} from "./support/workspace-invitations";

test("a new User signs up from an invitation link and lands in the invited Workspace", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const user = uniqueTestUser("invitee-new");
  let seed: SeededInvitation | undefined;

  try {
    seed = await seedWorkspaceInvitation(user.email, "VIEWER");

    await page.goto(`/accept-invitation?token=${seed.token}`);
    await expect(
      page.getByRole("heading", { name: `Join ${seed.workspaceName}` })
    ).toBeVisible();
    await expect(
      page.getByText(
        `Sign in or create an account with ${user.email} to accept.`
      )
    ).toBeVisible();

    await page.getByRole("link", { name: "Sign up to accept" }).click();
    await expect(page).toHaveURL(/sign-up/);

    const emailField = page.getByLabel("Email");
    await expect(emailField).toHaveValue(user.email);
    await expect(emailField).not.toBeEditable();

    await page.getByLabel("Display Name").fill(user.name);
    await page.getByRole("textbox", { name: "Password" }).fill(user.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/verify-email/);

    // Verifying an invitation-bound sign-up must return the User straight
    // to the invitation, not the default Home destination.
    await page.goto(await waitForMailpitLink(user.email));
    await expect(page).toHaveURL(/accept-invitation/);
    await expect(
      page.getByText(
        `Accept this invitation to start collaborating in ${seed.workspaceName}.`
      )
    ).toBeVisible();

    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/workspaces/${seed.workspaceId}$`)
    );
    await expect(
      page.getByRole("heading", { name: seed.workspaceName })
    ).toBeVisible();
  } finally {
    if (seed) await cleanupSeededInvitation(seed, [user.email]);
  }
});

test("an existing signed-out User accepting an invitation is routed through sign-in back to the Workspace", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);

  const user = uniqueTestUser("invitee-existing");
  let seed: SeededInvitation | undefined;

  try {
    await signUpAndVerify(page, user);
    seed = await seedWorkspaceInvitation(user.email, "MEMBER");

    await context.clearCookies();
    await page.goto(`/accept-invitation?token=${seed.token}`);
    await page.getByRole("link", { name: "Sign in to accept" }).click();
    await expect(page).toHaveURL(/sign-in/);

    await signInWithPassword(page, user);
    await expect(page).toHaveURL(/accept-invitation/);
    await expect(
      page.getByText(
        `Accept this invitation to start collaborating in ${seed.workspaceName}.`
      )
    ).toBeVisible();

    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/workspaces/${seed.workspaceId}$`)
    );
    await expect(
      page.getByRole("heading", { name: seed.workspaceName })
    ).toBeVisible();
  } finally {
    if (seed) await cleanupSeededInvitation(seed, [user.email]);
  }
});
