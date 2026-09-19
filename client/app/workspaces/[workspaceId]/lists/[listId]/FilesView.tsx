import { formatAttachmentSize } from "@/lib/item/item-attachments";
import type { FilesViewEntry } from "@/lib/list/list-files";

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function FilesView({
  entries,
  workspaceId,
  listId,
}: {
  entries: FilesViewEntry[];
  workspaceId: string;
  listId: string;
}) {
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
          className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0 animate-in fade-in-0 slide-in-from-bottom-1 duration-200"
        >
          <div className="min-w-0">
            <a
              href={`/api/workspaces/${workspaceId}/lists/${listId}/items/${entry.itemId}/attachments/${entry.attachmentId}`}
              className="block truncate text-sm text-ink transition-colors duration-150 hover:text-ink hover:underline"
            >
              {entry.fileName}
            </a>
            <a
              href={`/workspaces/${workspaceId}/lists/${listId}/items/${entry.itemId}`}
              className="block truncate text-xs text-ink-muted transition-colors duration-150 hover:text-ink hover:underline"
            >
              {entry.itemTitle}
            </a>
          </div>
          <div className="flex-shrink-0 text-right text-xs text-ink-faint">
            <div>{formatAttachmentSize(entry.sizeBytes)}</div>
            <div>
              {entry.uploaderName} · {formatDate(entry.createdAt)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
