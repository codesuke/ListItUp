import assert from "node:assert/strict";

import {
  canAccessWorkspaceSettings,
  canManageWorkspace,
  canViewWorkspaceMembers,
  hasImplicitListAccess,
} from "./workspace-access";

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

  // Every role can see the members list of a SHARED Workspace, but a
  // Personal Space has no members page and non-members get nothing.
  for (const role of ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const) {
    assert.equal(canViewWorkspaceMembers({ role, workspaceKind: "SHARED" }), true);
    assert.equal(canViewWorkspaceMembers({ role, workspaceKind: "PERSONAL" }), false);
  }
  assert.equal(canViewWorkspaceMembers({ role: null, workspaceKind: "SHARED" }), false);

  // Only the Owner has implicit Lead-equivalent access to every List in
  // the Workspace (ADR 0016) — this must mirror resolveListAccess's own
  // inline Owner check exactly.
  assert.equal(hasImplicitListAccess("OWNER"), true);
  assert.equal(hasImplicitListAccess("ADMIN"), false);
  assert.equal(hasImplicitListAccess("MEMBER"), false);
  assert.equal(hasImplicitListAccess("VIEWER"), false);
  assert.equal(hasImplicitListAccess(null), false);
  assert.equal(hasImplicitListAccess(undefined), false);

  console.log("workspace access permissions test passed");
}

run();
