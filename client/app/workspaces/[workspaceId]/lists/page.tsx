import { notFound } from "next/navigation";
import { Plus, Star } from "lucide-react";

import type { ListStatus } from "@/generated/prisma/client";
import { ADD_BUTTON_PRIMARY } from "@/components/workspace/add-button";
import { DismissOpenDisclosures } from "@/components/workspace/DismissOpenDisclosures";
import { GlobalHeaderActions } from "@/components/workspace/GlobalHeaderActions";
import { FilterToggleLink, OptionsDisclosure } from "@/components/workspace/OptionsDisclosure";
import { countUnreadNotifications } from "@/lib/notification/notification-inbox";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";

import {
  archiveListAction,
  createListAction,
  restoreListAction,
  toggleListStarredAction,
} from "./actions";
import { ListSearchForm } from "./ListSearchForm";
import { loadListBrowsingPageData, type ListBrowsingQuery } from "./page-data";

type Props = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<ListBrowsingQuery>;
};

const STATUS_OPTIONS: { value: ListStatus; label: string }[] = [
  { value: "ON_TRACK", label: "On Track" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DROPPED", label: "Dropped" },
];

const STATUS_LABEL: Record<ListStatus, string> = {
  ON_TRACK: "On Track",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  DROPPED: "Dropped",
};

function listsHref(workspaceId: string, query: ListBrowsingQuery): string {
  const params = new URLSearchParams();
  if (query.tab) params.set("tab", query.tab);
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.member) params.set("member", query.member);
  if (query.starred) params.set("starred", query.starred);
  const search = params.toString();
  return search ? `/workspaces/${workspaceId}/lists?${search}` : `/workspaces/${workspaceId}/lists`;
}

export default async function ListBrowsingPage({ params, searchParams }: Props) {
  const { workspaceId } = await params;
  const query = await searchParams;
  const session = await requireAuthenticatedSession(`/workspaces/${workspaceId}/lists`);

  const [data, unreadNotificationCount] = await Promise.all([
    loadListBrowsingPageData(prisma, session.user.id, workspaceId, query),
    countUnreadNotifications(prisma, session.user.id),
  ]);

  if (!data) {
    notFound();
  }

  const { lists, workspaceMembers, archived, status, search, memberFilter, starredOnly } = data;

  const boundArchive = archiveListAction.bind(null, workspaceId);
  const boundRestore = restoreListAction.bind(null, workspaceId);
  const boundToggleStarred = toggleListStarredAction.bind(null, workspaceId);
  const boundCreate = createListAction.bind(null, workspaceId);

  const statusOptions = [
    { key: "", label: "All Statuses", href: listsHref(workspaceId, { ...query, status: undefined }), active: !status },
    ...STATUS_OPTIONS.map((option) => ({
      key: option.value,
      label: option.label,
      href: listsHref(workspaceId, { ...query, status: option.value }),
      active: status === option.value,
    })),
  ];
  const memberOptions = [
    {
      key: "",
      label: "All Members",
      href: listsHref(workspaceId, { ...query, member: undefined }),
      active: !memberFilter,
    },
    ...workspaceMembers.map((member) => ({
      key: member.userId,
      label: member.name,
      href: listsHref(workspaceId, { ...query, member: member.userId }),
      active: memberFilter === member.userId,
    })),
  ];

  return (
    <div className="flex min-h-screen flex-col animate-in fade-in duration-200">
      <DismissOpenDisclosures />
      <header className="flex h-[60px] flex-shrink-0 items-center justify-between border-b border-line bg-surface-1 px-7">
        <h1 className="text-[13px] font-semibold text-ink">Lists</h1>
        <GlobalHeaderActions
          currentUserName={session.user.name}
          unreadNotificationCount={unreadNotificationCount}
          workspaceId={workspaceId}
        />
      </header>

      <main className="flex-1 bg-canvas px-10 pb-16 pt-8 text-ink">
        <div className="mx-auto max-w-6xl">
          <nav className="mb-6 flex items-center gap-6 border-b border-line">
            <a
              href={`/workspaces/${workspaceId}/lists`}
              className={
                archived
                  ? "border-b-2 border-transparent py-3 text-[13.5px] font-medium text-ink-muted transition-colors duration-150 hover:text-ink"
                  : "border-b-2 border-[#ff6b4a] py-3 text-[13.5px] font-semibold text-ink transition-colors duration-150"
              }
            >
              Lists
            </a>
            <a
              href={`/workspaces/${workspaceId}/lists?tab=archived`}
              className={
                archived
                  ? "border-b-2 border-[#ff6b4a] py-3 text-[13.5px] font-semibold text-ink transition-colors duration-150"
                  : "border-b-2 border-transparent py-3 text-[13.5px] font-medium text-ink-muted transition-colors duration-150 hover:text-ink"
              }
            >
              Archived
            </a>
          </nav>

          {!archived && (
            <form
              action={boundCreate}
              className="mb-6 flex items-center gap-3 border-b border-line px-1 pb-3 transition-colors focus-within:border-[#ff6b4a]/40"
            >
              <Plus className="h-4 w-4 flex-shrink-0 text-[#ff8a70]" />
              <input
                type="text"
                name="name"
                placeholder="New List name"
                required
                className="flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-faint"
              />
              <button type="submit" className={ADD_BUTTON_PRIMARY}>
                Create
              </button>
            </form>
          )}

          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <div className="flex flex-wrap items-center gap-1">
              <OptionsDisclosure
                label="Status"
                currentLabel={STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "All"}
                options={statusOptions}
              />
              <OptionsDisclosure
                label="Member"
                currentLabel={workspaceMembers.find((member) => member.userId === memberFilter)?.name ?? "All"}
                options={memberOptions}
              />
              <FilterToggleLink
                href={listsHref(workspaceId, { ...query, starred: starredOnly ? undefined : "true" })}
                active={starredOnly}
                label="Starred"
              />
            </div>
            <ListSearchForm
              action={`/workspaces/${workspaceId}/lists`}
              tab={archived ? "archived" : ""}
              status={status ?? ""}
              member={memberFilter ?? ""}
              starred={starredOnly ? "true" : ""}
              search={search ?? ""}
            />
          </div>

          {lists.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-line px-4 py-16 text-center text-sm text-ink-muted">
              {archived ? "No archived Lists." : "No Lists match your filters yet."}
            </div>
          ) : (
            <ul className="flex flex-col">
              {lists.map((list) => (
                <li key={list.id} className="group flex items-center gap-3 rounded-[6px] px-2.5 py-2.5 transition-colors duration-150 hover:bg-surface-3">
                  <form action={boundToggleStarred.bind(null, list.id)}>
                    <button
                      type="submit"
                      aria-label={list.isStarredByViewer ? "Unstar List" : "Star List"}
                      className={
                        list.isStarredByViewer
                          ? "flex h-6 w-6 flex-shrink-0 items-center justify-center text-[#ff8a70] transition-colors duration-150"
                          : "flex h-6 w-6 flex-shrink-0 items-center justify-center text-ink-faint transition-colors duration-150 hover:text-ink-muted"
                      }
                    >
                      <Star className="h-4 w-4" fill={list.isStarredByViewer ? "currentColor" : "none"} />
                    </button>
                  </form>

                  <a
                    href={`/workspaces/${workspaceId}/lists/${list.id}`}
                    className="min-w-0 flex-1 transition-colors duration-150 hover:underline"
                  >
                    <div className="truncate text-[14px] text-ink">{list.name}</div>
                    {list.description && (
                      <div className="truncate text-[12.5px] text-ink-muted">{list.description}</div>
                    )}
                  </a>

                  <span className="hidden flex-shrink-0 text-[12.5px] text-ink-muted sm:block">
                    {STATUS_LABEL[list.status]}
                  </span>

                  <span className="hidden flex-shrink-0 text-[12.5px] text-ink-muted sm:block">
                    {list.memberCount} {list.memberCount === 1 ? "member" : "members"}
                  </span>

                  {archived ? (
                    <form action={boundRestore.bind(null, list.id)} className="flex-shrink-0 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      <button
                        type="submit"
                        className="text-[12.5px] text-ink-muted transition-colors duration-150 hover:text-ink"
                      >
                        Restore
                      </button>
                    </form>
                  ) : (
                    <form action={boundArchive.bind(null, list.id)} className="flex-shrink-0 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      <button
                        type="submit"
                        className="text-[12.5px] text-ink-muted transition-colors duration-150 hover:text-ink"
                      >
                        Archive
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
