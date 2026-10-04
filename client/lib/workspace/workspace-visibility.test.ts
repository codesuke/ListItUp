import assert from "node:assert/strict";

import { isDeletedWorkspace } from "./workspace-visibility";

function run(): void {
  assert.equal(isDeletedWorkspace({ deletedAt: null }), false);
  assert.equal(isDeletedWorkspace({ deletedAt: new Date() }), true);

  console.log("workspace visibility test passed");
}

run();
