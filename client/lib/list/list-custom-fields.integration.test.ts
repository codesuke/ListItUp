import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createCustomFieldDefinition, updateCustomFieldDefinition } from "./list-custom-fields";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("list custom fields integration test skipped: DATABASE_URL is not set");
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

  async function createUser(): Promise<string> {
    const userId = randomUUID();
    createdUserIds.push(userId);
    await prisma.user.create({
      data: { id: userId, name: "Test User", email: `list-cf-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspaceWithList(): Promise<{ workspaceId: string; listId: string }> {
    const workspaceId = randomUUID();
    const listId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Test Workspace" } });
    await prisma.list.create({ data: { id: listId, workspaceId, name: "Test List" } });
    return { workspaceId, listId };
  }

  async function addWorkspaceMember(
    workspaceId: string,
    userId: string,
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
  ): Promise<void> {
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role } });
  }

  async function addListMember(
    listId: string,
    userId: string,
    role: "LEAD" | "MEMBER" | "VIEWER"
  ): Promise<void> {
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role } });
  }

  try {
    // A List Lead can define a Custom Field.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createUser();
      await addWorkspaceMember(workspaceId, leadId, "MEMBER");
      await addListMember(listId, leadId, "LEAD");

      const result = await createCustomFieldDefinition(prisma, {
        actorUserId: leadId,
        listId,
        name: "Inspection ref",
        type: "TEXT",
      });
      assert.equal(result.status, "created");
    }

    // A Workspace Admin with no explicit List role is forbidden — Admins
    // have no implicit List access (ADR 0016).
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const adminId = await createUser();
      await addWorkspaceMember(workspaceId, adminId, "ADMIN");

      const result = await createCustomFieldDefinition(prisma, {
        actorUserId: adminId,
        listId,
        name: "Clearance (mm)",
        type: "NUMBER",
      });
      assert.equal(result.status, "forbidden");
    }

    // A Workspace Admin explicitly added as List Lead can define a Custom
    // Field like any other Lead.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const adminId = await createUser();
      await addWorkspaceMember(workspaceId, adminId, "ADMIN");
      await addListMember(listId, adminId, "LEAD");

      const result = await createCustomFieldDefinition(prisma, {
        actorUserId: adminId,
        listId,
        name: "Clearance (mm)",
        type: "NUMBER",
      });
      assert.equal(result.status, "created");
    }

    // The Workspace Owner can define a Custom Field without an explicit
    // List role (implicit Lead-equivalent access).
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const ownerId = await createUser();
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");

      const result = await createCustomFieldDefinition(prisma, {
        actorUserId: ownerId,
        listId,
        name: "Torque spec",
        type: "NUMBER",
      });
      assert.equal(result.status, "created");
    }

    // A List Member (not Lead) cannot define a Custom Field.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");

      const result = await createCustomFieldDefinition(prisma, {
        actorUserId: memberId,
        listId,
        name: "Should not exist",
        type: "TEXT",
      });
      assert.deepEqual(result, { status: "forbidden" });
      const definitions = await prisma.customFieldDefinition.findMany({ where: { listId } });
      assert.equal(definitions.length, 0);
    }

    // A DROPDOWN definition requires at least one option.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createUser();
      await addWorkspaceMember(workspaceId, leadId, "MEMBER");
      await addListMember(listId, leadId, "LEAD");

      const rejected = await createCustomFieldDefinition(prisma, {
        actorUserId: leadId,
        listId,
        name: "Review status",
        type: "DROPDOWN",
        options: [],
      });
      assert.deepEqual(rejected, { status: "dropdown-requires-options" });

      const accepted = await createCustomFieldDefinition(prisma, {
        actorUserId: leadId,
        listId,
        name: "Review status",
        type: "DROPDOWN",
        options: ["Needs revision", "Approved"],
      });
      assert.equal(accepted.status, "created");
    }

    // A List Lead can rename a definition and change its options; a List
    // Member cannot.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createUser();
      await addWorkspaceMember(workspaceId, leadId, "MEMBER");
      await addListMember(listId, leadId, "LEAD");
      const created = await createCustomFieldDefinition(prisma, {
        actorUserId: leadId,
        listId,
        name: "Status",
        type: "DROPDOWN",
        options: ["Open"],
      });
      assert.ok(created.status === "created");
      const definitionId = created.status === "created" ? created.definitionId : "";

      const renamed = await updateCustomFieldDefinition(prisma, {
        actorUserId: leadId,
        definitionId,
        name: "Review status",
        options: ["Open", "Closed"],
      });
      assert.deepEqual(renamed, { status: "updated" });
      const definition = await prisma.customFieldDefinition.findUniqueOrThrow({ where: { id: definitionId } });
      assert.equal(definition.name, "Review status");
      assert.deepEqual(definition.options, ["Open", "Closed"]);

      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");
      const forbidden = await updateCustomFieldDefinition(prisma, {
        actorUserId: memberId,
        definitionId,
        name: "Nope",
      });
      assert.deepEqual(forbidden, { status: "forbidden" });
    }

    // Clearing a DROPDOWN definition's options down to none is rejected on
    // update the same way it is on create — the inline edit UI (#60) relies
    // on this to catch an accidental clear-all rather than silently
    // leaving the definition unchanged.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createUser();
      await addWorkspaceMember(workspaceId, leadId, "MEMBER");
      await addListMember(listId, leadId, "LEAD");
      const created = await createCustomFieldDefinition(prisma, {
        actorUserId: leadId,
        listId,
        name: "Severity",
        type: "DROPDOWN",
        options: ["Low", "High"],
      });
      assert.ok(created.status === "created");
      const definitionId = created.status === "created" ? created.definitionId : "";

      const rejected = await updateCustomFieldDefinition(prisma, {
        actorUserId: leadId,
        definitionId,
        name: "Severity",
        options: [],
      });
      assert.deepEqual(rejected, { status: "dropdown-requires-options" });
      const definition = await prisma.customFieldDefinition.findUniqueOrThrow({ where: { id: definitionId } });
      assert.deepEqual(definition.options, ["Low", "High"], "the rejected update leaves existing options untouched");
    }

    // #104 story 5: a Lead is refused with list-archived when creating or
    // updating a Custom Field definition on an archived List.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createUser();
      await addWorkspaceMember(workspaceId, leadId, "MEMBER");
      await addListMember(listId, leadId, "LEAD");

      const created = await createCustomFieldDefinition(prisma, {
        actorUserId: leadId,
        listId,
        name: "Priority",
        type: "TEXT",
      });
      assert.ok(created.status === "created");
      const definitionId = created.status === "created" ? created.definitionId : "";

      await prisma.list.update({ where: { id: listId }, data: { archivedAt: new Date() } });

      assert.deepEqual(
        await createCustomFieldDefinition(prisma, { actorUserId: leadId, listId, name: "New Field", type: "TEXT" }),
        { status: "list-archived" }
      );
      assert.deepEqual(
        await updateCustomFieldDefinition(prisma, { actorUserId: leadId, definitionId, name: "Renamed" }),
        { status: "list-archived" }
      );

      const definition = await prisma.customFieldDefinition.findUniqueOrThrow({ where: { id: definitionId } });
      assert.equal(definition.name, "Priority", "definition must be untouched");
      const definitionCount = await prisma.customFieldDefinition.count({ where: { listId } });
      assert.equal(definitionCount, 1, "no definition may be added");
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.customFieldDefinition.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.listMember.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("list custom fields integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
