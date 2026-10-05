import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Verifies the hand-written data-repair migration (#103) against a fixture
// covering both repair cases, by running the exact SQL that ships in
// prisma/migrations/*_repair_lead_and_viewer_list_roles/migration.sql — not
// a reimplementation of its logic.
const MIGRATION_DIR_SUFFIX = "_repair_lead_and_viewer_list_roles";

function readMigrationStatements(): string[] {
  const migrationsRoot = path.join(process.cwd(), "prisma", "migrations");
  const dirName = fs.readdirSync(migrationsRoot).find((name) => name.endsWith(MIGRATION_DIR_SUFFIX));
  if (!dirName) {
    throw new Error(`No migration directory ending in "${MIGRATION_DIR_SUFFIX}" found`);
  }

  const sql = fs.readFileSync(path.join(migrationsRoot, dirName, "migration.sql"), "utf8");
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("list role migration integration test skipped: DATABASE_URL is not set");
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

  async function createUser(name: string): Promise<string> {
    const userId = randomUUID();
    createdUserIds.push(userId);
    await prisma.user.create({
      data: { id: userId, name, email: `list-role-migration-${userId}@example.test` },
    });
    return userId;
  }

  try {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Migration Fixture Workspace" } });

    const ownerId = await createUser("Olive Owner");
    const viewerId = await createUser("Vic Viewer");
    const memberId = await createUser("Mo Member");

    await prisma.workspaceMember.createMany({
      data: [
        { id: randomUUID(), workspaceId, userId: ownerId, role: "OWNER" },
        { id: randomUUID(), workspaceId, userId: viewerId, role: "VIEWER" },
        { id: randomUUID(), workspaceId, userId: memberId, role: "MEMBER" },
      ],
    });

    // L1: Lead-less List — only a non-Lead Member row. Expect the Owner
    // backfilled as Lead; the Member row is untouched.
    const leadlessListId = randomUUID();
    await prisma.list.create({ data: { id: leadlessListId, workspaceId, name: "Leadless List" } });
    await prisma.listMember.create({
      data: { id: randomUUID(), listId: leadlessListId, userId: memberId, role: "MEMBER" },
    });

    // L2: a Workspace Viewer is (invalidly) the List's sole Lead. Expect the
    // Viewer downgraded to VIEWER, and — since that strips the List's only
    // Lead — the Owner backfilled as Lead in the same migration run.
    const viewerSoleLeadListId = randomUUID();
    await prisma.list.create({ data: { id: viewerSoleLeadListId, workspaceId, name: "Viewer Sole Lead List" } });
    await prisma.listMember.create({
      data: { id: randomUUID(), listId: viewerSoleLeadListId, userId: viewerId, role: "LEAD" },
    });

    // L3: a Workspace Viewer invalidly holds MEMBER alongside a real Lead.
    // Expect the Viewer downgraded to VIEWER; the real Lead is untouched and
    // no Owner backfill happens (the List already had a Lead).
    const viewerMemberListId = randomUUID();
    await prisma.list.create({ data: { id: viewerMemberListId, workspaceId, name: "Viewer Member List" } });
    await prisma.listMember.create({
      data: { id: randomUUID(), listId: viewerMemberListId, userId: memberId, role: "LEAD" },
    });
    await prisma.listMember.create({
      data: { id: randomUUID(), listId: viewerMemberListId, userId: viewerId, role: "MEMBER" },
    });

    // L4: already healthy — a real Lead, no Viewer rows. Expect no change,
    // and specifically no spurious Owner row inserted.
    const healthyListId = randomUUID();
    await prisma.list.create({ data: { id: healthyListId, workspaceId, name: "Healthy List" } });
    await prisma.listMember.create({
      data: { id: randomUUID(), listId: healthyListId, userId: memberId, role: "LEAD" },
    });

    // L5: Lead-less, and the Owner already holds a non-Lead List row on it.
    // Expect the ON CONFLICT path to promote that existing row to LEAD
    // rather than erroring on the unique (listId, userId) constraint.
    const ownerAlreadyMemberListId = randomUUID();
    await prisma.list.create({ data: { id: ownerAlreadyMemberListId, workspaceId, name: "Owner Already Viewer List" } });
    await prisma.listMember.create({
      data: { id: randomUUID(), listId: ownerAlreadyMemberListId, userId: ownerId, role: "VIEWER" },
    });

    for (const statement of readMigrationStatements()) {
      await prisma.$executeRawUnsafe(statement);
    }

    async function rolesOf(listId: string): Promise<Record<string, string>> {
      const members = await prisma.listMember.findMany({ where: { listId } });
      return Object.fromEntries(members.map((member) => [member.userId, member.role]));
    }

    assert.deepEqual(await rolesOf(leadlessListId), { [ownerId]: "LEAD", [memberId]: "MEMBER" });
    assert.deepEqual(await rolesOf(viewerSoleLeadListId), { [ownerId]: "LEAD", [viewerId]: "VIEWER" });
    assert.deepEqual(await rolesOf(viewerMemberListId), { [memberId]: "LEAD", [viewerId]: "VIEWER" });
    assert.deepEqual(await rolesOf(healthyListId), { [memberId]: "LEAD" });
    assert.deepEqual(await rolesOf(ownerAlreadyMemberListId), { [ownerId]: "LEAD" });

    // No Workspace Viewer holds a LEAD or MEMBER List row anywhere in the fixture.
    const viewerListRoles = await prisma.listMember.findMany({
      where: { userId: viewerId, list: { workspaceId } },
    });
    assert.ok(viewerListRoles.every((row) => row.role === "VIEWER"));
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.listMember.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: createdWorkspaceIds } } });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("list role migration integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
