import { randomUUID } from "node:crypto";

import type { PrismaClient, WorkspaceRole } from "@/generated/prisma/client";

export const DEMO_WORKSPACE_NAME = "Product Launch";
const DEMO_MARKETING_LIST_NAME = "Q1 Marketing Plan";

export const DEMO_TEAMMATES = [
  { email: "maya.chen@example.com", name: "Maya Chen" },
  { email: "owen.park@example.com", name: "Owen Park" },
] as const;

export type DemoWorkspaceProvisionResult =
  | "created"
  | "adopted"
  | "already_provisioned"
  | "not_eligible";

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

// A registered User can coincidentally share an email with one of the Demo
// Workspace's fixture teammates (see demo-workspace.test.ts) — deduping by
// userId keeps them from being added as both the Workspace's owner and one
// of its seeded members, which would violate the (workspaceId, userId)
// unique constraint.
function dedupeMembersByUserId<T extends { userId: string; role: WorkspaceRole | "LEAD" | "MEMBER" }>(
  seeds: T[]
): T[] {
  const byUserId = new Map<string, T>();
  for (const seed of seeds) {
    if (!byUserId.has(seed.userId)) {
      byUserId.set(seed.userId, seed);
    }
  }
  return [...byUserId.values()];
}

// Provisions a pre-filled "Product Launch" Workspace for `userId`, so a new
// User has real-looking content to explore before creating anything of
// their own. Idempotent: safe to call on every sign-in (mirrors
// provisionPersonalWorkspace) and safe to re-run in a backfill script.
export async function provisionDemoWorkspace(
  database: PrismaClient,
  userId: string
): Promise<DemoWorkspaceProvisionResult> {
  const user = await database.user.findUnique({ where: { id: userId } });
  if (!user || !user.emailVerified) {
    return "not_eligible";
  }

  // Scoped to OWNER: the fixture teammates below are co-star MEMBERs of
  // every Demo Workspace ever created, so checking membership alone would
  // treat "co-starring in someone else's Demo Workspace" as "already has
  // their own" the moment any Demo Workspace exists system-wide.
  const existingDemoOwnership = await database.workspaceMember.findFirst({
    where: { userId, role: "OWNER", workspace: { isDemo: true } },
  });
  if (existingDemoOwnership) {
    return "already_provisioned";
  }

  // A User who manually ran the old seed-demo-data.ts script before Demo
  // Workspaces existed as a concept already owns a SHARED Workspace with
  // this exact name — adopt it in place instead of creating a duplicate.
  const preExistingWorkspace = await database.workspace.findFirst({
    where: {
      name: DEMO_WORKSPACE_NAME,
      kind: "SHARED",
      isDemo: false,
      members: { some: { userId, role: "OWNER" } },
    },
  });
  if (preExistingWorkspace) {
    await database.workspace.update({
      where: { id: preExistingWorkspace.id },
      data: { isDemo: true },
    });
    return "adopted";
  }

  const [maya, owen] = await Promise.all(
    DEMO_TEAMMATES.map((teammate) =>
      database.user.upsert({
        where: { email: teammate.email },
        update: {},
        create: {
          id: randomUUID(),
          name: teammate.name,
          email: teammate.email,
          emailVerified: true,
        },
      })
    )
  );

  const workspace = await database.workspace.create({
    data: {
      id: randomUUID(),
      name: DEMO_WORKSPACE_NAME,
      kind: "SHARED",
      isDemo: true,
      members: {
        create: dedupeMembersByUserId([
          { id: randomUUID(), userId, role: "OWNER" },
          { id: randomUUID(), userId: maya.id, role: "MEMBER" },
          { id: randomUUID(), userId: owen.id, role: "MEMBER" },
        ]),
      },
      labels: {
        create: [
          { id: randomUUID(), name: "Design" },
          { id: randomUUID(), name: "Backend" },
        ],
      },
    },
    include: { labels: true },
  });
  const designLabel = workspace.labels.find((label) => label.name === "Design")!;
  const backendLabel = workspace.labels.find((label) => label.name === "Backend")!;

  const websiteRelaunch = await database.list.create({
    data: {
      id: randomUUID(),
      workspaceId: workspace.id,
      name: "Website Relaunch",
      members: {
        create: dedupeMembersByUserId([
          { id: randomUUID(), userId, role: "LEAD" },
          { id: randomUUID(), userId: maya.id, role: "MEMBER" },
          { id: randomUUID(), userId: owen.id, role: "MEMBER" },
        ]),
      },
      sections: {
        create: [
          { id: randomUUID(), name: "Backlog", order: 0 },
          { id: randomUUID(), name: "In Progress", order: 1 },
          { id: randomUUID(), name: "Done", order: 2 },
        ],
      },
      customFieldDefinitions: {
        create: [
          { id: randomUUID(), name: "Effort (days)", type: "NUMBER" },
          { id: randomUUID(), name: "Target Env", type: "DROPDOWN", options: ["staging", "production"] },
        ],
      },
    },
    include: { sections: true, customFieldDefinitions: true },
  });
  const backlog = websiteRelaunch.sections.find((s) => s.name === "Backlog")!;
  const inProgress = websiteRelaunch.sections.find((s) => s.name === "In Progress")!;
  const done = websiteRelaunch.sections.find((s) => s.name === "Done")!;
  const effortField = websiteRelaunch.customFieldDefinitions.find((f) => f.name === "Effort (days)")!;
  const targetEnvField = websiteRelaunch.customFieldDefinitions.find((f) => f.name === "Target Env")!;

  const marketingPlan = await database.list.create({
    data: {
      id: randomUUID(),
      workspaceId: workspace.id,
      name: DEMO_MARKETING_LIST_NAME,
      members: {
        create: dedupeMembersByUserId([{ id: randomUUID(), userId, role: "LEAD" }]),
      },
      sections: {
        create: [
          { id: randomUUID(), name: "Ideas", order: 0 },
          { id: randomUUID(), name: "Scheduled", order: 1 },
        ],
      },
    },
    include: { sections: true },
  });
  const ideas = marketingPlan.sections.find((s) => s.name === "Ideas")!;
  const scheduled = marketingPlan.sections.find((s) => s.name === "Scheduled")!;

  const personalInbox = await database.list.findFirst({
    where: { isInbox: true, workspace: { kind: "PERSONAL", members: { some: { userId } } } },
  });

  await database.item.createMany({
    data: [
      {
        id: randomUUID(),
        listId: websiteRelaunch.id,
        sectionId: backlog.id,
        title: "Rewrite homepage hero copy",
        state: "TO_DO",
        priority: "HIGH",
        dueDate: daysFromNow(-2),
        creatorId: maya.id,
      },
      {
        id: randomUUID(),
        listId: websiteRelaunch.id,
        sectionId: backlog.id,
        title: "Audit Lighthouse performance score",
        state: "TO_DO",
        priority: "NORMAL",
        dueDate: daysFromNow(3),
        creatorId: userId,
      },
      {
        id: randomUUID(),
        listId: websiteRelaunch.id,
        sectionId: backlog.id,
        title: "Draft launch announcement email",
        state: "TO_DO",
        priority: "NORMAL",
        dueDate: daysFromNow(4),
        creatorId: userId,
      },
      {
        id: randomUUID(),
        listId: websiteRelaunch.id,
        sectionId: backlog.id,
        title: "Spike: evaluate Contentful",
        state: "ARCHIVED",
        stateBeforeArchive: "TO_DO",
        priority: "LOW",
        creatorId: userId,
      },
      {
        id: randomUUID(),
        listId: websiteRelaunch.id,
        sectionId: inProgress.id,
        title: "Migrate blog to new CMS",
        state: "IN_PROGRESS",
        priority: "NORMAL",
        dueDate: daysFromNow(7),
        creatorId: owen.id,
      },
      {
        id: randomUUID(),
        listId: websiteRelaunch.id,
        sectionId: inProgress.id,
        title: "Fix mobile nav overlap",
        state: "BLOCKED",
        blockerReason: "Waiting on design tokens from Maya",
        priority: "HIGH",
        dueDate: daysFromNow(1),
        creatorId: userId,
      },
      {
        id: randomUUID(),
        listId: websiteRelaunch.id,
        sectionId: done.id,
        title: "Ship pricing page redesign",
        state: "COMPLETE",
        priority: "NORMAL",
        dueDate: daysFromNow(-5),
        creatorId: userId,
      },
      {
        id: randomUUID(),
        listId: marketingPlan.id,
        sectionId: ideas.id,
        title: "Plan social teaser campaign",
        state: "TO_DO",
        priority: "LOW",
        dueDate: daysFromNow(10),
        creatorId: userId,
      },
      {
        id: randomUUID(),
        listId: marketingPlan.id,
        sectionId: scheduled.id,
        title: "Book podcast guest spot",
        state: "TO_DO",
        priority: "LOW",
        creatorId: owen.id,
      },
    ],
  });

  if (personalInbox) {
    await database.item.createMany({
      data: [
        {
          id: randomUUID(),
          listId: personalInbox.id,
          title: "Renew passport",
          state: "TO_DO",
          priority: "HIGH",
          dueDate: daysFromNow(14),
          creatorId: userId,
        },
        {
          id: randomUUID(),
          listId: personalInbox.id,
          title: 'Read "Deep Work"',
          state: "TO_DO",
          priority: "LOW",
          creatorId: userId,
        },
      ],
    });
  }

  const allItems = await database.item.findMany({
    where: { listId: { in: [websiteRelaunch.id, marketingPlan.id, personalInbox?.id ?? ""] } },
    select: { id: true, title: true, listId: true, creatorId: true, dueDate: true },
  });
  const byTitle = (title: string) => allItems.find((item) => item.title === title)!;

  // Everything defaults to assigned-to-owner except the two items given to
  // a teammate below, which exercise Home's "Items I've Assigned" widget.
  const assignToOwen = new Set(["Plan social teaser campaign"]);
  const assignToMaya = new Set(["Draft launch announcement email"]);

  await database.itemAssignee.createMany({
    data: allItems.map((item) => ({
      id: randomUUID(),
      itemId: item.id,
      userId: assignToOwen.has(item.title) ? owen.id : assignToMaya.has(item.title) ? maya.id : userId,
    })),
  });

  await database.itemLabel.createMany({
    data: [
      { id: randomUUID(), itemId: byTitle("Rewrite homepage hero copy").id, labelId: designLabel.id },
      { id: randomUUID(), itemId: byTitle("Fix mobile nav overlap").id, labelId: designLabel.id },
      { id: randomUUID(), itemId: byTitle("Migrate blog to new CMS").id, labelId: backendLabel.id },
    ],
  });

  // Item-detail-drawer facets (#34-#37): custom field values, a
  // cross-item dependency, a team Note with a @Mention, and a private
  // Personal Note — so List View's drawer has something in every tab.
  await database.customFieldValue.createMany({
    data: [
      {
        id: randomUUID(),
        itemId: byTitle("Migrate blog to new CMS").id,
        definitionId: effortField.id,
        value: "5",
      },
      {
        id: randomUUID(),
        itemId: byTitle("Fix mobile nav overlap").id,
        definitionId: targetEnvField.id,
        value: "staging",
      },
    ],
  });

  await database.itemDependency.create({
    data: {
      id: randomUUID(),
      blockerId: byTitle("Migrate blog to new CMS").id,
      blockedId: byTitle("Draft launch announcement email").id,
    },
  });

  const mentionNote = await database.note.create({
    data: {
      id: randomUUID(),
      itemId: byTitle("Fix mobile nav overlap").id,
      authorId: maya.id,
      body: `Pushed the updated design tokens — over to you @${user.name} to wire them in.`,
    },
  });
  await database.mention.create({
    data: { id: randomUUID(), noteId: mentionNote.id, userId },
  });
  await database.note.create({
    data: {
      id: randomUUID(),
      itemId: byTitle("Migrate blog to new CMS").id,
      authorId: owen.id,
      body: "Content migration is about 60% done — remaining posts need category remapping.",
    },
  });

  await database.personalNote.create({
    data: {
      id: randomUUID(),
      itemId: byTitle("Audit Lighthouse performance score").id,
      userId,
      body: "Remember to check mobile Lighthouse scores separately from desktop.",
    },
  });

  await database.starred.create({
    data: { id: randomUUID(), listId: websiteRelaunch.id, userId },
  });

  const blogMigrationNote = await database.note.findFirstOrThrow({
    where: { itemId: byTitle("Migrate blog to new CMS").id, authorId: owen.id },
  });
  const navOverlapItem = byTitle("Fix mobile nav overlap");

  // Updates surface (#41, #49): one Notification per tab this exercises —
  // an unread entry, a read one, a bookmark, an archived entry, and the
  // @Mentioned tab driven by the Note+Mention pair above.
  await database.notification.createMany({
    data: [
      {
        id: randomUUID(),
        recipientId: userId,
        type: "ASSIGNEE_ADDED",
        itemId: navOverlapItem.id,
        actorId: maya.id,
      },
      {
        id: randomUUID(),
        recipientId: userId,
        type: "STATE_CHANGED",
        itemId: byTitle("Migrate blog to new CMS").id,
        actorId: owen.id,
        readAt: daysFromNow(-1),
      },
      {
        id: randomUUID(),
        recipientId: userId,
        type: "NOTE_ADDED",
        itemId: byTitle("Migrate blog to new CMS").id,
        actorId: owen.id,
        noteId: blogMigrationNote.id,
        bookmarkedAt: daysFromNow(-1),
      },
      {
        id: randomUUID(),
        recipientId: userId,
        type: "MENTIONED",
        itemId: navOverlapItem.id,
        actorId: maya.id,
        noteId: mentionNote.id,
      },
      {
        id: randomUUID(),
        recipientId: userId,
        type: "DUE_DATE_REMINDER",
        itemId: navOverlapItem.id,
        dueDateAt: navOverlapItem.dueDate ?? undefined,
        readAt: daysFromNow(-2),
        archivedAt: daysFromNow(-1),
      },
    ],
  });

  // Manage Notifications preferences page: give it one non-default toggle
  // to display instead of every type reading as "on".
  await database.mutedNotificationType.create({
    data: { id: randomUUID(), userId, type: "ASSIGNEE_REMOVED" },
  });

  return "created";
}
