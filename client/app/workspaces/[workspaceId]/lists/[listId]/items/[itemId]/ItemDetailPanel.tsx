import { ArrowLeft, ArrowRight, Lock, Plus } from "lucide-react";
import Link from "next/link";

import { MemberAvatar } from "@/components/workspace/MemberAvatar";
import { StatusBadge, type StatusBadgeTone } from "@/components/workspace/StatusBadge";
import { formatAttachmentSize } from "@/lib/item/item-attachments";

import type { ItemDetailData } from "./page-data";
import { StatePillControl } from "./StatePillControl";

const FIELD_LABEL_CLASS =
  "font-[family-name:var(--font-mono-label)] text-[10.5px] uppercase tracking-[0.08em] text-ink-faint";
const CHIP_CLASS =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line-strong bg-surface-3 px-2.5 py-1 text-[12px] text-ink-muted";
const SMALL_ICON_BTN_CLASS =
  "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[6px] border border-line-strong bg-surface-2 text-ink-muted transition-colors duration-150 hover:bg-surface-3 hover:text-ink";
const INPUT_CLASS =
  "rounded-[6px] border border-line-strong bg-surface-3 px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink-faint transition-colors duration-150 focus:border-[#ff6b4a] focus:outline-none";
const GHOST_BUTTON_CLASS =
  "rounded-[6px] border border-line-strong px-3 py-1.5 text-[12.5px] text-ink-muted transition-colors duration-150 hover:border-[#ff6b4a] hover:text-ink";
// Every section in the "Additional details" tier (Labels through Child
// Items) shares this wrapper so spacing and the divider rhythm stay
// consistent regardless of how much content a section has, instead of each
// block picking its own ad hoc gap.
const SECTION_CLASS = "flex flex-col gap-3 border-t border-line-strong/60 pt-6";
// The first section in that tier sits right after the tier's own leading
// divider (see ADDITIONAL_DETAILS_CLASS below), so it never gets a second one.
const FIRST_SECTION_CLASS = "flex flex-col gap-3";
// Wraps the whole "Additional details" tier: one divider marks the shift
// from the connected heading/basic-info/status/metadata block above to
// this list of independent sections, which then keep a consistent rhythm
// between each other via SECTION_CLASS.
const ADDITIONAL_DETAILS_CLASS = "mt-8 flex flex-col gap-8 border-t border-line-strong/60 pt-8";
// Shared row templates so label/input/action columns line up across every
// field-style group (Basic information, Metadata, Custom Fields) instead of
// each row sizing itself independently. `@lg`/`@2xl` query the nearest
// ancestor `@container` — the panel root for most of these, or the Basic
// information column once the heading row has split in two — so they only
// widen out once there's genuinely enough room, whether that's the
// full-page layout or the narrow Item drawer.
const FIELD_GRID_CLASS = "grid grid-cols-1 gap-3 @lg:grid-cols-3";
const CUSTOM_FIELD_ROW_CLASS = "grid grid-cols-1 items-center gap-2 @lg:grid-cols-[10rem_14rem_auto]";
const CUSTOM_FIELD_ROW_VIEW_CLASS = "grid grid-cols-1 gap-1 @lg:grid-cols-[10rem_1fr] @lg:items-baseline";
const BOUNDED_CONTROL_CLASS = "w-full sm:w-56";

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

  // Status & ownership (State, Assignees) render the same way whether or
  // not there's a Basic information column beside them (see below) — kept
  // as one block so that isn't duplicated between the two layouts.
  const statusAndOwnership = (
    <>
      {/* State */}
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

      {/* Assignees */}
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
            <select name="userId" required defaultValue="" className={`min-w-0 flex-1 ${INPUT_CLASS}`}>
              <option value="" disabled>
                Add an Assignee…
              </option>
              {unassignedMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </select>
            <button type="submit" className={SMALL_ICON_BTN_CLASS} aria-label="Add assignee">
              <Plus className="h-3 w-3" />
            </button>
          </form>
        )}
      </div>
    </>
  );

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

      {/* Connected header: item heading → basic information → status &
          ownership → metadata. Kept as one block with a single spacing
          rhythm (no dividers inside it) since these all describe the same
          Item; a single divider below separates it from the independent
          detail sections that follow. */}
      <div className="flex flex-col gap-6">
        {/* A. Item heading — the title input still submits with the Basic
            information form below via `form="item-details-form"` even
            though it renders above the two-column row, so it can stay
            full-width and visually prominent instead of being boxed into
            the left column with the rest of that form. */}
        {data.canEdit ? (
          <input
            type="text"
            name="title"
            form="item-details-form"
            defaultValue={data.title}
            className="w-full bg-transparent text-[22px] font-semibold leading-snug tracking-tight text-ink focus:outline-none"
          />
        ) : (
          <h1 className="text-[22px] font-semibold leading-snug tracking-tight text-ink">{data.title}</h1>
        )}

        {/* B. Basic information + C. Status & ownership — a balanced,
            equal-width two-column row once there's room, so the Item's
            core properties stay visually attached to its heading instead
            of drifting into a separate sidebar. Read-only viewers have no
            Basic information form to show (Section/Priority/Due date are
            editable-only), so they just get Status & ownership at full
            width instead of an empty column beside it. */}
        {data.canEdit ? (
          <div className="grid grid-cols-1 gap-x-10 gap-y-6 @2xl:grid-cols-2 @2xl:items-start">
            <div className="@container">
              <form id="item-details-form" action={boundUpdateDetails} className="flex flex-col gap-4">
                <div className={FIELD_GRID_CLASS}>
                  <div>
                    <div className={`${FIELD_LABEL_CLASS} mb-1.5`}>Section</div>
                    <select name="sectionId" defaultValue={data.sectionId ?? ""} className={`w-full ${INPUT_CLASS}`}>
                      <option value="">No Section</option>
                      {data.sections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className={`${FIELD_LABEL_CLASS} mb-1.5`}>Priority</div>
                    <select name="priority" defaultValue={data.priority} className={`w-full ${INPUT_CLASS}`}>
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                    </select>
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
                  className="self-start rounded-[6px] bg-[#ff6b4a] px-3 py-1.5 text-[12.5px] font-semibold text-[#1a0800] transition-colors duration-150 hover:bg-[#ff8a70]"
                >
                  Save
                </button>
              </form>
            </div>

            <div className="flex flex-col gap-6">{statusAndOwnership}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">{statusAndOwnership}</div>
        )}

        {/* D. Metadata */}
        <div className="flex flex-col gap-3">
          <div className={FIELD_LABEL_CLASS}>Metadata</div>
          <div className={FIELD_GRID_CLASS}>
            <div>
              <div className={`${FIELD_LABEL_CLASS} mb-2`}>Priority</div>
              <StatusBadge tone={priorityBadge.tone}>{priorityBadge.label}</StatusBadge>
            </div>
            <div>
              <div className={`${FIELD_LABEL_CLASS} mb-2`}>Due date</div>
              <span className="text-[13px] text-ink">
                {data.dueDate
                  ? data.dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                  : "None"}
              </span>
            </div>
            <div>
              <div className={`${FIELD_LABEL_CLASS} mb-2`}>Created by</div>
              <span className="text-[13px] text-ink">{data.creatorName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Additional details: Labels, Custom Fields, Dependencies,
          Attachments, Notes, Child Items — independent, variable-length
          sections. Kept full-width and single-column (rather than paired
          into a second two-column row) so a short section never leaves an
          awkward gap beside a long one; the shared SECTION_CLASS rhythm
          and consistent left/right edges make them read as one page
          rather than a stack of separate forms. */}
      <div className={ADDITIONAL_DETAILS_CLASS}>
        {/* E. Labels */}
        <div className={FIRST_SECTION_CLASS}>
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
              <select name="labelId" required defaultValue="" className={`${INPUT_CLASS} ${BOUNDED_CONTROL_CLASS}`}>
                <option value="" disabled>
                  Apply a Label…
                </option>
                {data.availableLabels.map((label) => (
                  <option key={label.id} value={label.id}>
                    {label.name}
                  </option>
                ))}
              </select>
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

        {/* F. Custom Fields */}
        <div className={SECTION_CLASS}>
          <div className={FIELD_LABEL_CLASS}>Custom Fields</div>
          <div className="flex flex-col gap-3">
            {data.customFieldDefinitions.map((definition) => (
              <div key={definition.id} className={data.canEdit ? CUSTOM_FIELD_ROW_CLASS : CUSTOM_FIELD_ROW_VIEW_CLASS}>
                <span className="text-[13px] text-ink-muted">{definition.name}</span>
                {data.canEdit ? (
                  <form action={boundSetCustomFieldValue(definition.id)} className="contents">
                    {definition.type === "DROPDOWN" ? (
                      <select
                        name="value"
                        defaultValue={data.customFieldValues[definition.id] ?? ""}
                        className={`w-full ${INPUT_CLASS}`}
                      >
                        <option value="">—</option>
                        {definition.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
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
                      className="justify-self-start text-[12px] text-ink-faint transition-colors duration-150 hover:text-[#ff8a70] @lg:justify-self-auto"
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
              <select name="type" defaultValue="TEXT" className={INPUT_CLASS}>
                <option value="TEXT">Text</option>
                <option value="NUMBER">Number</option>
                <option value="DROPDOWN">Dropdown</option>
                <option value="DATE">Date</option>
              </select>
              <input type="text" name="options" placeholder="Dropdown options, comma-separated" className={INPUT_CLASS} />
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
              <select name="direction" defaultValue="blockedBy" className={INPUT_CLASS}>
                <option value="blockedBy">Is blocked by…</option>
                <option value="blocks">Blocks…</option>
              </select>
              {data.sameListItems.length > 0 ? (
                <select name="targetItemId" required defaultValue="" className={INPUT_CLASS}>
                  <option value="" disabled>
                    Choose an Item in this List…
                  </option>
                  {data.sameListItems.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.title}
                    </option>
                  ))}
                </select>
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
              <li key={attachment.id} className="flex items-center justify-between gap-2 text-[13px]">
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

        {/* Notes — the only free-text/prose section, so its content is
            capped at a comfortably readable line length even though the
            section itself spans the full page width like its neighbors. */}
        <div className={SECTION_CLASS}>
          <div className={FIELD_LABEL_CLASS}>Notes</div>
          <div className="flex max-w-2xl flex-col gap-3">
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
            <form action={boundAddNote} className="flex max-w-2xl flex-col gap-2">
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
            <div className="max-w-2xl rounded-[8px] border border-dashed border-line-strong bg-surface-3 p-3">
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
                <button type="submit" className={`self-start ${GHOST_BUTTON_CLASS}`}>
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
    </div>
  );
}
