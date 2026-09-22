import { ArrowLeft, ArrowRight, Calendar, EllipsisVertical, Lock, Plus } from "lucide-react";
import Link from "next/link";

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MemberAvatar } from "@/components/workspace/MemberAvatar";
import { formatAttachmentSize } from "@/lib/item/item-attachments";

import { ActivityTabs } from "./ActivityTabs";
import { AutoSaveCustomField } from "./AutoSaveCustomField";
import { AutoSaveTitleInput } from "./AutoSaveTitleInput";
import { DueDateChip } from "./DueDateChip";
import { FieldSelect } from "./FieldSelect";
import type { ItemDetailData } from "./page-data";
import {
  BOUNDED_CONTROL_CLASS,
  CHIP_CLASS,
  COLUMN_CLASS,
  COMPACT_PRIMARY_BUTTON_CLASS,
  DASHED_ADD_CHIP_CLASS,
  FIELD_LABEL_CLASS,
  FIRST_SECTION_CLASS,
  GHOST_BUTTON_CLASS,
  HEADING_SECTION_CLASS,
  INPUT_CLASS,
  OVERFLOW_BTN_CLASS,
  PROPERTY_CHIP_CLASS,
  PROPERTY_CHIP_CONTROL_CLASS,
  SECTION_CLASS,
  SMALL_ICON_BTN_CLASS,
} from "./panel-styles";
import { PriorityChip } from "./PriorityChip";
import { RevealAddControl } from "./RevealAddControl";
import { STATE_COLOR, StatePillControl } from "./StatePillControl";

const STATE_LABEL: Record<string, string> = {
  TO_DO: "To Do",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  COMPLETE: "Complete",
  ARCHIVED: "Archived",
};

const PRIORITY_LABEL: Record<ItemDetailData["priority"], string> = { LOW: "Low", NORMAL: "Normal", HIGH: "High" };
const HIGH_PRIORITY_TEXT_CLASS = "text-[#f2545b]";

// Keyed by the Route Handler's ?attachmentError= value (#39).
const ATTACHMENT_ERROR_MESSAGE: Record<string, string> = {
  "missing-file": "Choose a file to attach.",
  "type-not-allowed": "That file type isn't supported. Allowed: ZIP, images, PDFs, and common office documents.",
  "too-large": "That file is over the 1GB limit.",
  forbidden: "You don't have permission to attach files to this Item.",
  "item-not-found": "This Item no longer exists.",
};

function StatusDot({ color }: { color: string }) {
  return <span className="h-[6px] w-[6px] flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />;
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
  const hasDependencies = data.blockedBy.length > 0 || data.blocking.length > 0;
  const canArchive = data.canEdit && data.state !== "ARCHIVED";
  const dueDateText = data.dueDate
    ? data.dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "No due date";

  const dependenciesForm = data.canEdit && (
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
  );

  const attachmentsForm = data.canEdit && (
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
  );

  const addChildForm = data.canEdit && (
    <form action={boundAddChild} className="flex items-center gap-2">
      <input type="text" name="title" placeholder="Add a child Item" required className={`flex-1 ${INPUT_CLASS}`} />
      <button type="submit" className={GHOST_BUTTON_CLASS}>
        Add
      </button>
    </form>
  );

  const comments = (
    <div className="flex flex-col gap-3">
      {data.notes.map((note) => (
        <div key={note.id} className="flex gap-2">
          <MemberAvatar name={note.authorName} />
          <div className="min-w-0 text-[13px] text-ink-muted">
            <span className="font-medium text-ink">{note.authorName}</span> — {note.body}
            {note.mentions.length > 0 && (
              <span className="ml-1 text-[#ff8a70]">{note.mentions.map((mention) => `@${mention.name}`).join(" ")}</span>
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
  );

  const privateNote = data.isAssignee ? (
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
  ) : null;

  const applyLabelForm = data.canEdit && data.availableLabels.length > 0 && (
    <form action={boundApplyExistingLabel} className="flex flex-wrap items-center gap-2">
      <FieldSelect
        name="labelId"
        required
        defaultValue=""
        wrapperClassName={BOUNDED_CONTROL_CLASS}
        controlClassName={`text-ink-muted ${PROPERTY_CHIP_CONTROL_CLASS}`}
      >
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
  );

  const createLabelForm = data.canCreateLabel && (
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

      {/* Header: title, Created by · date, overflow menu */}
      <div className={HEADING_SECTION_CLASS}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {data.canEdit ? (
              <AutoSaveTitleInput defaultValue={data.title} action={boundUpdateDetails} />
            ) : (
              <h1 className="text-[22px] font-semibold leading-snug tracking-tight text-ink">{data.title}</h1>
            )}
          </div>

          {canArchive && (
            <DropdownMenu>
              <DropdownMenuTrigger className={OVERFLOW_BTN_CLASS} aria-label="More actions">
                <EllipsisVertical className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[150px] rounded-[8px] border border-line-strong bg-surface-2 p-1 text-ink shadow-lg ring-0"
              >
                <form action={boundArchive}>
                  <button
                    type="submit"
                    className="w-full rounded-[6px] px-2.5 py-1.5 text-left text-[12.5px] text-ink-muted transition-colors duration-150 hover:bg-surface-4 hover:text-ink"
                  >
                    Archive task
                  </button>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="text-[13px] text-ink-muted">
          Created by <span className="font-medium text-ink">{data.creatorName}</span> ·{" "}
          <span className="text-ink">
            {data.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
      </div>

      {/* Properties strip: Status, Priority, Assignees, Due date, Labels —
          the only place these fields appear, as compact inline chips. */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-y border-line-strong/60 py-3.5">
        {data.state === "ARCHIVED" ? (
          <>
            <span className={`${PROPERTY_CHIP_CLASS} text-ink-muted`}>
              <StatusDot color={STATE_COLOR.ARCHIVED} />
              Archived
            </span>
            {data.canEdit && (
              <form action={boundRestore}>
                <button type="submit" className={GHOST_BUTTON_CLASS}>
                  Restore
                </button>
              </form>
            )}
          </>
        ) : data.canEdit ? (
          <StatePillControl currentState={data.state} currentBlockerReason={data.blockerReason} boundTransition={boundTransition} />
        ) : (
          <span className={`${PROPERTY_CHIP_CLASS} text-ink-muted`}>
            <StatusDot color={STATE_COLOR[data.state]} />
            {STATE_LABEL[data.state]}
          </span>
        )}

        {data.canEdit ? (
          <PriorityChip defaultValue={data.priority} action={boundUpdateDetails} />
        ) : (
          <span className={`${PROPERTY_CHIP_CLASS} ${data.priority === "HIGH" ? HIGH_PRIORITY_TEXT_CLASS : "text-ink-muted"}`}>
            {PRIORITY_LABEL[data.priority]}
          </span>
        )}

        {data.assignees.map((assignee) => (
          <span key={assignee.userId} className={`${PROPERTY_CHIP_CLASS} text-ink-muted`}>
            <MemberAvatar name={assignee.name} />
            {assignee.name}
            {data.canEdit && (
              <form action={boundRemoveAssignee(assignee.userId)}>
                <button
                  type="submit"
                  aria-label={`Remove ${assignee.name}`}
                  className="text-ink-faint transition-colors duration-150 hover:text-[#ff8a70]"
                >
                  ×
                </button>
              </form>
            )}
          </span>
        ))}
        {data.canEdit && unassignedMembers.length > 0 && (
          <RevealAddControl
            renderTrigger={(open) => (
              <button type="button" onClick={open} className={DASHED_ADD_CHIP_CLASS}>
                <Plus className="h-3 w-3" /> Assignee
              </button>
            )}
          >
            <form action={boundAddAssignee} className="flex items-center gap-2">
              <FieldSelect
                name="userId"
                required
                defaultValue=""
                wrapperClassName="min-w-0"
                controlClassName={`text-ink-muted ${PROPERTY_CHIP_CONTROL_CLASS}`}
              >
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
          </RevealAddControl>
        )}

        {data.canEdit ? (
          <DueDateChip
            defaultValue={data.dueDate ? data.dueDate.toISOString().slice(0, 10) : ""}
            action={boundUpdateDetails}
          />
        ) : (
          <span className={`${PROPERTY_CHIP_CLASS} text-ink-muted`}>
            <Calendar className="h-3 w-3 text-ink-faint" />
            {dueDateText}
          </span>
        )}

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
        {data.canEdit && (applyLabelForm || createLabelForm) && (
          <RevealAddControl
            renderTrigger={(open) => (
              <button type="button" onClick={open} className={DASHED_ADD_CHIP_CLASS}>
                <Plus className="h-3 w-3" /> Label
              </button>
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              {applyLabelForm}
              {createLabelForm}
            </div>
          </RevealAddControl>
        )}
      </div>

      {data.state === "BLOCKED" && !data.canEdit && data.blockerReason && (
        <div className="mt-4 rounded-[6px] border border-[#f5b64240] bg-[#f5b64214] px-2.5 py-2 text-[12.5px] text-[#f5b642]">
          <span className="font-semibold">Blocker reason —</span> {data.blockerReason}
        </div>
      )}

      {/* Main content, single column, dividers only (no card wrappers) */}
      <div className={`mt-6 ${COLUMN_CLASS}`}>
        {/* Custom Fields */}
        <div className={FIRST_SECTION_CLASS}>
          <div className={FIELD_LABEL_CLASS}>Custom Fields</div>
          <div className="flex flex-wrap gap-4">
            {data.customFieldDefinitions.map((definition) =>
              data.canEdit ? (
                <AutoSaveCustomField
                  key={definition.id}
                  definition={definition}
                  defaultValue={data.customFieldValues[definition.id] ?? ""}
                  action={boundSetCustomFieldValue(definition.id)}
                />
              ) : (
                <div key={definition.id} className="flex min-w-[15rem] flex-1 flex-col gap-1.5">
                  <span className={FIELD_LABEL_CLASS}>{definition.name}</span>
                  <span
                    className={`text-[13px] ${
                      definition.type === "DROPDOWN" ? "text-ink" : "font-[family-name:var(--font-mono-label)] text-ink"
                    }`}
                  >
                    {data.customFieldValues[definition.id] ?? "—"}
                  </span>
                </div>
              )
            )}
            {data.customFieldDefinitions.length === 0 && (
              <span className="text-[13px] text-ink-faint">None defined yet.</span>
            )}
          </div>
          {data.canDefineCustomFields && (
            <RevealAddControl label="+ Add field" collapsible>
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
            </RevealAddControl>
          )}
        </div>

        {/* Dependencies */}
        <div className={SECTION_CLASS}>
          <div className={FIELD_LABEL_CLASS}>Dependencies</div>
          {hasDependencies ? (
            <>
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
              </div>
              {dependenciesForm && <div className="flex justify-end">{dependenciesForm}</div>}
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[13px] text-ink-faint">None.</span>
              {dependenciesForm && <RevealAddControl label="+ Add dependency">{dependenciesForm}</RevealAddControl>}
            </div>
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
          {data.attachments.length > 0 ? (
            <>
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
              </ul>
              {attachmentsForm && <div className="flex justify-end">{attachmentsForm}</div>}
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[13px] text-ink-faint">None yet.</span>
              {attachmentsForm && <RevealAddControl label="+ Add attachment">{attachmentsForm}</RevealAddControl>}
            </div>
          )}
        </div>

        {/* Activity: Comments / Private note */}
        <div className={SECTION_CLASS}>
          <div className={FIELD_LABEL_CLASS}>Activity</div>
          <ActivityTabs comments={comments} privateNote={privateNote} />
        </div>

        {/* Child Items */}
        <div className={SECTION_CLASS}>
          <div className={FIELD_LABEL_CLASS}>Child Items</div>
          {data.children.length > 0 ? (
            <>
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
              </ul>
              {addChildForm && <div className="flex justify-end">{addChildForm}</div>}
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[13px] text-ink-faint">None yet.</span>
              {addChildForm && <RevealAddControl label="+ Add child Item">{addChildForm}</RevealAddControl>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
