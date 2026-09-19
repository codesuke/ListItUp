import { ArrowLeft, ArrowRight, ChevronDown, Lock, Plus } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";

import { MemberAvatar } from "@/components/workspace/MemberAvatar";
import { StatusBadge, type StatusBadgeTone } from "@/components/workspace/StatusBadge";
import { formatAttachmentSize } from "@/lib/item/item-attachments";

import type { ItemDetailData } from "./page-data";
import { StatePillControl } from "./StatePillControl";

const FIELD_LABEL_CLASS =
  "font-[family-name:var(--font-mono-label)] text-[10.5px] uppercase tracking-[0.08em] text-ink-faint";
const CHIP_CLASS =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line-strong bg-surface-3 px-2.5 py-1 text-[12px] text-ink-muted animate-in fade-in-0 zoom-in-95 duration-150";
// self-stretch (not a fixed height) so this always matches the rendered
// height of the input/select it sits beside in a flex row, regardless of
// that row's font size or padding — a fixed h-6 drifted out of sync with
// INPUT_CLASS and looked visibly shorter than its sibling control. Sits at
// the same bg-surface-3 elevation as INPUT_CLASS below, one step up from
// GHOST_BUTTON_CLASS's resting state, since it doubles as this row's submit.
const SMALL_ICON_BTN_CLASS =
  "flex w-8 flex-shrink-0 items-center justify-center self-stretch rounded-[6px] border border-line-strong bg-surface-3 text-ink-muted transition-colors duration-150 hover:bg-surface-4 hover:text-ink";
const INPUT_CLASS =
  "rounded-[6px] border border-line-strong bg-surface-3 px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink-faint transition-colors duration-150 focus:border-[#ff6b4a] focus:outline-none";
// Secondary actions (Attach, Link, Add Note, Archive, Restore, …). A filled
// surface, not just a border on transparent background, so it always reads
// as a pressable control — resting one step below the surface-3 inputs and
// stepping up to surface-4 on hover, the same elevation logic as every
// other control on this page.
const GHOST_BUTTON_CLASS =
  "rounded-[6px] border border-line-strong bg-surface-2 px-3 py-1.5 text-[12.5px] font-medium text-ink-muted transition-colors duration-150 hover:border-[#ff6b4a] hover:bg-surface-4 hover:text-ink";
// The one truly primary, data-committing action on this panel: the top
// title/section/priority/due-date form's Save. Every other action (Add,
// Link, Attach, Archive, Restore, Define field, …) stays on
// GHOST_BUTTON_CLASS so the page has exactly one loud color, not six.
const PRIMARY_BUTTON_CLASS =
  "rounded-[6px] bg-[#ff6b4a] px-3 py-1.5 text-[12.5px] font-semibold text-[#1a0800] transition-colors duration-150 hover:bg-[#ff8a70]";
// Same orange identity as PRIMARY_BUTTON_CLASS — still unmistakably "this
// commits the field" — but sized down for the two inline, row-level Saves
// (Custom Field row, Personal note) that sit inside already-compact
// contexts. Full button padding next to a text-13px input and a 10.5px
// label reads as oversized; this matches the row's own scale instead.
const COMPACT_PRIMARY_BUTTON_CLASS =
  "rounded-[6px] bg-[#ff6b4a] px-2.5 py-1 text-[11.5px] font-semibold text-[#1a0800] transition-colors duration-150 hover:bg-[#ff8a70]";
// Every section below the heading shares this wrapper so spacing and the
// divider rhythm stay consistent regardless of how much content a section
// has, instead of each block picking its own ad hoc gap. Each of the two
// content columns (see COLUMN_CLASS below) runs its own divider rhythm, so
// every section after the first one in a column uses this...
const SECTION_CLASS = "flex flex-col gap-3 border-t border-line-strong/60 pt-6";
// ...and the first section in each column uses this instead, the same way
// the page heading never gets a leading divider.
const FIRST_SECTION_CLASS = "flex flex-col gap-3";
// The heading + primary form is always the first block on the page, so it
// never gets a leading divider.
const HEADING_SECTION_CLASS = "flex flex-col gap-4";
// Shared column wrapper for the two content columns below the heading.
// Each column re-establishes its own container-query context (`@container`)
// sized to its own rendered width, so the field-grid breakpoints below
// react to the column's actual width — not the viewport's — and never
// overflow the 380px Item drawer the way a `sm:`-viewport breakpoint would.
const COLUMN_CLASS = "@container flex min-w-0 flex-col gap-8";
// Shared row templates so label/input/action columns line up across every
// field-style section (top form, Custom Fields) instead of each row sizing
// itself independently. `@lg` queries the nearest ancestor `@container`
// (the panel root for the top form, a content column for Custom Fields),
// so these only widen out once there's genuinely enough room, whether
// that's the full-page layout or the narrow Item drawer.
const FIELD_GRID_CLASS = "grid grid-cols-1 gap-3 @lg:grid-cols-3";
const CUSTOM_FIELD_ROW_CLASS = "grid grid-cols-1 items-center gap-2 @lg:grid-cols-[10rem_14rem_auto]";
const CUSTOM_FIELD_ROW_VIEW_CLASS = "grid grid-cols-1 gap-1 @lg:grid-cols-[10rem_1fr] @lg:items-baseline";
// `@lg` (container query), not `sm` (viewport), for the same reason as the
// other row templates above: this panel also renders inside the 380px Item
// drawer, and a viewport breakpoint would widen this control past the
// drawer's content width on any normal desktop viewport regardless of how
// narrow the drawer itself is rendering.
const BOUNDED_CONTROL_CLASS = "w-full @lg:w-56";

const STATE_LABEL: Record<string, string> = {
  TO_DO: "To Do",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  COMPLETE: "Complete",
  ARCHIVED: "Archived",
};

const PRIORITY_BADGE: Record<ItemDetailData["priority"], { tone: StatusBadgeTone; label: string }> = {
  HIGH: { tone: "red", label: "High" },
  NORMAL: { tone: "blue", label: "Normal" },
  LOW: { tone: "muted", label: "Low" },
};

// Keyed by the Route Handler's ?attachmentError= value (#39).
const ATTACHMENT_ERROR_MESSAGE: Record<string, string> = {
  "missing-file": "Choose a file to attach.",
  "type-not-allowed": "That file type isn't supported. Allowed: ZIP, images, PDFs, and common office documents.",
  "too-large": "That file is over the 1GB limit.",
  forbidden: "You don't have permission to attach files to this Item.",
  "item-not-found": "This Item no longer exists.",
};

// Native <select> chrome (the OS-drawn arrow and its own internal padding)
// doesn't match this design system and can't be restyled directly, so every
// dropdown on this page wraps one in a positioned container and repaints
// the arrow with a Lucide icon instead of a raw, unstyled browser control.
function FieldSelect({
  wrapperClassName,
  className,
  children,
  ...props
}: ComponentProps<"select"> & { wrapperClassName?: string }) {
  return (
    <div className={`relative inline-block ${wrapperClassName ?? ""}`}>
      <select {...props} className={`w-full appearance-none pr-8 ${INPUT_CLASS} ${className ?? ""}`}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
    </div>
  );
}

export function ItemDetailPanel({
  data,
  attachmentError,
  boundUpdateDetails,
  boundTransition,
  boundArchive,
  boundRestore,
  boundAddAssignee,
  boundRemoveAssignee,
  boundAddChild,
  boundApplyExistingLabel,
  boundRemoveLabel,
  boundCreateAndApplyLabel,
  boundSetCustomFieldValue,
  boundDefineCustomField,
  boundAddDependency,
  boundRemoveDependency,
  boundAddNote,
  boundUpsertPersonalNote,
}: {
  data: ItemDetailData;
  attachmentError?: string;
  boundUpdateDetails: (formData: FormData) => Promise<void>;
  boundTransition: (formData: FormData) => Promise<void>;
  boundArchive: () => Promise<void>;
  boundRestore: () => Promise<void>;
  boundAddAssignee: (formData: FormData) => Promise<void>;
  boundRemoveAssignee: (userId: string) => () => Promise<void>;
  boundAddChild: (formData: FormData) => Promise<void>;
  boundApplyExistingLabel: (formData: FormData) => Promise<void>;
  boundRemoveLabel: (labelId: string) => () => Promise<void>;
  boundCreateAndApplyLabel: (formData: FormData) => Promise<void>;
  boundSetCustomFieldValue: (definitionId: string) => (formData: FormData) => Promise<void>;
  boundDefineCustomField: (formData: FormData) => Promise<void>;
  boundAddDependency: (formData: FormData) => Promise<void>;
  boundRemoveDependency: (blockerId: string, blockedId: string) => () => Promise<void>;
  boundAddNote: (formData: FormData) => Promise<void>;
  boundUpsertPersonalNote: (formData: FormData) => Promise<void>;
}) {
  const { workspaceId, listId } = data;
  const unassignedMembers = data.assignableMembers.filter(
    (member) => !data.assignees.some((assignee) => assignee.userId === member.userId)
  );
  const priorityBadge = PRIORITY_BADGE[data.priority];

  return (
    <div className="@container flex w-full flex-col">
      {data.parent && (
        <Link
          href={`/workspaces/${workspaceId}/lists/${listId}/items/${data.parent.id}`}
          className="mb-3 inline-block text-[12px] text-ink-faint transition-colors duration-150 hover:text-ink-muted"
        >
          ↑ {data.parent.title}
        </Link>
      )}

      {/* A. Item heading + B. Primary item information */}
      <div className={HEADING_SECTION_CLASS}>
        {data.canEdit ? (
          <form action={boundUpdateDetails} className="flex flex-col gap-4">
            <input
              type="text"
              name="title"
              defaultValue={data.title}
              className="-mx-2 w-[calc(100%+1rem)] rounded-[6px] bg-transparent px-2 py-1 text-[22px] font-semibold leading-snug tracking-tight text-ink transition-colors duration-150 hover:bg-surface-3 focus:bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b4a]/50"
            />
            <div className={FIELD_GRID_CLASS}>
              <div>
                <div className={`${FIELD_LABEL_CLASS} mb-1.5`}>Section</div>
                <FieldSelect name="sectionId" defaultValue={data.sectionId ?? ""} wrapperClassName="w-full">
                  <option value="">No Section</option>
                  {data.sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </FieldSelect>
              </div>
              <div>
                <div className={`${FIELD_LABEL_CLASS} mb-1.5`}>Priority</div>
                <FieldSelect name="priority" defaultValue={data.priority} wrapperClassName="w-full">
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                </FieldSelect>
              </div>
              <div>
                <div className={`${FIELD_LABEL_CLASS} mb-1.5`}>Due date</div>
                <input
                  type="date"
                  name="dueDate"
                  defaultValue={data.dueDate ? data.dueDate.toISOString().slice(0, 10) : ""}
                  className={`w-full ${INPUT_CLASS}`}
                />
              </div>
            </div>
            <button
              type="submit"
              className={`self-start ${PRIMARY_BUTTON_CLASS}`}
            >
              Save
            </button>
          </form>
        ) : (
          <h1 className="text-[22px] font-semibold leading-snug tracking-tight text-ink">{data.title}</h1>
        )}
      </div>

      {/* Primary content (left) + Properties (right) — a balanced two-column
          layout once there's enough room, collapsing to a single column in
          the Item drawer or on narrow viewports. */}
      <div className="mt-8 border-t border-line-strong/60 pt-8">
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 @3xl:grid-cols-[minmax(0,1fr)_20rem] @3xl:items-start">
          <div className={COLUMN_CLASS}>
            {/* F. Custom Fields */}
            <div className={FIRST_SECTION_CLASS}>
              <div className={FIELD_LABEL_CLASS}>Custom Fields</div>
              <div className="flex flex-col gap-3">
                {data.customFieldDefinitions.map((definition) => (
                  <div
                    key={definition.id}
                    className={data.canEdit ? CUSTOM_FIELD_ROW_CLASS : CUSTOM_FIELD_ROW_VIEW_CLASS}
                  >
                    <span className="text-[13px] text-ink-muted">{definition.name}</span>
                    {data.canEdit ? (
                      <form action={boundSetCustomFieldValue(definition.id)} className="contents">
                        {definition.type === "DROPDOWN" ? (
                          <FieldSelect
                            name="value"
                            defaultValue={data.customFieldValues[definition.id] ?? ""}
                            wrapperClassName="w-full"
                          >
                            <option value="">—</option>
                            {definition.options.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </FieldSelect>
                        ) : (
                          <input
                            type={definition.type === "DATE" ? "date" : definition.type === "NUMBER" ? "number" : "text"}
                            name="value"
                            defaultValue={data.customFieldValues[definition.id] ?? ""}
                            className={`w-full ${INPUT_CLASS}`}
                          />
                        )}
                        <button
                          type="submit"
                          className={`${COMPACT_PRIMARY_BUTTON_CLASS} justify-self-start @lg:justify-self-auto`}
                        >
                          Save
                        </button>
                      </form>
                    ) : (
                      <span
                        className={`text-[13px] ${
                          definition.type === "DROPDOWN" ? "text-ink" : "font-[family-name:var(--font-mono-label)] text-ink"
                        }`}
                      >
                        {data.customFieldValues[definition.id] ?? "—"}
                      </span>
                    )}
                  </div>
                ))}
                {data.customFieldDefinitions.length === 0 && (
                  <span className="text-[13px] text-ink-faint">None defined yet.</span>
                )}
              </div>
              {data.canDefineCustomFields && (
                <form action={boundDefineCustomField} className="flex flex-wrap items-center gap-2">
                  <input type="text" name="name" placeholder="New field name" required className={INPUT_CLASS} />
                  <FieldSelect name="type" defaultValue="TEXT">
                    <option value="TEXT">Text</option>
                    <option value="NUMBER">Number</option>
                    <option value="DROPDOWN">Dropdown</option>
                    <option value="DATE">Date</option>
                  </FieldSelect>
                  <input
                    type="text"
                    name="options"
                    placeholder="Dropdown options, comma-separated"
                    className={INPUT_CLASS}
                  />
                  <button type="submit" className={GHOST_BUTTON_CLASS}>
                    Define field
                  </button>
                </form>
              )}
            </div>

            {/* Dependencies */}
            <div className={SECTION_CLASS}>
              <div className={FIELD_LABEL_CLASS}>Dependencies</div>
              <div className="flex flex-col gap-1">
                {data.blockedBy.map((blocker) => (
                  <div key={blocker.id} className="flex items-center gap-2 py-1 text-[13px]">
                    <ArrowLeft className="h-3.5 w-3.5 flex-shrink-0 text-ink-faint" />
                    <span className="text-ink-muted">Blocked by</span>
                    <Link
                      href={`/workspaces/${workspaceId}/lists/${blocker.listId}/items/${blocker.id}`}
                      className="min-w-0 flex-1 truncate text-ink transition-colors duration-150 hover:underline"
                    >
                      {blocker.title}
                    </Link>
                    {data.canEdit && (
                      <form action={boundRemoveDependency(blocker.id, data.itemId)}>
                        <button type="submit" className="text-[12px] text-ink-faint transition-colors duration-150 hover:text-[#ff8a70]">
                          Remove
                        </button>
                      </form>
                    )}
                  </div>
                ))}
                {data.blocking.map((blocked) => (
                  <div key={blocked.id} className="flex items-center gap-2 py-1 text-[13px]">
                    <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-ink-faint" />
                    <span className="text-ink-muted">Blocks</span>
                    <Link
                      href={`/workspaces/${workspaceId}/lists/${blocked.listId}/items/${blocked.id}`}
                      className="min-w-0 flex-1 truncate text-ink transition-colors duration-150 hover:underline"
                    >
                      {blocked.title}
                    </Link>
                    {data.canEdit && (
                      <form action={boundRemoveDependency(data.itemId, blocked.id)}>
                        <button type="submit" className="text-[12px] text-ink-faint transition-colors duration-150 hover:text-[#ff8a70]">
                          Remove
                        </button>
                      </form>
                    )}
                  </div>
                ))}
                {data.blockedBy.length === 0 && data.blocking.length === 0 && (
                  <span className="text-[13px] text-ink-faint">None.</span>
                )}
              </div>
              {data.canEdit && (
                <form action={boundAddDependency} className="flex flex-wrap items-center gap-2">
                  <FieldSelect name="direction" defaultValue="blockedBy">
                    <option value="blockedBy">Is blocked by…</option>
                    <option value="blocks">Blocks…</option>
                  </FieldSelect>
                  {data.sameListItems.length > 0 ? (
                    <FieldSelect name="targetItemId" required defaultValue="">
                      <option value="" disabled>
                        Choose an Item in this List…
                      </option>
                      {data.sameListItems.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.title}
                        </option>
                      ))}
                    </FieldSelect>
                  ) : (
                    <input
                      type="text"
                      name="targetItemId"
                      placeholder="Item ID (works across Lists too)"
                      required
                      className={INPUT_CLASS}
                    />
                  )}
                  <button type="submit" className={GHOST_BUTTON_CLASS}>
                    Link
                  </button>
                </form>
              )}
            </div>

            {/* Attachments */}
            <div className={SECTION_CLASS}>
              <div className={FIELD_LABEL_CLASS}>Attachments</div>
              {attachmentError && (
                <p className="text-[12.5px] text-[#ff8a70]">
                  {ATTACHMENT_ERROR_MESSAGE[attachmentError] ?? "Couldn't attach that file."}
                </p>
              )}
              <ul className="flex flex-col gap-1.5">
                {data.attachments.map((attachment) => (
                  <li
                    key={attachment.id}
                    className="flex items-center justify-between gap-2 text-[13px] animate-in fade-in-0 slide-in-from-bottom-1 duration-200"
                  >
                    <a
                      href={`/api/workspaces/${workspaceId}/lists/${listId}/items/${data.itemId}/attachments/${attachment.id}`}
                      className="min-w-0 flex-1 truncate text-ink transition-colors duration-150 hover:underline"
                    >
                      {attachment.fileName}
                    </a>
                    <span className="flex-shrink-0 text-[11px] text-ink-faint">
                      {formatAttachmentSize(attachment.sizeBytes)} · {attachment.uploaderName}
                    </span>
                  </li>
                ))}
                {data.attachments.length === 0 && <li className="text-[13px] text-ink-faint">None yet.</li>}
              </ul>
              {data.canEdit && (
                <form
                  action={`/api/workspaces/${workspaceId}/lists/${listId}/items/${data.itemId}/attachments`}
                  method="POST"
                  encType="multipart/form-data"
                  className="flex max-w-md items-center gap-2"
                >
                  <input
                    type="file"
                    name="file"
                    required
                    className="flex-1 text-[12.5px] text-ink-muted file:mr-3 file:rounded-[6px] file:border file:border-line-strong file:bg-surface-3 file:px-3 file:py-1.5 file:text-[12.5px] file:text-ink"
                  />
                  <button type="submit" className={GHOST_BUTTON_CLASS}>
                    Attach
                  </button>
                </form>
              )}
            </div>

            {/* Notes */}
            <div className={SECTION_CLASS}>
              <div className={FIELD_LABEL_CLASS}>Notes</div>
              <div className="flex flex-col gap-3">
                {data.notes.map((note) => (
                  <div key={note.id} className="flex gap-2">
                    <MemberAvatar name={note.authorName} />
                    <div className="min-w-0 text-[13px] text-ink-muted">
                      <span className="font-medium text-ink">{note.authorName}</span> — {note.body}
                      {note.mentions.length > 0 && (
                        <span className="ml-1 text-[#ff8a70]">
                          {note.mentions.map((mention) => `@${mention.name}`).join(" ")}
                        </span>
                      )}
                      <div className="mt-0.5 text-[11px] text-ink-faint">
                        {note.createdAt.toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                {data.notes.length === 0 && <span className="text-[13px] text-ink-faint">None yet.</span>}
              </div>
              {data.canEdit && (
                <form action={boundAddNote} className="flex flex-col gap-2">
                  <textarea name="body" placeholder="Add a Note…" required rows={2} className={`w-full ${INPUT_CLASS}`} />
                  {data.mentionCandidates.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {data.mentionCandidates.map((candidate) => (
                        <label key={candidate.userId} className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                          <input type="checkbox" name="mentionedUserIds" value={candidate.userId} />@{candidate.name}
                        </label>
                      ))}
                    </div>
                  )}
                  <button type="submit" className={`self-start ${GHOST_BUTTON_CLASS}`}>
                    Add Note
                  </button>
                </form>
              )}
            </div>

            {/* Personal note */}
            {data.isAssignee && (
              <div className={SECTION_CLASS}>
                <div className="rounded-[8px] border border-dashed border-line-strong bg-surface-3 p-3">
                  <div className={`${FIELD_LABEL_CLASS} mb-1.5 flex items-center gap-1.5`}>
                    <Lock className="h-3 w-3" /> Personal note — only visible to you
                  </div>
                  <form action={boundUpsertPersonalNote} className="flex flex-col gap-2">
                    <textarea
                      name="body"
                      defaultValue={data.personalNote ?? ""}
                      placeholder="Private planning notes…"
                      rows={2}
                      className={`w-full ${INPUT_CLASS}`}
                    />
                    <button type="submit" className={`self-start ${COMPACT_PRIMARY_BUTTON_CLASS}`}>
                      Save
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Child Items */}
            <div className={SECTION_CLASS}>
              <div className={FIELD_LABEL_CLASS}>Child Items</div>
              <ul className="flex flex-col gap-1.5">
                {data.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={`/workspaces/${workspaceId}/lists/${listId}/items/${child.id}`}
                      className="text-[13px] text-ink transition-colors duration-150 hover:underline"
                    >
                      ↳ {child.title}
                    </Link>
                  </li>
                ))}
                {data.children.length === 0 && <li className="text-[13px] text-ink-faint">None yet.</li>}
              </ul>
              {data.canEdit && (
                <form action={boundAddChild} className="flex items-center gap-2">
                  <input type="text" name="title" placeholder="Add a child Item" required className={`flex-1 ${INPUT_CLASS}`} />
                  <button type="submit" className={GHOST_BUTTON_CLASS}>
                    Add
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-8">
            {/* C. State */}
            <div className={FIRST_SECTION_CLASS}>
              <div className="flex flex-col gap-2">
                <div className={FIELD_LABEL_CLASS}>State</div>
                {data.state === "ARCHIVED" ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[13px] text-ink">Archived</span>
                    {data.canEdit && (
                      <form action={boundRestore}>
                        <button type="submit" className={GHOST_BUTTON_CLASS}>
                          Restore
                        </button>
                      </form>
                    )}
                  </div>
                ) : data.canEdit ? (
                  <div className="flex flex-wrap items-start gap-3">
                    <StatePillControl
                      currentState={data.state}
                      currentBlockerReason={data.blockerReason}
                      boundTransition={boundTransition}
                    />
                    <form action={boundArchive}>
                      <button type="submit" className={GHOST_BUTTON_CLASS}>
                        Archive
                      </button>
                    </form>
                  </div>
                ) : (
                  <span className="text-[13px] text-ink">{STATE_LABEL[data.state]}</span>
                )}
                {data.state === "BLOCKED" && !data.canEdit && data.blockerReason && (
                  <div className="rounded-[6px] border border-[#f5b64240] bg-[#f5b64214] px-2.5 py-2 text-[12.5px] text-[#f5b642]">
                    <span className="font-semibold">Blocker reason —</span> {data.blockerReason}
                  </div>
                )}
              </div>
            </div>

            {/* C. Assignees */}
            <div className={SECTION_CLASS}>
              <div className="flex flex-col gap-2">
                <div className={FIELD_LABEL_CLASS}>Assignees</div>
                <div className="flex flex-wrap items-center gap-2">
                  {data.assignees.map((assignee) => (
                    <div key={assignee.userId} className="flex items-center gap-1.5">
                      <MemberAvatar name={assignee.name} />
                      <span className="text-[13px] text-ink">{assignee.name}</span>
                      {data.canEdit && (
                        <form action={boundRemoveAssignee(assignee.userId)}>
                          <button
                            type="submit"
                            aria-label={`Remove ${assignee.name}`}
                            className="text-[12px] text-ink-faint transition-colors duration-150 hover:text-[#ff8a70]"
                          >
                            ×
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
                  {data.assignees.length === 0 && <span className="text-[13px] text-ink-faint">No one yet.</span>}
                </div>
                {data.canEdit && unassignedMembers.length > 0 && (
                  <form action={boundAddAssignee} className="flex items-center gap-2">
                    <FieldSelect name="userId" required defaultValue="" wrapperClassName="min-w-0 flex-1">
                      <option value="" disabled>
                        Add an Assignee…
                      </option>
                      {unassignedMembers.map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {member.name}
                        </option>
                      ))}
                    </FieldSelect>
                    <button type="submit" className={SMALL_ICON_BTN_CLASS} aria-label="Add assignee">
                      <Plus className="h-3 w-3" />
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* D. Metadata */}
            <div className={SECTION_CLASS}>
              <div className={FIELD_LABEL_CLASS}>Metadata</div>
              <div className="flex flex-col gap-4">
                <div>
                  <div className={`${FIELD_LABEL_CLASS} mb-1.5`}>Priority</div>
                  <StatusBadge tone={priorityBadge.tone}>{priorityBadge.label}</StatusBadge>
                </div>
                <div>
                  <div className={`${FIELD_LABEL_CLASS} mb-1.5`}>Due date</div>
                  <span className="text-[13px] text-ink">
                    {data.dueDate
                      ? data.dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                      : "None"}
                  </span>
                </div>
                <div>
                  <div className={`${FIELD_LABEL_CLASS} mb-1.5`}>Created by</div>
                  <span className="text-[13px] text-ink">{data.creatorName}</span>
                </div>
              </div>
            </div>

            {/* E. Labels */}
            <div className={SECTION_CLASS}>
              <div className={FIELD_LABEL_CLASS}>Labels</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {data.labels.map((label) => (
                  <span key={label.id} className={CHIP_CLASS}>
                    {label.name}
                    {data.canEdit && (
                      <form action={boundRemoveLabel(label.id)}>
                        <button type="submit" className="text-ink-faint transition-colors duration-150 hover:text-[#ff8a70]">
                          ×
                        </button>
                      </form>
                    )}
                  </span>
                ))}
                {data.labels.length === 0 && <span className="text-[13px] text-ink-faint">None yet.</span>}
              </div>
              {data.canEdit && data.availableLabels.length > 0 && (
                <form action={boundApplyExistingLabel} className="flex flex-wrap items-center gap-2">
                  <FieldSelect name="labelId" required defaultValue="" wrapperClassName={BOUNDED_CONTROL_CLASS}>
                    <option value="" disabled>
                      Apply a Label…
                    </option>
                    {data.availableLabels.map((label) => (
                      <option key={label.id} value={label.id}>
                        {label.name}
                      </option>
                    ))}
                  </FieldSelect>
                  <button type="submit" className={SMALL_ICON_BTN_CLASS} aria-label="Apply label">
                    <Plus className="h-3 w-3" />
                  </button>
                </form>
              )}
              {data.canCreateLabel && (
                <form action={boundCreateAndApplyLabel} className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    name="name"
                    placeholder="New Label name"
                    required
                    className={`${INPUT_CLASS} ${BOUNDED_CONTROL_CLASS}`}
                  />
                  <button type="submit" className={GHOST_BUTTON_CLASS}>
                    Create &amp; apply
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
