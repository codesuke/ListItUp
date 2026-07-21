import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createRedisProgressiveSignInRateLimiter } from "./progressive-sign-in-rate-limit";

async function run() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error(
      "REDIS_URL must be set to run progressive sign-in rate-limit tests."
    );
  }

  const identity = `rate-limit-${randomUUID()}@example.test`;
  const ipAddress = `test-ip-${randomUUID()}`;
  const firstInstance = createRedisProgressiveSignInRateLimiter(redisUrl);
  const secondInstance = createRedisProgressiveSignInRateLimiter(redisUrl);

  try {
    assert.equal(await firstInstance.isRestricted(identity, ipAddress), false);

    for (let failure = 0; failure < 5; failure += 1) {
      await firstInstance.recordFailure({
        identity,
        ipAddress,
        kind: "two-factor",
      });
    }

    assert.equal(
      await secondInstance.isRestricted(identity, ipAddress),
      true,
      "five two-factor failures must create a restriction shared by application instances"
    );

    const warningIdentity = `warning-${randomUUID()}@example.test`;
    for (let failure = 0; failure < 9; failure += 1) {
      const { shouldWarn } = await firstInstance.recordFailure({
        identity: warningIdentity,
        ipAddress: `203.0.113.${failure}`,
        kind: "password",
        verifiedUser: true,
      });
      assert.equal(shouldWarn, false);
    }
    assert.equal(
      (
        await secondInstance.recordFailure({
          identity: warningIdentity,
          ipAddress: "203.0.113.10",
          kind: "password",
          verifiedUser: true,
        })
      ).shouldWarn,
      true,
      "the tenth failed password attempt must request one warning"
    );
    assert.equal(
      (
        await firstInstance.recordFailure({
          identity: warningIdentity,
          ipAddress: "203.0.113.11",
          kind: "password",
          verifiedUser: true,
        })
      ).shouldWarn,
      false,
      "a verified User must receive at most one warning per day"
    );
  } finally {
    await Promise.all([firstInstance.close?.(), secondInstance.close?.()]);
  }

  console.log("progressive sign-in rate-limit integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
