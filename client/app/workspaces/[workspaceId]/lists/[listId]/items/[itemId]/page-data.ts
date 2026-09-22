import type { CustomFieldType, ItemPriority, ItemState, PrismaClient } from "@/generated/prisma/client";
import { getPersonalNote } from "@/lib/item/item-notes";
import { resolveItemAccess } from "@/lib/permissions/item-access";
import { meetsListAccessLevel } from "@/lib/permissions/list-access";

export type CustomFieldDefinitionSummary = {
  id: string;
  name: string;
  type: CustomFieldType;
  options: string[];
};

export type ItemDetailData = {
  itemId: string;
  listId: string;
  workspaceId: string;
  listName: string;
  title: string;
  state: ItemState;
  priority: ItemPriority;
  dueDate: Date | null;
  blockerReason: string | null;
  createdAt: Date;
  sectionId: string | null;
  creatorName: string;
  assignees: { userId: string; name: string }[];
  parent: { id: string; title: string } | null;
  children: { id: string; title: string; state: ItemState }[];
  // >=WRITE: a List Member, Lead, or Workspace Admin/Owner can edit; a
  // List Viewer or Guest gets a read-only surface (#30).
  canEdit: boolean;
  sections: { id: string; name: string }[];
  // List Leads/Members only — a Viewer/Guest can see an Item but isn't a
  // sensible assignee candidate (a UI-level judgment call, not enforced by
  // lib/item/ itself, which doesn't restrict who can be assigned).
  assignableMembers: { userId: string; name: string }[];
  // Labels currently applied, and the Workspace's remaining Labels not yet
  // applied (the "apply existing" candidate pool). Applying is gated the
  // same as canEdit (any List Member); creating a brand-new Label is
  // gated separately by canCreateLabel (Workspace Owner/Admin) (#34).
  labels: { id: string; name: string }[];
  availableLabels: { id: string; name: string }[];
  canCreateLabel: boolean;
  // Custom Field definitions on this Item's List, and this Item's current
  // values keyed by definitionId. Defining a field is Lead/Admin-only
  // (canDefineCustomFields, same threshold as canEdit); setting a value on
  // an existing definition is available to any List Member (canEdit).
  customFieldDefinitions: CustomFieldDefinitionSummary[];
  customFieldValues: Record<string, string>;
  canDefineCustomFields: boolean;
  // Dependencies (#35) — purely informational, cross-List. "blocking" is
  // what this Item blocks; "blockedBy" is what blocks this Item.
  blocking: { id: string; title: string; listId: string }[];
  blockedBy: { id: string; title: string; listId: string }[];
  // Other Items in this same List, excluding ones already linked in
  // either direction — the "add a Dependency" candidate pool for the
  // common case. Cross-List linking still works via the lib/item/
  // functions themselves; this UI list just doesn't offer a cross-List
  // picker yet.
  sameListItems: { id: string; title: string }[];
  // Attachments on this Item (#39), newest first — no preview rendering,
  // just the file name/size and a download link to the storage key.
  attachments: { id: string; fileName: string; sizeBytes: number; uploaderName: string; createdAt: Date }[];
  // Notes (#37), oldest first, with their Mentions resolved to display
  // names. mentionCandidates is the Item's access list per CONTEXT.md's
  // Mention entry (Assignees, and the List's Members/Leads/Viewers/Guests)
  // — the UI's @mention picker; the authoritative check still lives in
  // createNote(), which validates against resolveItemAccess() directly.
  notes: {
    id: string;
    authorName: string;
    body: string;
    createdAt: Date;
    mentions: { userId: string; name: string }[];
  }[];
  mentionCandidates: { userId: string; name: string }[];
  // This User's own Personal Note (#37) — null if they haven't written one,
  // never another User's. Only offered when isAssignee is true.
  personalNote: string | null;
  isAssignee: boolean;
};

// Kept separate from the page component (same rationale as the List page's
// page-data.ts): headers()/session lookup stays in page.tsx so this stays
// testable under plain tsx on an injected PrismaClient.
export async function loadItemDetailData(
  database: PrismaClient,
  input: { userId: string; workspaceId: string; listId: string; itemId: string }
): Promise<ItemDetailData | null> {
  const { userId, workspaceId, listId, itemId } = input;

  const item = await database.item.findUnique({
    where: { id: itemId },
    include: {
      list: true,
      creator: { select: { name: true } },
      assignees: { include: { user: { select: { id: true, name: true } } } },
      parent: { select: { id: true, title: true } },
      children: { select: { id: true, title: true, state: true }, orderBy: { createdAt: "asc" } },
      labels: { include: { label: { select: { id: true, name: true } } } },
      customFieldValues: true,
      blocking: { include: { blocked: { select: { id: true, title: true, listId: true } } } },
      blockedBy: { include: { blocker: { select: { id: true, title: true, listId: true } } } },
      attachments: {
        include: { uploader: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      notes: {
        include: {
          author: { select: { name: true } },
          mentions: { include: { user: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!item || item.listId !== listId || item.list.workspaceId !== workspaceId) {
    return null;
  }

  const access = await resolveItemAccess(database, { userId, itemId });
  if (!meetsListAccessLevel(access, "READ")) {
    return null;
  }

  const [
    sections,
    listMembers,
    allListMembers,
    guests,
    workspaceMembership,
    workspaceLabels,
    customFieldDefinitions,
    otherListItems,
    personalNote,
  ] = await Promise.all([
    database.section.findMany({ where: { listId }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    database.listMember.findMany({
      where: { listId, role: { in: ["LEAD", "MEMBER"] } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    // Unlike assignableMembers above, this includes Viewers too — Mention
    // candidates are anyone with Item access, not just sensible Assignees
    // (CONTEXT.md's Mention entry: Assignees, or the List's
    // Members/Leads/Viewers/Guests).
    database.listMember.findMany({
      where: { listId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    database.guest.findMany({
      where: { listId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    database.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    }),
    database.label.findMany({ where: { workspaceId }, orderBy: { name: "asc" } }),
    database.customFieldDefinition.findMany({ where: { listId }, orderBy: { name: "asc" } }),
    database.item.findMany({
      where: { listId, id: { not: itemId } },
      select: { id: true, title: true },
      orderBy: { createdAt: "asc" },
    }),
    getPersonalNote(database, { actorUserId: userId, itemId }),
  ]);

  const appliedLabelIds = new Set(item.labels.map((itemLabel) => itemLabel.labelId));
  const linkedItemIds = new Set([
    ...item.blocking.map((dependency) => dependency.blocked.id),
    ...item.blockedBy.map((dependency) => dependency.blocker.id),
  ]);

  const mentionCandidatesById = new Map<string, { userId: string; name: string }>();
  for (const assignee of item.assignees) {
    mentionCandidatesById.set(assignee.userId, { userId: assignee.userId, name: assignee.user.name });
  }
  for (const member of allListMembers) {
    mentionCandidatesById.set(member.userId, { userId: member.userId, name: member.user.name });
  }
  for (const guest of guests) {
    mentionCandidatesById.set(guest.userId, { userId: guest.userId, name: guest.user.name });
  }
  mentionCandidatesById.delete(userId);

  return {
    itemId: item.id,
    listId,
    workspaceId,
    listName: item.list.name,
    title: item.title,
    state: item.state,
    priority: item.priority,
    dueDate: item.dueDate,
    blockerReason: item.blockerReason,
    createdAt: item.createdAt,
    sectionId: item.sectionId,
    creatorName: item.creator.name,
    assignees: item.assignees.map((assignee) => ({ userId: assignee.userId, name: assignee.user.name })),
    parent: item.parent,
    children: item.children,
    canEdit: meetsListAccessLevel(access, "WRITE"),
    sections,
    assignableMembers: listMembers.map((member) => ({ userId: member.userId, name: member.user.name })),
    labels: item.labels.map((itemLabel) => ({ id: itemLabel.label.id, name: itemLabel.label.name })),
    availableLabels: workspaceLabels
      .filter((label) => !appliedLabelIds.has(label.id))
      .map((label) => ({ id: label.id, name: label.name })),
    canCreateLabel: workspaceMembership?.role === "OWNER" || workspaceMembership?.role === "ADMIN",
    customFieldDefinitions,
    customFieldValues: Object.fromEntries(item.customFieldValues.map((v) => [v.definitionId, v.value])),
    canDefineCustomFields: meetsListAccessLevel(access, "LEAD"),
    blocking: item.blocking.map((dependency) => dependency.blocked),
    blockedBy: item.blockedBy.map((dependency) => dependency.blocker),
    sameListItems: otherListItems.filter((candidate) => !linkedItemIds.has(candidate.id)),
    attachments: item.attachments.map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      sizeBytes: attachment.sizeBytes,
      uploaderName: attachment.uploader.name,
      createdAt: attachment.createdAt,
    })),
    notes: item.notes.map((note) => ({
      id: note.id,
      authorName: note.author.name,
      body: note.body,
      createdAt: note.createdAt,
      mentions: note.mentions.map((mention) => ({ userId: mention.user.id, name: mention.user.name })),
    })),
    mentionCandidates: [...mentionCandidatesById.values()],
    personalNote: personalNote?.body ?? null,
    isAssignee: item.assignees.some((assignee) => assignee.userId === userId),
  };
}
