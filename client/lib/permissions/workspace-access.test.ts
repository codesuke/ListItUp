import assert from "node:assert/strict";

import { canAccessWorkspaceSettings, canManageWorkspace } from "./workspace-access";

function run() {
  // Owner and Admin can manage a Workspace; Member, Viewer, and no
  // membership at all cannot.
  assert.equal(canManageWorkspace("OWNER"), true);
  assert.equal(canManageWorkspace("ADMIN"), true);
  assert.equal(canManageWorkspace("MEMBER"), false);
  assert.equal(canManageWorkspace("VIEWER"), false);
  assert.equal(canManageWorkspace(null), false);
  assert.equal(canManageWorkspace(undefined), false);

  // Settings access requires both a manager-tier role AND a SHARED
  // Workspace — a Personal Space's sole Owner has nothing to manage there.
  assert.equal(
    canAccessWorkspaceSettings({ role: "OWNER", workspaceKind: "SHARED" }),
    true
  );
  assert.equal(
    canAccessWorkspaceSettings({ role: "ADMIN", workspaceKind: "SHARED" }),
    true
  );
  assert.equal(
    canAccessWorkspaceSettings({ role: "MEMBER", workspaceKind: "SHARED" }),
    false
  );
  assert.equal(
    canAccessWorkspaceSettings({ role: "OWNER", workspaceKind: "PERSONAL" }),
    false,
    "a Personal Space's Owner has no Workspace Settings page to manage"
  );

  console.log("workspace access permissions test passed");
}

run();
