import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { type DependencyLinkedItem, loadItemDetailData } from "./page-data";

// Narrows an accessible DependencyLinkedItem to its title, failing loudly
// if the fixture didn't expect an opaque placeholder here.
function accessibleTitle(entry: DependencyLinkedItem): string {
  assert.ok(entry.accessible, "expected an accessible dependency, got the opaque placeholder");
  return entry.title;
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("Item detail page smoke test skipped: DATABASE_URL is not set");
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
    await prisma.user.create({ data: { id: userId, name, email: `item-detail-${userId}@example.test` } });
    return userId;
  }

  async function createWorkspaceWithList(): Promise<{ workspaceId: string; listId: string }> {
    const workspaceId = randomUUID();
    const listId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Test Workspace" } });
    await prisma.list.create({ data: { id: listId, workspaceId, name: "Platform Retrofit" } });
    return { workspaceId, listId };
  }

  try {
    // A List Member sees the full detail surface — title, Section,
    // Assignees, Priority, due date, state, Blocker reason, Creator — and
    // can edit.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser("Maya Torres");
      await prisma.workspaceMember.create({
        data: { id: randomUUID(), workspaceId, userId: memberId, role: "MEMBER" },
      });
      await prisma.listMember.create({
        data: { id: randomUUID(), listId, userId: memberId, role: "MEMBER" },
      });
      const sectionId = randomUUID();
      await prisma.section.create({ data: { id: sectionId, listId, name: "In Progress", order: 0 } });
      const assigneeId = await createUser("Riya Kapoor");

      const item = await prisma.item.create({
        data: {
          id: randomUUID(),
          listId,
          sectionId,
          title: "Review load tables",
          creatorId: memberId,
          priority: "HIGH",
          state: "BLOCKED",
          blockerReason: "Waiting on vendor",
          assignees: { create: [{ id: randomUUID(), userId: assigneeId }] },
        },
      });

      const data = await loadItemDetailData(prisma, {
        userId: memberId,
        workspaceId,
        listId,
        itemId: item.id,
      });

      assert.ok(data, "expected detail data for a List Member");
      assert.equal(data!.title, "Review load tables");
      assert.equal(data!.priority, "HIGH");
      assert.equal(data!.state, "BLOCKED");
      assert.equal(data!.blockerReason, "Waiting on vendor");
      assert.equal(data!.sectionId, sectionId);
      assert.equal(data!.creatorName, "Maya Torres");
      assert.deepEqual(data!.assignees.map((a) => a.name), ["Riya Kapoor"]);
      assert.equal(data!.canEdit, true);
      assert.deepEqual(data!.assignableMembers.map((m) => m.userId), [memberId]);
    }

    // A List Viewer can see the Item but cannot edit it.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const viewerId = await createUser();
      await prisma.workspaceMember.create({
        data: { id: randomUUID(), workspaceId, userId: viewerId, role: "MEMBER" },
      });
      await prisma.listMember.create({
        data: { id: randomUUID(), listId, userId: viewerId, role: "VIEWER" },
      });
      const creatorId = await createUser();
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Read-only for Viewer", creatorId },
      });

      const data = await loadItemDetailData(prisma, { userId: viewerId, workspaceId, listId, itemId: item.id });

      assert.ok(data);
      assert.equal(data!.canEdit, false);
    }

    // A User with no access to the List gets no data at all.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const creatorId = await createUser();
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Private", creatorId },
      });
      const strangerId = await createUser();

      const data = await loadItemDetailData(prisma, {
        userId: strangerId,
        workspaceId,
        listId,
        itemId: item.id,
      });
      assert.equal(data, null);
    }

    // Parent/children relationships surface correctly.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await prisma.workspaceMember.create({
        data: { id: randomUUID(), workspaceId, userId: memberId, role: "MEMBER" },
      });
      await prisma.listMember.create({
        data: { id: randomUUID(), listId, userId: memberId, role: "MEMBER" },
      });
      const parent = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Parent", creatorId: memberId },
      });
      const child = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Child", creatorId: memberId, parentId: parent.id },
      });

      const parentData = await loadItemDetailData(prisma, {
        userId: memberId,
        workspaceId,
        listId,
        itemId: parent.id,
      });
      assert.ok(parentData);
      assert.deepEqual(parentData!.children.map((c) => c.title), ["Child"]);

      const childData = await loadItemDetailData(prisma, {
        userId: memberId,
        workspaceId,
        listId,
        itemId: child.id,
      });
      assert.ok(childData);
      assert.equal(childData!.parent?.title, "Parent");
    }

    // Applied Labels and Custom Field values render, with the eligible
    // pools and create/define affordances gated correctly (#34).
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await prisma.workspaceMember.create({
        data: { id: randomUUID(), workspaceId, userId: memberId, role: "MEMBER" },
      });
      await prisma.listMember.create({
        data: { id: randomUUID(), listId, userId: memberId, role: "MEMBER" },
      });
      const appliedLabel = await prisma.label.create({
        data: { id: randomUUID(), workspaceId, name: "Structural" },
      });
      const otherLabel = await prisma.label.create({
        data: { id: randomUUID(), workspaceId, name: "Vendor" },
      });
      const definition = await prisma.customFieldDefinition.create({
        data: { id: randomUUID(), listId, name: "Clearance (mm)", type: "NUMBER" },
      });
      const item = await prisma.item.create({
        data: {
          id: randomUUID(),
          listId,
          title: "Has facets",
          creatorId: memberId,
          labels: { create: [{ id: randomUUID(), labelId: appliedLabel.id }] },
          customFieldValues: { create: [{ id: randomUUID(), definitionId: definition.id, value: "1240" }] },
        },
      });

      const data = await loadItemDetailData(prisma, { userId: memberId, workspaceId, listId, itemId: item.id });

      assert.ok(data);
      assert.deepEqual(data!.labels.map((l) => l.name), ["Structural"]);
      assert.deepEqual(data!.availableLabels, [{ id: otherLabel.id, name: "Vendor" }]);
      assert.equal(data!.canCreateLabel, false, "a plain Member is not Workspace Owner/Admin");
      assert.deepEqual(data!.customFieldDefinitions.map((d) => d.name), ["Clearance (mm)"]);
      assert.equal(data!.customFieldValues[definition.id], "1240");
      assert.equal(data!.canDefineCustomFields, false, "a plain Member is not a List Lead");

      // A Workspace Admin can create Labels and a List Lead can define
      // Custom Fields.
      const adminId = await createUser();
      await prisma.workspaceMember.create({
        data: { id: randomUUID(), workspaceId, userId: adminId, role: "ADMIN" },
      });
      await prisma.listMember.create({
        data: { id: randomUUID(), listId, userId: adminId, role: "LEAD" },
      });
      const adminData = await loadItemDetailData(prisma, {
        userId: adminId,
        workspaceId,
        listId,
        itemId: item.id,
      });
      assert.ok(adminData);
      assert.equal(adminData!.canCreateLabel, true);
      assert.equal(adminData!.canDefineCustomFields, true);
    }

    // Dependencies render in both directions, including across Lists, and
    // sameListItems excludes Items already linked (#35).
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await prisma.workspaceMember.create({
        data: { id: randomUUID(), workspaceId, userId: memberId, role: "MEMBER" },
      });
      await prisma.listMember.create({
        data: { id: randomUUID(), listId, userId: memberId, role: "MEMBER" },
      });
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Middle Item", creatorId: memberId },
      });
      const upstream = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Upstream blocker", creatorId: memberId },
      });
      const otherListId = randomUUID();
      const otherWorkspaceId = randomUUID();
      await prisma.workspace.create({ data: { id: otherWorkspaceId, name: "Other Workspace" } });
      await prisma.list.create({ data: { id: otherListId, workspaceId: otherWorkspaceId, name: "Other List" } });
      // Linking across Lists requires WRITE on both sides (createDependency),
      // so memberId needs access here too for the rendered title/listId to
      // show rather than the #107 opaque placeholder.
      await prisma.workspaceMember.create({
        data: { id: randomUUID(), workspaceId: otherWorkspaceId, userId: memberId, role: "MEMBER" },
      });
      await prisma.listMember.create({
        data: { id: randomUUID(), listId: otherListId, userId: memberId, role: "MEMBER" },
      });
      const downstream = await prisma.item.create({
        data: { id: randomUUID(), listId: otherListId, title: "Downstream, cross-List", creatorId: memberId },
      });
      const unrelated = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Unrelated", creatorId: memberId },
      });

      await prisma.itemDependency.create({
        data: { id: randomUUID(), blockerId: upstream.id, blockedId: item.id },
      });
      await prisma.itemDependency.create({
        data: { id: randomUUID(), blockerId: item.id, blockedId: downstream.id },
      });

      const data = await loadItemDetailData(prisma, { userId: memberId, workspaceId, listId, itemId: item.id });

      assert.ok(data);
      assert.deepEqual(data!.blockedBy.map(accessibleTitle), ["Upstream blocker"]);
      assert.deepEqual(data!.blocking.map(accessibleTitle), ["Downstream, cross-List"]);
      const crossListBlocking = data!.blocking[0];
      assert.ok(crossListBlocking?.accessible);
      assert.equal(crossListBlocking.listId, otherListId, "cross-List Dependencies keep their own listId");
      assert.deepEqual(
        data!.sameListItems,
        [{ id: unrelated.id, title: "Unrelated" }],
        "already-linked Items are excluded from the same-List candidate pool"
      );

      await prisma.workspace.deleteMany({ where: { id: otherWorkspaceId } });
    }

    // #107 story 7: a cross-List blocking/blockedBy Item in a List the
    // viewer can't read renders as an opaque placeholder — the dependency
    // row is still included, just with its title/listId withheld.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await prisma.workspaceMember.create({
        data: { id: randomUUID(), workspaceId, userId: memberId, role: "MEMBER" },
      });
      await prisma.listMember.create({
        data: { id: randomUUID(), listId, userId: memberId, role: "MEMBER" },
      });
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Visible item", creatorId: memberId },
      });

      const privateWorkspaceId = randomUUID();
      const privateListId = randomUUID();
      createdWorkspaceIds.push(privateWorkspaceId);
      await prisma.workspace.create({ data: { id: privateWorkspaceId, name: "Private Workspace" } });
      await prisma.list.create({ data: { id: privateListId, workspaceId: privateWorkspaceId, name: "Private List" } });
      const otherCreatorId = await createUser();
      const privateBlocker = await prisma.item.create({
        data: { id: randomUUID(), listId: privateListId, title: "Private blocker", creatorId: otherCreatorId },
      });
      const privateBlocked = await prisma.item.create({
        data: { id: randomUUID(), listId: privateListId, title: "Private blocked", creatorId: otherCreatorId },
      });

      await prisma.itemDependency.create({
        data: { id: randomUUID(), blockerId: privateBlocker.id, blockedId: item.id },
      });
      await prisma.itemDependency.create({
        data: { id: randomUUID(), blockerId: item.id, blockedId: privateBlocked.id },
      });

      const data = await loadItemDetailData(prisma, { userId: memberId, workspaceId, listId, itemId: item.id });

      assert.ok(data);
      assert.deepEqual(data!.blockedBy, [{ id: privateBlocker.id, accessible: false }]);
      assert.deepEqual(data!.blocking, [{ id: privateBlocked.id, accessible: false }]);
    }

    // Attachments render newest first with uploader name and size (#39).
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser("Priya Nair");
      await prisma.workspaceMember.create({
        data: { id: randomUUID(), workspaceId, userId: memberId, role: "MEMBER" },
      });
      await prisma.listMember.create({
        data: { id: randomUUID(), listId, userId: memberId, role: "MEMBER" },
      });
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Item with files", creatorId: memberId },
      });
      await prisma.attachment.create({
        data: {
          id: randomUUID(),
          itemId: item.id,
          uploaderId: memberId,
          fileName: "spec-v1.pdf",
          contentType: "application/pdf",
          sizeBytes: 1024,
          storageKey: `items/${item.id}/${randomUUID()}-spec-v1.pdf`,
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await prisma.attachment.create({
        data: {
          id: randomUUID(),
          itemId: item.id,
          uploaderId: memberId,
          fileName: "spec-v2.pdf",
          contentType: "application/pdf",
          sizeBytes: 2048,
          storageKey: `items/${item.id}/${randomUUID()}-spec-v2.pdf`,
        },
      });

      const data = await loadItemDetailData(prisma, { userId: memberId, workspaceId, listId, itemId: item.id });

      assert.ok(data);
      assert.deepEqual(
        data!.attachments.map((attachment) => attachment.fileName),
        ["spec-v2.pdf", "spec-v1.pdf"],
        "newest Attachment first"
      );
      assert.equal(data!.attachments[0].sizeBytes, 2048);
      assert.equal(data!.attachments[0].uploaderName, "Priya Nair");
    }

    // Notes render oldest first with their Mentions resolved, mention
    // candidates cover Assignees/Members/Viewers (excluding the
    // viewer themselves), and a Personal Note is visible only to its
    // owning Assignee (#37).
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser("Dana Wu");
      await prisma.workspaceMember.create({
        data: { id: randomUUID(), workspaceId, userId: memberId, role: "MEMBER" },
      });
      await prisma.listMember.create({
        data: { id: randomUUID(), listId, userId: memberId, role: "MEMBER" },
      });
      const viewerId = await createUser("Val Ortiz");
      await prisma.workspaceMember.create({
        data: { id: randomUUID(), workspaceId, userId: viewerId, role: "MEMBER" },
      });
      await prisma.listMember.create({
        data: { id: randomUUID(), listId, userId: viewerId, role: "VIEWER" },
      });
      const assigneeId = await createUser("Amir Khan");
      await prisma.workspaceMember.create({
        data: { id: randomUUID(), workspaceId, userId: assigneeId, role: "MEMBER" },
      });
      await prisma.listMember.create({
        data: { id: randomUUID(), listId, userId: assigneeId, role: "MEMBER" },
      });

      const item = await prisma.item.create({
        data: {
          id: randomUUID(),
          listId,
          title: "Item with Notes",
          creatorId: memberId,
          assignees: { create: [{ id: randomUUID(), userId: assigneeId }] },
        },
      });
      const note = await prisma.note.create({
        data: { id: randomUUID(), itemId: item.id, authorId: memberId, body: "Please review." },
      });
      await prisma.mention.create({ data: { id: randomUUID(), noteId: note.id, userId: viewerId } });
      await prisma.personalNote.create({
        data: { id: randomUUID(), itemId: item.id, userId: assigneeId, body: "Remember to double-check totals." },
      });

      const memberData = await loadItemDetailData(prisma, { userId: memberId, workspaceId, listId, itemId: item.id });
      assert.ok(memberData);
      assert.deepEqual(memberData!.notes.map((n) => n.body), ["Please review."]);
      assert.deepEqual(memberData!.notes[0].mentions.map((m) => m.name), ["Val Ortiz"]);
      assert.deepEqual(
        memberData!.mentionCandidates.map((c) => c.userId).sort(),
        [viewerId, assigneeId].sort(),
        "mention candidates exclude the current viewer but include the Assignee and List Viewer"
      );
      assert.equal(memberData!.isAssignee, false);
      assert.equal(memberData!.personalNote, null, "a non-Assignee sees no Personal Note");

      const assigneeData = await loadItemDetailData(prisma, {
        userId: assigneeId,
        workspaceId,
        listId,
        itemId: item.id,
      });
      assert.ok(assigneeData);
      assert.equal(assigneeData!.isAssignee, true);
      assert.equal(assigneeData!.personalNote, "Remember to double-check totals.");
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.itemAssignee.deleteMany({ where: { item: { listId: { in: listIds } } } });
    await prisma.item.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.section.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.listMember.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("Item detail page smoke test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
