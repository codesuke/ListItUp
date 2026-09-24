import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";

import {
  addChildItemAction,
  addItemAssigneeAction,
  addItemDependencyAction,
  addNoteAction,
  applyExistingLabelAction,
  defineCustomFieldAction,
  removeItemAssigneeAction,
  removeItemDependencyAction,
  removeItemLabelAction,
  restoreItemAction,
  setItemCustomFieldValueAction,
  transitionItemStateAction,
  updateItemDetailsAction,
  upsertPersonalNoteAction,
} from "./actions";
import { ItemDetailPanel } from "./ItemDetailPanel";
import { loadItemDetailData } from "./page-data";

type Props = {
  params: Promise<{ workspaceId: string; listId: string; itemId: string }>;
  searchParams: Promise<{ attachmentError?: string }>;
};

export default async function ItemDetailPage({ params, searchParams }: Props) {
  const { workspaceId, listId, itemId } = await params;
  const { attachmentError } = await searchParams;
  const session = await requireAuthenticatedSession(
    `/workspaces/${workspaceId}/lists/${listId}/items/${itemId}`
  );

  const data = await loadItemDetailData(prisma, { userId: session.user.id, workspaceId, listId, itemId });

  if (!data) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-canvas px-10 pb-16 pt-8 text-ink animate-in fade-in duration-200">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-8 flex items-center gap-4">
          <span className="h-px w-14 bg-[#ff6b4a]" />
          <a
            href={`/workspaces/${workspaceId}/lists/${listId}?tab=list`}
            className="font-mono text-xs uppercase tracking-[0.24em] text-[#ff6b4a] transition-colors duration-150 hover:text-[#ff8a70]"
          >
            {"// " + data.listName}
          </a>
        </div>

        <ItemDetailPanel
          data={data}
          attachmentError={attachmentError}
          boundUpdateDetails={updateItemDetailsAction.bind(null, workspaceId, listId, itemId)}
          boundTransition={transitionItemStateAction.bind(null, workspaceId, listId, itemId)}
          boundRestore={restoreItemAction.bind(null, workspaceId, listId, itemId)}
          boundAddAssignee={addItemAssigneeAction.bind(null, workspaceId, listId, itemId)}
          boundRemoveAssignee={(userId) => removeItemAssigneeAction.bind(null, workspaceId, listId, itemId, userId)}
          boundAddChild={addChildItemAction.bind(null, workspaceId, listId, itemId)}
          boundApplyExistingLabel={applyExistingLabelAction.bind(null, workspaceId, listId, itemId)}
          boundRemoveLabel={(labelId) => removeItemLabelAction.bind(null, workspaceId, listId, itemId, labelId)}
          boundSetCustomFieldValue={(definitionId) =>
            setItemCustomFieldValueAction.bind(null, workspaceId, listId, itemId, definitionId)
          }
          boundDefineCustomField={defineCustomFieldAction.bind(null, workspaceId, listId, itemId)}
          boundAddDependency={addItemDependencyAction.bind(null, workspaceId, listId, itemId)}
          boundRemoveDependency={(blockerId, blockedId) =>
            removeItemDependencyAction.bind(null, workspaceId, listId, itemId, blockerId, blockedId)
          }
          boundAddNote={addNoteAction.bind(null, workspaceId, listId, itemId)}
          boundUpsertPersonalNote={upsertPersonalNoteAction.bind(null, workspaceId, listId, itemId)}
        />
      </div>
    </main>
  );
}
