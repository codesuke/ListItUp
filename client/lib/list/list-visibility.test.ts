import assert from "node:assert/strict";

import { isListArchived } from "./list-visibility";

function run(): void {
  assert.equal(isListArchived({ archivedAt: null }), false);
  assert.equal(isListArchived({ archivedAt: new Date() }), true);

  console.log("list visibility test passed");
}

run();
