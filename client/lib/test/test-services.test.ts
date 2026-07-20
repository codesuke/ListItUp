import assert from "node:assert/strict";

import { loadTestServiceConfig } from "./test-services";

assert.throws(
  () => loadTestServiceConfig({}),
  /DATABASE_URL must be set to run the behavior suite\./
);

assert.deepEqual(
  loadTestServiceConfig({
    DATABASE_URL: "postgresql://listitup:listitup@localhost:5432/listitup",
    REDIS_URL: "redis://localhost:6379",
    MAILPIT_API_URL: "http://localhost:8025",
  }),
  {
    databaseUrl: "postgresql://listitup:listitup@localhost:5432/listitup",
    redisUrl: "redis://localhost:6379",
    mailpitApiUrl: "http://localhost:8025",
  }
);

console.log("behavior suite service configuration test passed");
