import { notFound } from "next/navigation";

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
} from "@/app/workspaces/[workspaceId]/lists/[listId]/items/[itemId]/actions";
import { ItemDetailPanel } from "@/app/workspaces/[workspaceId]/lists/[listId]/items/[itemId]/ItemDetailPanel";
import { loadItemDetailData } from "@/app/workspaces/[workspaceId]/lists/[listId]/items/[itemId]/page-data";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";

import { ItemDrawer } from "../../ItemDrawer";

type Props = {
  params: Promise<{ workspaceId: string; listId: string; itemId: string }>;
};

// Intercepts client-side navigation to an Item from within the List page
// (design-mocks/list-view) and renders it as a slide-out drawer instead of
// a full-page navigation. A hard navigation/refresh to the same URL still
// renders the full page at items/[itemId]/page.tsx — see
// node_modules/next/dist/docs .../intercepting-routes.md.
export default async function ItemDrawerPage({ params }: Props) {
  const { workspaceId, listId, itemId } = await params;
  const session = await requireAuthenticatedSession(`/workspaces/${workspaceId}/lists/${listId}/items/${itemId}`);

  const data = await loadItemDetailData(prisma, { userId: session.user.id, workspaceId, listId, itemId });

  if (!data) {
    notFound();
  }

  const sectionName = data.sections.find((section) => section.id === data.sectionId)?.name ?? "No Section";

  return (
    <ItemDrawer sectionLabel={`Item · ${sectionName}`}>
      <ItemDetailPanel
        data={data}
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
    </ItemDrawer>
  );
}
