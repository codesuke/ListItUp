import assert from "node:assert/strict";

import { ACTIVITY_CATEGORY_TYPES, ACTIVITY_TYPES, describeNotification } from "./notification-inbox";

// Every Activity category maps to at least one NotificationType, and the
// flattened ACTIVITY_TYPES list (used as the Activity tab's base filter)
// excludes DUE_DATE_REMINDER entirely, per #47's explicit scope.
assert.deepEqual(ACTIVITY_CATEGORY_TYPES.assignee, ["ASSIGNEE_ADDED", "ASSIGNEE_REMOVED"]);
assert.deepEqual(ACTIVITY_CATEGORY_TYPES.notes, ["NOTE_ADDED"]);
assert.deepEqual(ACTIVITY_CATEGORY_TYPES.mentions, ["MENTIONED"]);
assert.deepEqual(ACTIVITY_CATEGORY_TYPES.state, ["STATE_CHANGED"]);
assert.deepEqual(ACTIVITY_CATEGORY_TYPES.membership, ["WORKSPACE_MEMBER_REMOVED", "WORKSPACE_ROLE_CHANGED"]);
assert.equal(ACTIVITY_TYPES.includes("DUE_DATE_REMINDER"), false);
assert.equal(ACTIVITY_TYPES.length, 7);

// describeNotification: one line per type, falling back to "Someone" for a
// null actorName (defensive — every Activity-tab type always has an actor).
assert.equal(
  describeNotification({ type: "ASSIGNEE_ADDED", actorName: "Priya" }),
  "Priya assigned you to"
);
assert.equal(
  describeNotification({ type: "ASSIGNEE_REMOVED", actorName: "Priya" }),
  "Priya removed you from"
);
assert.equal(describeNotification({ type: "NOTE_ADDED", actorName: "Priya" }), "Priya added a note on");
assert.equal(describeNotification({ type: "MENTIONED", actorName: "Priya" }), "Priya mentioned you on");
assert.equal(
  describeNotification({ type: "STATE_CHANGED", actorName: "Priya" }),
  "Priya changed the state of"
);
assert.equal(describeNotification({ type: "ASSIGNEE_ADDED", actorName: null }), "Someone assigned you to");
assert.equal(describeNotification({ type: "DUE_DATE_REMINDER", actorName: null }), "Due date approaching for");
assert.equal(
  describeNotification({ type: "WORKSPACE_MEMBER_REMOVED", actorName: "Priya" }),
  "Priya removed you from"
);
assert.equal(describeNotification({ type: "WORKSPACE_ROLE_CHANGED", actorName: "Priya" }), "Priya made you");

console.log("notification-inbox unit tests passed");
