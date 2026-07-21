import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createRedisEmailRequestRateLimiter } from "./email-request-rate-limit";

async function run() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL must be set to run email-request rate-limit tests.");
  }

  const recipient = `rate-limit-${randomUUID()}@example.test`;
  const firstInstance = createRedisEmailRequestRateLimiter(redisUrl);
  const secondInstance = createRedisEmailRequestRateLimiter(redisUrl);

  try {
    assert.equal(await firstInstance.consume(recipient, "198.51.100.10"), true);
    assert.equal(
      await secondInstance.consume(recipient, "198.51.100.11"),
      false,
      "a recipient limit must be shared across application instances"
    );

    const ipAddress = `203.0.113.${Number.parseInt(randomUUID().slice(0, 2), 16)}`;
    for (let request = 0; request < 20; request += 1) {
      assert.equal(
        await firstInstance.consume(
          `ip-limit-${request}-${randomUUID()}@example.test`,
          ipAddress
        ),
        true
      );
    }
    assert.equal(
      await secondInstance.consume(`ip-limit-final-${randomUUID()}@example.test`, ipAddress),
      false,
      "an IP address must be limited across application instances"
    );
  } finally {
    await Promise.all([firstInstance.close?.(), secondInstance.close?.()]);
  }

  console.log("email-request rate-limit integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
