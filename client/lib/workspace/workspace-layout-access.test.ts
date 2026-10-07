import assert from "node:assert/strict";

import { resolveWorkspaceLayoutRedirectTarget } from "./workspace-layout-access";

function run() {
  assert.equal(
    resolveWorkspaceLayoutRedirectTarget("workspace-1"),
    "/workspaces/workspace-1",
    "a User with a default Workspace is sent there"
  );

  assert.equal(
    resolveWorkspaceLayoutRedirectTarget(null),
    "/",
    "a User with no resolvable Workspace falls back to the root redirect"
  );

  console.log("workspace layout access redirect test passed");
}

run();
