import { formatAttachmentSize } from "@/lib/item/item-attachments";
import { myTaskItemHref, myTaskWorkspaceLabel } from "@/lib/item/item-my-tasks";
import type { MyTasksFileEntry } from "@/lib/item/item-my-tasks-files";

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function FilesView({ entries }: { entries: MyTasksFileEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="mt-10 rounded-lg border border-dashed border-line px-4 py-16 text-center text-sm text-ink-faint">
        No Attachments yet.
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-1 rounded-lg border border-line bg-surface-1 p-4">
      {entries.map((entry) => (
        <div
          key={entry.attachmentId}
          className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0"
        >
          <div className="min-w-0">
            <a
              href={`/api/workspaces/${entry.sourceWorkspaceId}/lists/${entry.listId}/items/${entry.itemId}/attachments/${entry.attachmentId}`}
              className="block truncate text-sm text-ink hover:text-ink hover:underline"
            >
              {entry.fileName}
            </a>
            <a
              href={myTaskItemHref(entry, entry.itemId)}
              className="block truncate text-xs text-ink-muted hover:text-ink hover:underline"
            >
              {entry.itemTitle}
            </a>
          </div>
          <div className="flex-shrink-0 text-right text-xs text-ink-faint">
            <div>{formatAttachmentSize(entry.sizeBytes)}</div>
            <div>
              {entry.uploaderName} · {formatDate(entry.createdAt)}
            </div>
            <div className="font-mono uppercase tracking-wider text-ink-faint">{myTaskWorkspaceLabel(entry)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
