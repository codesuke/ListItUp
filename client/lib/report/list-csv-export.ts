import type { ItemPriority, ItemState, PrismaClient } from "@/generated/prisma/client";
import { canExportList } from "@/lib/permissions/list-access";

export type ListExportRow = {
  id: string;
  title: string;
  parentTitle: string | null;
  sectionName: string | null;
  state: ItemState;
  blockerReason: string | null;
  priority: ItemPriority;
  assigneeNames: string[];
  labelNames: string[];
  startDate: Date | null;
  dueDate: Date | null;
  creatorName: string;
  createdAt: Date;
  updatedAt: Date;
  // Keyed by CustomFieldDefinition id; the raw stored text value.
  customFieldValues: Record<string, string>;
};

export type ListExport = {
  customFields: { id: string; name: string; type: "TEXT" | "NUMBER" | "DROPDOWN" | "DATE" }[];
  rows: ListExportRow[];
};

const DATE_STAMP_LENGTH = "YYYY-MM-DD".length;
const BOM = "﻿";
const LINE_BREAK = "\r\n";
const MULTI_VALUE_SEPARATOR = "; ";

const FIXED_HEADERS = [
  "Item ID",
  "Title",
  "Parent Item",
  "Section",
  "State",
  "Blocker",
  "Priority",
  "Assignees",
  "Labels",
  "Start Date",
  "Due Date",
  "Creator",
  "Created",
  "Updated",
];

const STATE_LABELS: Record<ItemState, string> = {
  TO_DO: "To Do",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  COMPLETE: "Complete",
  ARCHIVED: "Archived",
};

const PRIORITY_LABELS: Record<ItemPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
};

const FORMULA_TRIGGER_PATTERN = /^[=+\-@\t\r]/;
const NEEDS_QUOTING_PATTERN = /[",\r\n]/;

// Spreadsheets run a cell starting with one of these as a formula, so
// user-typed text gets a leading single quote to stay inert.
function neutralizeFormula(text: string): string {
  return FORMULA_TRIGGER_PATTERN.test(text) ? `'${text}` : text;
}

function quoteIfNeeded(text: string): string {
  return NEEDS_QUOTING_PATTERN.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// A cell holding text a User typed (as opposed to a value this module
// generated, like a timestamp or a state label).
type Cell = { kind: "text"; value: string } | { kind: "generated"; value: string };

function text(value: string): Cell {
  return { kind: "text", value };
}

function generated(value: string): Cell {
  return { kind: "generated", value };
}

function renderCell(cell: Cell): string {
  return quoteIfNeeded(cell.kind === "text" ? neutralizeFormula(cell.value) : cell.value);
}

function formatTimestamp(value: Date | null): string {
  return value ? value.toISOString() : "";
}

const CUSTOM_HEADER_SUFFIX = "(custom)";

// Custom Field names are unique per List but can still equal a fixed column
// name; suffix instead of merging or dropping a column.
function buildCustomFieldHeaders(customFields: ListExport["customFields"]): string[] {
  const usedHeaders = new Set(FIXED_HEADERS);
  return customFields.map(({ name }) => {
    let header = name;
    if (usedHeaders.has(header)) {
      header = `${name} ${CUSTOM_HEADER_SUFFIX}`;
      for (let attempt = 2; usedHeaders.has(header); attempt += 1) {
        header = `${name} (custom ${attempt})`;
      }
    }
    usedHeaders.add(header);
    return header;
  });
}


function formatCustomFieldCell(type: ListExport["customFields"][number]["type"], value: string | undefined): Cell {
  if (value === undefined) return generated("");
  switch (type) {
    case "TEXT":
    case "DROPDOWN":
      return text(value);
    case "NUMBER":
      return generated(value);
    case "DATE": {
      const parsed = new Date(value);
      return generated(Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, DATE_STAMP_LENGTH));
    }
  }
}

function serializeRow(row: ListExportRow, customFields: ListExport["customFields"]): Cell[] {
  return [
    generated(row.id),
    text(row.title),
    text(row.parentTitle ?? ""),
    text(row.sectionName ?? ""),
    generated(STATE_LABELS[row.state]),
    text(row.blockerReason ?? ""),
    generated(PRIORITY_LABELS[row.priority]),
    text(row.assigneeNames.join(MULTI_VALUE_SEPARATOR)),
    text(row.labelNames.join(MULTI_VALUE_SEPARATOR)),
    generated(formatTimestamp(row.startDate)),
    generated(formatTimestamp(row.dueDate)),
    text(row.creatorName),
    generated(formatTimestamp(row.createdAt)),
    generated(formatTimestamp(row.updatedAt)),
    ...customFields.map(({ id, type }) => formatCustomFieldCell(type, row.customFieldValues[id])),
  ];
}

export function serializeListCsv(listExport: ListExport): string {
  const headers = [...FIXED_HEADERS, ...buildCustomFieldHeaders(listExport.customFields)];
  const lines = [
    headers.map(generated),
    ...listExport.rows.map((row) => serializeRow(row, listExport.customFields)),
  ];
  return BOM + lines.map((cells) => cells.map(renderCell).join(",") + LINE_BREAK).join("");
}

// The shape the loader reads from the database: just what an export row
// needs, so buildListExport can be exercised without a database.
export type RawExportItem = {
  id: string;
  title: string;
  parentId: string | null;
  sectionId: string | null;
  state: ItemState;
  blockerReason: string | null;
  priority: ItemPriority;
  startDate: Date | null;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  creator: { name: string };
  assignees: { user: { name: string } }[];
  labels: { label: { name: string } }[];
  customFieldValues: { definitionId: string; value: string }[];
};

type RawExportSource = {
  sections: { id: string; name: string; order: number }[];
  customFields: ListExport["customFields"];
  items: RawExportItem[];
};

function compareByCreation(a: RawExportItem, b: RawExportItem): number {
  return a.createdAt.getTime() - b.createdAt.getTime();
}

// Section order first (unsectioned Items last), then creation order within a
// Section; each Item is followed by its descendants, depth first.
function orderItemsForExport(sections: RawExportSource["sections"], items: RawExportItem[]): RawExportItem[] {
  const itemIds = new Set(items.map((item) => item.id));
  const childrenByParentId = new Map<string, RawExportItem[]>();
  const topLevelItems: RawExportItem[] = [];

  for (const item of [...items].sort(compareByCreation)) {
    if (item.parentId !== null && itemIds.has(item.parentId)) {
      childrenByParentId.set(item.parentId, [...(childrenByParentId.get(item.parentId) ?? []), item]);
    } else {
      topLevelItems.push(item);
    }
  }

  const sectionRank = new Map(
    [...sections].sort((a, b) => a.order - b.order).map((section, index) => [section.id, index])
  );
  const unsectionedRank = sections.length;
  const rankOf = (item: RawExportItem) => (item.sectionId === null ? unsectionedRank : (sectionRank.get(item.sectionId) ?? unsectionedRank));
  // Array.prototype.sort is stable, so creation order survives within a rank.
  topLevelItems.sort((a, b) => rankOf(a) - rankOf(b));

  const ordered: RawExportItem[] = [];
  const visit = (item: RawExportItem) => {
    ordered.push(item);
    for (const child of childrenByParentId.get(item.id) ?? []) visit(child);
  };
  topLevelItems.forEach(visit);
  return ordered;
}

export function buildListExport(source: RawExportSource): ListExport {
  const sectionNameById = new Map(source.sections.map((section) => [section.id, section.name]));
  const titleById = new Map(source.items.map((item) => [item.id, item.title]));

  const rows = orderItemsForExport(source.sections, source.items).map((item): ListExportRow => ({
    id: item.id,
    title: item.title,
    parentTitle: item.parentId === null ? null : (titleById.get(item.parentId) ?? null),
    sectionName: item.sectionId === null ? null : (sectionNameById.get(item.sectionId) ?? null),
    state: item.state,
    blockerReason: item.blockerReason,
    priority: item.priority,
    assigneeNames: item.assignees.map(({ user }) => user.name),
    labelNames: item.labels.map(({ label }) => label.name),
    startDate: item.startDate,
    dueDate: item.dueDate,
    creatorName: item.creator.name,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    customFieldValues: Object.fromEntries(item.customFieldValues.map(({ definitionId, value }) => [definitionId, value])),
  }));

  return { customFields: source.customFields, rows };
}

const MAX_FILENAME_SLUG_LENGTH = 60;
const FALLBACK_FILENAME_SLUG = "list-export";

// ASCII-only so the name is safe in a Content-Disposition header as-is.
function slugifyListName(listName: string): string {
  return listName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_FILENAME_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

export function buildExportFilename(listName: string, now: Date): string {
  const slug = slugifyListName(listName) || FALLBACK_FILENAME_SLUG;
  return `${slug}-${now.toISOString().slice(0, DATE_STAMP_LENGTH)}.csv`;
}

export type ListCsvExportResult =
  | { status: "not-found" }
  | { status: "ok"; filename: string; body: string };

// Reads only the fields an export row needs; Notes, Personal Notes,
// Attachments, Dependencies, and emails are never selected, so they cannot
// leak into the file (#72).
async function loadRawExportSource(database: PrismaClient, listId: string): Promise<RawExportSource> {
  const [sections, customFields, items] = await Promise.all([
    database.section.findMany({
      where: { listId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, order: true },
    }),
    database.customFieldDefinition.findMany({
      where: { listId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, type: true },
    }),
    database.item.findMany({
      where: { listId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        parentId: true,
        sectionId: true,
        state: true,
        blockerReason: true,
        priority: true,
        startDate: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
        creator: { select: { name: true } },
        assignees: { orderBy: { createdAt: "asc" }, select: { user: { select: { name: true } } } },
        labels: { orderBy: { createdAt: "asc" }, select: { label: { select: { name: true } } } },
        customFieldValues: { select: { definitionId: true, value: true } },
      },
    }),
  ]);

  return { sections, customFields, items };
}

// Everything the Route Handler does except reading the session: kept here
// so it can be exercised on an injected PrismaClient, like the List page's
// page-data.ts. A User who may not export — or a List that does not exist
// in that Workspace — is reported as not-found so nothing about the List
// leaks.
export async function exportListCsv(
  database: PrismaClient,
  input: { userId: string; workspaceId: string; listId: string; now?: Date }
): Promise<ListCsvExportResult> {
  const { userId, workspaceId, listId, now = new Date() } = input;

  const list = await database.list.findUnique({
    where: { id: listId },
    select: { name: true, workspaceId: true },
  });
  if (!list || list.workspaceId !== workspaceId) {
    return { status: "not-found" };
  }

  if (!(await canExportList(database, { userId, listId }))) {
    return { status: "not-found" };
  }

  const listExport = buildListExport(await loadRawExportSource(database, listId));
  return { status: "ok", filename: buildExportFilename(list.name, now), body: serializeListCsv(listExport) };
}
