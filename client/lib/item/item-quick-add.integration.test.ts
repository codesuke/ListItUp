import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createItemFromQuickAdd, loadQuickAddMentionCandidates } from "./item-quick-add";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("item quick-add integration test skipped: DATABASE_URL is not set");
    return;
  }

  const [{ PrismaPg }, { PrismaClient }] = await Promise.all([
    import("@prisma/adapter-pg"),
    import("@/generated/prisma/client"),
  ]);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const createdUserIds: string[] = [];
  const createdWorkspaceIds: string[] = [];

  async function createUser(name = "Test User"): Promise<string> {
    const userId = randomUUID();
    createdUserIds.push(userId);
    await prisma.user.create({
      data: { id: userId, name, email: `quick-add-${userId}@example.test` },
    });
    return userId;
  }

  async function createPersonalWorkspaceWithInbox(userId: string): Promise<{ workspaceId: string; inboxListId: string }> {
    const workspaceId = randomUUID();
    const inboxListId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({
      data: {
        id: workspaceId,
        name: "Personal Space",
        kind: "PERSONAL",
        members: { create: [{ id: randomUUID(), userId, role: "OWNER" }] },
        lists: { create: [{ id: inboxListId, name: "Inbox", isInbox: true }] },
      },
    });
    return { workspaceId, inboxListId };
  }

  // List access requires a ListMember row, not just Workspace membership
  // (ADR 0009 — see lib/permissions/list-access.ts's resolveListAccess).
  // `listRole` of `null` creates a Workspace member with no List-level role
  // at all, i.e. no List access.
  async function createSharedList(name: string, userId: string, listRole: "MEMBER" | "VIEWER" | null) {
    const workspaceId = randomUUID();
    const listId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({
      data: {
        id: workspaceId,
        name: `${name} Workspace`,
        members: { create: [{ id: randomUUID(), userId, role: "MEMBER" }] },
        lists: { create: [{ id: listId, name }] },
      },
    });
    if (listRole) {
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role: listRole } });
    }
    return { workspaceId, listId };
  }

  try {
    // No `~list` shorthand → the Item lands in the User's Inbox List.
    {
      const userId = await createUser();
      const { inboxListId } = await createPersonalWorkspaceWithInbox(userId);

      const result = await createItemFromQuickAdd(prisma, { actorUserId: userId, text: "Buy milk" });
      assert.equal(result.status, "created");
      const itemId = result.status === "created" ? result.itemId : "";
      const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.listId, inboxListId);
      assert.equal(item.title, "Buy milk");

      // No `@assignee` shorthand → defaults to the actor, so the Item
      // actually shows up back in the My Tasks view it was captured from.
      const assignees = await prisma.itemAssignee.findMany({ where: { itemId } });
      assert.deepEqual(assignees.map((assignee) => assignee.userId), [userId]);
    }

    // A `~list` shorthand naming a List the User can write to is used
    // instead of the Inbox List.
    {
      const userId = await createUser();
      await createPersonalWorkspaceWithInbox(userId);
      const { listId: engineeringListId } = await createSharedList("Engineering", userId, "MEMBER");

      const result = await createItemFromQuickAdd(prisma, {
        actorUserId: userId,
        text: "Fix the bug ~Engineering",
      });
      assert.equal(result.status, "created");
      const itemId = result.status === "created" ? result.itemId : "";
      const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.listId, engineeringListId);
      assert.equal(item.title, "Fix the bug");
    }

    // No `~list` shorthand, but My Tasks' own Workspace filter is scoped to
    // a shared Workspace — the Item lands in that Workspace's List, not the
    // Personal Space Inbox, matching what the User was actually looking at.
    {
      const userId = await createUser();
      const { inboxListId } = await createPersonalWorkspaceWithInbox(userId);
      const { workspaceId: engineeringWorkspaceId, listId: engineeringListId } = await createSharedList(
        "Engineering",
        userId,
        "MEMBER"
      );

      const result = await createItemFromQuickAdd(prisma, {
        actorUserId: userId,
        text: "Buy milk",
        scopedWorkspaceId: engineeringWorkspaceId,
      });
      assert.equal(result.status, "created");
      const itemId = result.status === "created" ? result.itemId : "";
      const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.listId, engineeringListId);
      assert.notEqual(item.listId, inboxListId);
    }

    // An explicit `~list` shorthand still overrides the scoped Workspace —
    // typing a List name is a more specific instruction than the ambient
    // "Workspace" filter.
    {
      const userId = await createUser();
      const { workspaceId: engineeringWorkspaceId } = await createSharedList("Engineering", userId, "MEMBER");
      const { workspaceId: designWorkspaceId, listId: designListId } = await createSharedList(
        "Design",
        userId,
        "MEMBER"
      );

      const result = await createItemFromQuickAdd(prisma, {
        actorUserId: userId,
        text: "Review the draft ~Design",
        scopedWorkspaceId: engineeringWorkspaceId,
      });
      assert.equal(result.status, "created");
      const itemId = result.status === "created" ? result.itemId : "";
      const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.listId, designListId);
      assert.notEqual(designWorkspaceId, engineeringWorkspaceId);
    }

    // Scoped to a Workspace where the User has no writable List (their only
    // List access there is read-only, as a Viewer) — rejected with its own
    // status rather than silently falling back to an unrelated Workspace.
    {
      const userId = await createUser();
      await createPersonalWorkspaceWithInbox(userId);
      const { workspaceId: readOnlyWorkspaceId } = await createSharedList("ReadOnly", userId, "VIEWER");

      const result = await createItemFromQuickAdd(prisma, {
        actorUserId: userId,
        text: "Buy milk",
        scopedWorkspaceId: readOnlyWorkspaceId,
      });
      assert.deepEqual(result, { status: "no-writable-list" });
    }

    // List-name matching is case-insensitive.
    {
      const userId = await createUser();
      await createPersonalWorkspaceWithInbox(userId);
      const { listId: engineeringListId } = await createSharedList("Engineering", userId, "MEMBER");

      const result = await createItemFromQuickAdd(prisma, {
        actorUserId: userId,
        text: "Fix the bug ~engineering",
      });
      assert.equal(result.status, "created");
      const itemId = result.status === "created" ? result.itemId : "";
      const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.listId, engineeringListId);
    }

    // A `~list` shorthand naming a List the User only has read access to
    // (a Viewer) falls back to the Inbox List rather than failing outright.
    {
      const userId = await createUser();
      const { inboxListId } = await createPersonalWorkspaceWithInbox(userId);
      await createSharedList("ReadOnly", userId, "VIEWER");

      const result = await createItemFromQuickAdd(prisma, {
        actorUserId: userId,
        text: "Peek at this ~ReadOnly",
      });
      assert.equal(result.status, "created");
      const itemId = result.status === "created" ? result.itemId : "";
      const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.listId, inboxListId);
    }

    // `@assignee` resolves against a Workspace member of the target List
    // and is attached at creation, through createItem's own assigneeUserIds
    // — no parallel assignment path.
    {
      const userId = await createUser();
      await createPersonalWorkspaceWithInbox(userId);
      const { listId, workspaceId } = await createSharedList("Design", userId, "MEMBER");
      const assigneeId = await createUser("Jane Doe");
      await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId: assigneeId, role: "MEMBER" } });

      const result = await createItemFromQuickAdd(prisma, {
        actorUserId: userId,
        text: `Review the draft @${"Jane"} ~Design`,
      });
      assert.equal(result.status, "created");
      const itemId = result.status === "created" ? result.itemId : "";
      const assignees = await prisma.itemAssignee.findMany({ where: { itemId } });
      assert.deepEqual(assignees.map((assignee) => assignee.userId), [assigneeId]);
      const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.listId, listId);
    }

    // An `@assignee` name that doesn't match any Workspace member is
    // silently dropped rather than failing Item creation — and since that
    // leaves no assignee resolved, the actor-default fallback still applies.
    {
      const userId = await createUser();
      await createPersonalWorkspaceWithInbox(userId);

      const result = await createItemFromQuickAdd(prisma, {
        actorUserId: userId,
        text: "Solo task @nobody-like-this",
      });
      assert.equal(result.status, "created");
      const itemId = result.status === "created" ? result.itemId : "";
      const assignees = await prisma.itemAssignee.findMany({ where: { itemId } });
      assert.deepEqual(assignees.map((assignee) => assignee.userId), [userId]);
    }

    // `#label` resolves against an existing Label in the target List's
    // Workspace and is applied via lib/item/item-labels.ts's applyLabel.
    {
      const userId = await createUser();
      await createPersonalWorkspaceWithInbox(userId);
      const { listId, workspaceId } = await createSharedList("Ops", userId, "MEMBER");
      const label = await prisma.label.create({ data: { id: randomUUID(), workspaceId, name: "urgent" } });

      const result = await createItemFromQuickAdd(prisma, {
        actorUserId: userId,
        text: "Page the on-call #URGENT ~Ops",
      });
      assert.equal(result.status, "created");
      const itemId = result.status === "created" ? result.itemId : "";
      const itemLabels = await prisma.itemLabel.findMany({ where: { itemId } });
      assert.deepEqual(itemLabels.map((itemLabel) => itemLabel.labelId), [label.id]);
      const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.listId, listId);
    }

    // A `#label` name that doesn't match any existing Label in the
    // Workspace is silently dropped, not auto-created.
    {
      const userId = await createUser();
      await createPersonalWorkspaceWithInbox(userId);

      const result = await createItemFromQuickAdd(prisma, {
        actorUserId: userId,
        text: "Solo task #does-not-exist",
      });
      assert.equal(result.status, "created");
      const itemId = result.status === "created" ? result.itemId : "";
      const itemLabels = await prisma.itemLabel.findMany({ where: { itemId } });
      assert.equal(itemLabels.length, 0);
    }

    // A due-date shorthand is applied to the created Item.
    {
      const userId = await createUser();
      await createPersonalWorkspaceWithInbox(userId);

      const now = new Date("2026-09-16T12:00:00.000Z");
      const result = await createItemFromQuickAdd(prisma, {
        actorUserId: userId,
        text: "File taxes 2026-10-01",
        now,
      });
      assert.equal(result.status, "created");
      const itemId = result.status === "created" ? result.itemId : "";
      const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.dueDate?.toISOString(), "2026-10-01T00:00:00.000Z");
    }

    // Shorthand tokens with nothing left over are rejected before touching
    // the database.
    {
      const userId = await createUser();
      await createPersonalWorkspaceWithInbox(userId);

      const result = await createItemFromQuickAdd(prisma, { actorUserId: userId, text: "@alex #bug" });
      assert.deepEqual(result, { status: "empty-title" });
    }

    // Quick-Add's `@name` autocomplete suggests every teammate across every
    // Workspace the User belongs to, deduped by User even when they share
    // more than one Workspace with the actor — and never a User the actor
    // shares no Workspace with at all.
    {
      const userId = await createUser();
      const { workspaceId: workspaceA } = await createSharedList("Design", userId, "MEMBER");
      const { workspaceId: workspaceB } = await createSharedList("Ops", userId, "MEMBER");

      const teammateId = await createUser("Jane Doe");
      await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId: workspaceA, userId: teammateId, role: "MEMBER" } });
      await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId: workspaceB, userId: teammateId, role: "MEMBER" } });

      const strangerId = await createUser("Not Shared");
      await createSharedList("Elsewhere", strangerId, "MEMBER");

      const candidates = await loadQuickAddMentionCandidates(prisma, userId);
      assert.deepEqual(
        candidates.map((candidate) => candidate.id).sort(),
        [userId, teammateId].sort()
      );
      assert.equal(candidates.some((candidate) => candidate.id === strangerId), false);
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.itemLabel.deleteMany({ where: { item: { listId: { in: listIds } } } });
    await prisma.itemAssignee.deleteMany({ where: { item: { listId: { in: listIds } } } });
    await prisma.item.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.label.deleteMany({ where: { workspaceId: { in: createdWorkspaceIds } } });
    await prisma.listMember.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: createdWorkspaceIds } } });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("item quick-add integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
