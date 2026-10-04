import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { DEMO_NOTIFICATION_MINUTE_OFFSETS, pickDemoNotificationPlan } from "./demo-notification-plan";

// Deterministic on userId: provisioning a given User's Demo Workspace twice
// (idempotency check in demo-workspace.test.ts) must not pick two different
// plans for the same id.
const userId = randomUUID();
assert.deepEqual(pickDemoNotificationPlan(userId), pickDemoNotificationPlan(userId));

// Every slot's minutesAgo is a permutation of the fixed offset set — no slot
// is left unset or duplicated, so every generated notification lands at a
// distinct point along the stagger.
const plan = pickDemoNotificationPlan(userId);
const minutesAgoValues = Object.values(plan.minutesAgo);
assert.deepEqual(
  [...minutesAgoValues].sort((a, b) => a - b),
  [...DEMO_NOTIFICATION_MINUTE_OFFSETS].sort((a, b) => a - b)
);

// Every flag is a boolean (structurally a valid pattern) for every slot.
for (const slot of ["assigneeAdded", "stateChanged", "noteAdded", "mentioned", "dueDateReminder"] as const) {
  const flags = plan[slot];
  assert.equal(typeof flags.readAt, "boolean");
  assert.equal(typeof flags.bookmarkedAt, "boolean");
  assert.equal(typeof flags.archivedAt, "boolean");
}

// Across many distinct Users, the plan actually varies — this is what fixes
// the "every sign-up sees byte-identical Updates content" complaint. Not
// every id needs a different plan, but they can't all be the same one.
const sampledPlans = Array.from({ length: 50 }, () => JSON.stringify(pickDemoNotificationPlan(randomUUID())));
assert.ok(
  new Set(sampledPlans).size > 1,
  "pickDemoNotificationPlan should produce more than one distinct plan across many Users"
);

console.log("demo-notification-plan unit tests passed");
