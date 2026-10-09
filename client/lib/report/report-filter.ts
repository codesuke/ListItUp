import type { Prisma } from "@/generated/prisma/client";
import type { ItemState } from "@/generated/prisma/client";

// A saved Report's filter/setup (CONTEXT.md's Report entry, #45): Assignee,
// state, or date, each an OR within its own dimension and ANDed across
// dimensions. No free-text search or Section/Label filters in this ticket —
// the originating spec names only Assignee/state/date.
export type ReportFilter = {
  assigneeUserIds?: string[];
  states?: ItemState[];
  dueAfter?: string;
  dueBefore?: string;
};

const VALID_ITEM_STATES: readonly ItemState[] = ["TO_DO", "IN_PROGRESS", "BLOCKED", "COMPLETE", "ARCHIVED"];

export const REPORT_NAME_MAX_LENGTH = 100;

export type ReportNameValidation = { valid: true; name: string } | { valid: false; reason: string };

// Trims and bounds a Report's name — the same "non-empty after trim, bound
// the length" rule this codebase applies to other User-typed names (List,
// Section, Label).
export function validateReportName(rawName: string): ReportNameValidation {
  const name = rawName.trim();
  if (name.length === 0) {
    return { valid: false, reason: "Report name cannot be empty." };
  }
  if (name.length > REPORT_NAME_MAX_LENGTH) {
    return { valid: false, reason: `Report name cannot exceed ${REPORT_NAME_MAX_LENGTH} characters.` };
  }
  return { valid: true, name };
}

function isValidIsoDate(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(new Date(value).getTime());
}

export type ReportFilterValidation = { valid: true; filter: ReportFilter } | { valid: false; reason: string };

// Pure shape validation for a Report's filter — no database access, so it
// can be exercised as a plain *.test.ts (#45). Every field is optional;
// an empty filter ({}) is valid and matches every Item on the List.
export function validateReportFilter(rawFilter: unknown): ReportFilterValidation {
  if (typeof rawFilter !== "object" || rawFilter === null || Array.isArray(rawFilter)) {
    return { valid: false, reason: "Report filter must be an object." };
  }

  const candidate = rawFilter as Record<string, unknown>;
  const filter: ReportFilter = {};

  if ("assigneeUserIds" in candidate && candidate.assigneeUserIds !== undefined) {
    const value = candidate.assigneeUserIds;
    if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string" && entry.length > 0)) {
      return { valid: false, reason: "assigneeUserIds must be an array of non-empty strings." };
    }
    filter.assigneeUserIds = [...new Set(value as string[])];
  }

  if ("states" in candidate && candidate.states !== undefined) {
    const value = candidate.states;
    if (!Array.isArray(value) || !value.every((entry) => VALID_ITEM_STATES.includes(entry as ItemState))) {
      return { valid: false, reason: "states must be an array of valid Item states." };
    }
    filter.states = [...new Set(value as ItemState[])];
  }

  if ("dueAfter" in candidate && candidate.dueAfter !== undefined) {
    if (!isValidIsoDate(candidate.dueAfter)) {
      return { valid: false, reason: "dueAfter must be a valid date." };
    }
    filter.dueAfter = candidate.dueAfter;
  }

  if ("dueBefore" in candidate && candidate.dueBefore !== undefined) {
    if (!isValidIsoDate(candidate.dueBefore)) {
      return { valid: false, reason: "dueBefore must be a valid date." };
    }
    filter.dueBefore = candidate.dueBefore;
  }

  if (
    filter.dueAfter !== undefined &&
    filter.dueBefore !== undefined &&
    new Date(filter.dueAfter).getTime() > new Date(filter.dueBefore).getTime()
  ) {
    return { valid: false, reason: "dueAfter must not be later than dueBefore." };
  }

  return { valid: true, filter };
}

// Defensive re-validation of a filter read back from the database — the
// column is stored as JSON (Prisma.JsonValue), so nothing upstream
// guarantees it still matches ReportFilter's shape (TS.UNVALIDATED-JSON).
// Written data always comes from validateReportFilter, so a mismatch here
// would mean corrupt/legacy data rather than a normal path; it is treated
// as "no filter" (matches every Item) rather than throwing.
export function toReportFilter(stored: unknown): ReportFilter {
  const result = validateReportFilter(stored);
  return result.valid ? result.filter : {};
}

// Builds the live query predicate for a Report's filter (#45/#47) — shared
// by re-running a saved Report and by its CSV export, so both always see
// the same Items.
export function buildReportItemWhere(listId: string, filter: ReportFilter): Prisma.ItemWhereInput {
  const where: Prisma.ItemWhereInput = { listId };

  if (filter.assigneeUserIds && filter.assigneeUserIds.length > 0) {
    where.assignees = { some: { userId: { in: filter.assigneeUserIds } } };
  }

  if (filter.states && filter.states.length > 0) {
    where.state = { in: filter.states };
  }

  if (filter.dueAfter !== undefined || filter.dueBefore !== undefined) {
    where.dueDate = {
      ...(filter.dueAfter !== undefined ? { gte: new Date(filter.dueAfter) } : {}),
      ...(filter.dueBefore !== undefined ? { lte: new Date(filter.dueBefore) } : {}),
    };
  }

  return where;
}
