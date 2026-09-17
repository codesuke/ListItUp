import assert from "node:assert/strict";

import { buildMyTasksFileEntries } from "./item-my-tasks-files";
import type { MyTaskItem } from "./item-my-tasks";

function item(overrides: Partial<MyTaskItem> & Pick<MyTaskItem, "id">): MyTaskItem {
  return {
    title: "Item",
    state: "TO_DO",
    priority: "NORMAL",
    dueDate: null,
    hasParent: false,
    listId: "list-1",
    listName: "List",
    sourceWorkspaceId: "ws-1",
    sourceWorkspaceName: "Marketing",
    sourceWorkspaceKind: "SHARED",
    blockerReason: null,
    attachments: [],
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides,
  };
}

// Flattens attachments across every Item, newest first, tagging each entry
// with the Item's source Workspace so a flat cross-Workspace list can still
// be traced back to where it came from.
{
  const items: MyTaskItem[] = [
    item({
      id: "item-a",
      title: "Campaign brief",
      listId: "list-a",
      sourceWorkspaceId: "ws-1",
      sourceWorkspaceName: "Marketing",
      attachments: [
        { id: "att-1", fileName: "brief.pdf", sizeBytes: 1024, uploaderName: "Riya", createdAt: new Date("2026-09-01T00:00:00.000Z") },
      ],
    }),
    item({
      id: "item-b",
      title: "Personal errand",
      listId: "list-b",
      sourceWorkspaceId: "ws-2",
      sourceWorkspaceName: "Personal Space",
      sourceWorkspaceKind: "PERSONAL",
      attachments: [
        { id: "att-2", fileName: "receipt.png", sizeBytes: 512, uploaderName: "Riya", createdAt: new Date("2026-09-10T00:00:00.000Z") },
        { id: "att-3", fileName: "warranty.pdf", sizeBytes: 2048, uploaderName: "Riya", createdAt: new Date("2026-09-05T00:00:00.000Z") },
      ],
    }),
    item({ id: "item-c", title: "No files", attachments: [] }),
  ];

  const entries = buildMyTasksFileEntries(items);

  assert.deepEqual(
    entries.map((e) => e.attachmentId),
    ["att-2", "att-3", "att-1"]
  );
  assert.equal(entries[0].itemTitle, "Personal errand");
  assert.equal(entries[0].sourceWorkspaceKind, "PERSONAL");
  assert.equal(entries[2].sourceWorkspaceName, "Marketing");
  assert.equal(entries[2].listId, "list-a");
}

console.log("item my-tasks files test passed");
