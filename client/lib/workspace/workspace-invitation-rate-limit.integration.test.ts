import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createRedisWorkspaceInvitationRateLimiter } from "./workspace-invitation-rate-limit";

async function run() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error(
      "REDIS_URL must be set to run workspace invitation rate-limit tests."
    );
  }

  const inviterId = randomUUID();
  const firstInstance = createRedisWorkspaceInvitationRateLimiter(redisUrl);
  const secondInstance = createRedisWorkspaceInvitationRateLimiter(redisUrl);

  try {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      assert.equal(
        await firstInstance.consume(inviterId, randomUUID()),
        true
      );
    }
    assert.equal(
      await secondInstance.consume(inviterId, randomUUID()),
      false,
      "an inviter's limit must be shared across application instances"
    );

    const sharedWorkspaceId = randomUUID();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      assert.equal(
        await firstInstance.consume(randomUUID(), sharedWorkspaceId),
        true
      );
    }
    assert.equal(
      await secondInstance.consume(randomUUID(), sharedWorkspaceId),
      false,
      "a Workspace's limit must be shared across application instances"
    );

    assert.equal(
      await secondInstance.consume(randomUUID(), randomUUID()),
      true,
      "an unrelated inviter and Workspace must not be affected by other limits"
    );
  } finally {
    await Promise.all([firstInstance.close?.(), secondInstance.close?.()]);
  }

  console.log("workspace invitation rate-limit integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
