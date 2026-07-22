import { expect, test } from "@playwright/test";

const MAILPIT_POLL_ATTEMPTS = 30;
const MAILPIT_POLL_INTERVAL_MS = 250;

type MailpitMessage = { ID?: string; id?: string; To?: Array<{ Address?: string }> };

async function mailpitMessagesFor(email: string): Promise<MailpitMessage[]> {
  const mailpitUrl = process.env.MAILPIT_API_URL;
  if (!mailpitUrl) throw new Error("MAILPIT_API_URL must be set for browser tests.");

  const response = await fetch(`${mailpitUrl}/api/v1/messages`);
  const body = (await response.json()) as { messages?: MailpitMessage[] };
  return body.messages?.filter((message) =>
    message.To?.some((recipient) => recipient.Address === email)
  ) ?? [];
}

async function waitForMailpitLink(email: string, knownMessageIds = new Set<string>()): Promise<string> {
  const mailpitUrl = process.env.MAILPIT_API_URL;
  if (!mailpitUrl) throw new Error("MAILPIT_API_URL must be set for browser tests.");

  for (let attempt = 0; attempt < MAILPIT_POLL_ATTEMPTS; attempt += 1) {
    const message = (await mailpitMessagesFor(email)).find((candidate) => {
      const candidateId = candidate.ID ?? candidate.id;
      return candidateId && !knownMessageIds.has(candidateId);
    });
    const id = message?.ID ?? message?.id;
    if (id) {
      const detail = await fetch(`${mailpitUrl}/api/v1/message/${id}`);
      const content = JSON.stringify(await detail.json());
      const link = content.match(/http:\/\/[^\s"\\]+/);
      if (link) return link[0].replace(/\\u0026/g, "&");
    }
    await new Promise((resolve) => setTimeout(resolve, MAILPIT_POLL_INTERVAL_MS));
  }
  throw new Error(`Mailpit did not receive an authentication link for ${email}.`);
}

test("a User can sign up, verify through Mailpit, and reach My Tasks", async ({ page }) => {
  const email = `browser-${Date.now()}@example.test`;
  await page.goto("/sign-up");
  await page.getByLabel("Display Name").fill("Browser User");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("a-long-browser-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/verify-email/);

  await page.goto(await waitForMailpitLink(email));
  await expect(page).toHaveURL(/my-tasks/);
});

test("a verified User can sign in with a password and a Mailpit magic link", async ({ page, context }) => {
  const email = `browser-sign-in-${Date.now()}@example.test`;
  const password = "a-long-browser-password";

  await page.goto("/sign-up");
  await page.getByLabel("Display Name").fill("Browser Sign In User");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.goto(await waitForMailpitLink(email));
  await expect(page).toHaveURL(/my-tasks/);

  await context.clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/my-tasks/);

  await context.clearCookies();
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Email magic link" }).click();
  await expect(page.getByRole("button", { name: "Send sign-in link" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  const knownMessageIds = new Set(
    (await mailpitMessagesFor(email))
      .map((message) => message.ID ?? message.id)
      .filter((id): id is string => Boolean(id))
  );
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("sign-in link is on its way");
  await page.goto(await waitForMailpitLink(email, knownMessageIds));
  await expect(page).toHaveURL(/my-tasks/);
});
