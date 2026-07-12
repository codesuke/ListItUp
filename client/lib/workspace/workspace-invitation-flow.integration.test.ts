import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type {
  Mailer,
  SendEmailInput,
  SendEmailResult,
} from "@/lib/mailer/mailer-core";
import { acceptInvitation } from "./workspace-invitations";

function sessionCookie(response: Response): string | null {
  const setCookie = response.headers.get("set-cookie");

  return setCookie ? setCookie.split(";", 1)[0] : null;
}

function record(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === "object");

  return value as Record<string, unknown>;
}

function extractUrl(text: string): string {
  const match = text.match(/https?:\/\/\S+/);
  assert.ok(match, "email text must contain a link");

  if (!match) {
    throw new Error("no url found in email text");
  }

  return match[0];
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log(
      "workspace invitation flow integration test skipped: DATABASE_URL is not set"
    );
    return;
  }

  const [{ PrismaPg }, { PrismaClient }, { createAuth }] = await Promise.all([
    import("@prisma/adapter-pg"),
    import("@/generated/prisma/client"),
    import("@/lib/auth/auth-core"),
  ]);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const sentEmails: SendEmailInput[] = [];
  const fakeMailer: Mailer = {
    async send(input: SendEmailInput): Promise<SendEmailResult> {
      sentEmails.push(input);
      return { ok: true };
    },
  };
  const auth = createAuth(prisma, fakeMailer);
  const testEmails: string[] = [];
  const testUserIds: string[] = [];
  const password = "a-long-test-password";

  const ownerId = randomUUID();
  const workspaceId = randomUUID();

  async function createInvitation(email: string): Promise<string> {
    const token = randomUUID();
    await prisma.workspaceInvitation.create({
      data: {
        id: randomUUID(),
        workspaceId,
        email,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    return token;
  }

  async function testNewUserSignsUpWithLockedEmailVerifiesAndAccepts() {
    const invitedEmail = `invitee-${randomUUID()}@example.test`;
    testEmails.push(invitedEmail);
    const token = await createInvitation(invitedEmail);
    const callbackURL = `/accept-invitation?token=${token}`;

    const signUpResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          name: "Invited user",
          email: invitedEmail,
          password,
          callbackURL,
        }),
      })
    );
    assert.equal(signUpResponse.status, 200);

    const verificationSend = sentEmails.find(
      (send) => send.to === invitedEmail && send.type === "verification"
    );
    assert.ok(verificationSend);

    const verifyResponse = await auth.handler(
      new Request(extractUrl(verificationSend!.template.text), {
        headers: { origin: "http://localhost:3000" },
        redirect: "manual",
      })
    );
    assert.equal(
      verifyResponse.headers.get("location"),
      callbackURL,
      "verifying must return the User to the accept-invitation page"
    );
    const cookie = sessionCookie(verifyResponse);
    assert.ok(cookie, "verification must sign the invited User in");

    const sessionResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: { cookie: cookie! },
      })
    );
    const user = record(record(await sessionResponse.json()).user);
    testUserIds.push(user.id as string);

    const result = await acceptInvitation(
      prisma,
      token,
      user.id as string,
      user.email as string
    );
    assert.deepEqual(result, { status: "accepted", workspaceId });

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: user.id as string },
      },
    });
    assert.ok(membership);
  }

  async function testExistingUserAcceptsViaInvitationLink() {
    const email = `existing-invitee-${randomUUID()}@example.test`;
    testEmails.push(email);

    await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ name: "Existing invitee", email, password }),
      })
    );
    const verificationSend = sentEmails.find(
      (send) => send.to === email && send.type === "verification"
    );
    const verifyResponse = await auth.handler(
      new Request(extractUrl(verificationSend!.template.text), {
        headers: { origin: "http://localhost:3000" },
        redirect: "manual",
      })
    );
    const cookie = sessionCookie(verifyResponse);
    const sessionResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: { cookie: cookie! },
      })
    );
    const userId = record(record(await sessionResponse.json()).user)
      .id as string;
    testUserIds.push(userId);

    // The User already has an identity; the invitation arrives afterward.
    const token = await createInvitation(email);

    const result = await acceptInvitation(prisma, token, userId, email);
    assert.deepEqual(result, { status: "accepted", workspaceId });
  }

  async function testMismatchedSignedInUserIsBlocked() {
    const invitedEmail = `mismatch-invitee-${randomUUID()}@example.test`;
    testEmails.push(invitedEmail);
    const token = await createInvitation(invitedEmail);

    const otherEmail = `signed-in-as-${randomUUID()}@example.test`;
    testEmails.push(otherEmail);
    await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          name: "Someone else",
          email: otherEmail,
          password,
        }),
      })
    );
    const verificationSend = sentEmails.find(
      (send) => send.to === otherEmail && send.type === "verification"
    );
    const verifyResponse = await auth.handler(
      new Request(extractUrl(verificationSend!.template.text), {
        headers: { origin: "http://localhost:3000" },
        redirect: "manual",
      })
    );
    const cookie = sessionCookie(verifyResponse);
    const sessionResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: { cookie: cookie! },
      })
    );
    const otherUser = record(record(await sessionResponse.json()).user);
    testUserIds.push(otherUser.id as string);

    const result = await acceptInvitation(
      prisma,
      token,
      otherUser.id as string,
      otherUser.email as string
    );
    assert.deepEqual(result, { status: "email-mismatch" });

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: otherUser.id as string,
        },
      },
    });
    assert.equal(
      membership,
      null,
      "a mismatched signed-in User must not be added as a Workspace member"
    );
  }

  try {
    await prisma.user.create({
      data: {
        id: ownerId,
        name: "Workspace owner",
        email: `owner-${randomUUID()}@example.test`,
      },
    });
    await prisma.workspace.create({
      data: { id: workspaceId, name: "Launch Team", ownerId },
    });

    await testNewUserSignsUpWithLockedEmailVerifiesAndAccepts();
    await testExistingUserAcceptsViaInvitationLink();
    await testMismatchedSignedInUserIsBlocked();
  } finally {
    await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
    await prisma.workspaceInvitation.deleteMany({ where: { workspaceId } });
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, ...testUserIds] } },
    });
    await prisma.verificationEmailThrottle.deleteMany({
      where: { identifier: { in: testEmails } },
    });
    await prisma.$disconnect();
  }

  console.log("workspace invitation flow integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
