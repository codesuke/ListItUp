import { expect, test } from "./support/fixtures";

import {
  signUpAndVerify,
  signInWithPassword,
  uniqueTestUser,
  WORKSPACE_HOME_URL,
} from "./support/auth-flows";
import { knownMailpitMessageIds, waitForMailpitLink } from "./support/mailpit";
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

test("an Owner invites someone from the members form, the invitee follows the emailed link and accepts, and appears in the members list", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const owner = uniqueTestUser("inviter-owner");
  const invitee = uniqueTestUser("invitee-form");

  // Sign-up provisions a Demo Workspace (kind: SHARED) alongside the
  // Personal Space, with the new User as its Owner — the oldest SHARED
  // membership "/" redirects to, per resolveDefaultWorkspaceId. That makes
  // it the one real, invitable Workspace a freshly signed-up User owns.
  await signUpAndVerify(page, owner);
  await expect(page).toHaveURL(WORKSPACE_HOME_URL);
  const workspaceId = new URL(page.url()).pathname.split("/").pop();
  const membersUrl = `/workspaces/${workspaceId}/settings/members`;

  await page.goto(membersUrl);
  await page.getByLabel("Email").fill(invitee.email);
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(
    page.getByText(`Invitation sent to ${invitee.email}.`)
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: invitee.email })
  ).toBeVisible();

  // Dedup against the invitation email below: once the invitee signs up,
  // a verification email lands in the same inbox and both contain a link.
  const inviteLink = await waitForMailpitLink(invitee.email);
  const knownMessageIds = await knownMailpitMessageIds(invitee.email);

  await page.context().clearCookies();
  await page.goto(inviteLink);
  await expect(page.getByRole("heading", { name: /^Join /u })).toBeVisible();

  await page.getByRole("link", { name: "Sign up to accept" }).click();
  await expect(page).toHaveURL(/sign-up/);

  const emailField = page.getByLabel("Email");
  await expect(emailField).toHaveValue(invitee.email);
  await expect(emailField).not.toBeEditable();

  await page.getByLabel("Display Name").fill(invitee.name);
  await page.getByRole("textbox", { name: "Password" }).fill(invitee.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/verify-email/);

  await page.goto(await waitForMailpitLink(invitee.email, knownMessageIds));
  await expect(page).toHaveURL(/accept-invitation/);
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}$`));

  await page.goto(membersUrl);
  const inviteeRow = page.getByRole("listitem").filter({ hasText: invitee.name });
  await expect(inviteeRow).toBeVisible();
  await expect(inviteeRow.getByText("Member")).toBeVisible();
});
