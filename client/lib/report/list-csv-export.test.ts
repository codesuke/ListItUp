import assert from "node:assert/strict";

import { buildExportFilename, buildListExport, serializeListCsv, toCsvDownloadResponse, type ListExport, type ListExportRow, type RawExportItem } from "./list-csv-export";

const BOM = "﻿";

function row(overrides: Partial<ListExportRow> = {}): ListExportRow {
  return {
    id: "item-1",
    title: "Write spec",
    parentTitle: null,
    sectionName: "Planning",
    state: "IN_PROGRESS",
    blockerReason: null,
    priority: "HIGH",
    assigneeNames: ["Ada", "Grace"],
    labelNames: ["urgent", "docs"],
    startDate: new Date("2026-09-01T00:00:00.000Z"),
    dueDate: new Date("2026-09-10T00:00:00.000Z"),
    creatorName: "Ada",
    createdAt: new Date("2026-08-30T09:15:00.000Z"),
    updatedAt: new Date("2026-09-02T10:30:00.000Z"),
    customFieldValues: {},
    ...overrides,
  };
}

const FIXED_HEADER =
  "Item ID,Title,Parent Item,Section,State,Blocker,Priority,Assignees,Labels,Start Date,Due Date,Creator,Created,Updated";

// A row serializes under the fixed header with BOM, CRLF line endings, a
// trailing CRLF, multi-values joined by "; ", and ISO 8601 dates.
{
  const listExport: ListExport = { customFields: [], rows: [row()] };
  assert.equal(
    serializeListCsv(listExport),
    `${BOM}${FIXED_HEADER}\r\n` +
      "item-1,Write spec,,Planning,In Progress,,High,Ada; Grace,urgent; docs," +
      "2026-09-01T00:00:00.000Z,2026-09-10T00:00:00.000Z,Ada,2026-08-30T09:15:00.000Z,2026-09-02T10:30:00.000Z\r\n"
  );
}

function bodyOf(listExport: ListExport): string {
  return serializeListCsv(listExport).slice(BOM.length).split("\r\n").slice(1).join("\r\n");
}

// Cells containing a comma, double quote, or line break are quoted, with
// embedded quotes doubled (RFC 4180).
{
  const body = bodyOf({
    customFields: [],
    rows: [row({ title: 'Say "hi", then\nleave', assigneeNames: [], labelNames: [] })],
  });
  assert.ok(body.startsWith('item-1,"Say ""hi"", then\nleave",,Planning,'), body);
}

// Text cells that a spreadsheet would run as a formula are prefixed with a
// single quote so they stay text.
{
  const expectedByInput: [string, string][] = [
    ["=SUM(A1)", "'=SUM(A1)"],
    ["+1", "'+1"],
    ["-1", "'-1"],
    ["@cmd", "'@cmd"],
    ["\tTab", "'\tTab"],
    ["\rCR", "\"'\rCR\""],
  ];
  for (const [input, expectedCell] of expectedByInput) {
    const body = bodyOf({ customFields: [], rows: [row({ title: input })] });
    assert.ok(body.startsWith(`item-1,${expectedCell},`), `${JSON.stringify(input)} -> ${JSON.stringify(body)}`);
  }
  // Names, blockers, and the parent title are user-typed text too.
  const body = bodyOf({
    customFields: [],
    rows: [row({ parentTitle: "=A", blockerReason: "@B", creatorName: "+C", assigneeNames: ["-D"], sectionName: "=E" })],
  });
  for (const expected of ["'=A", "'@B", "'+C", "'-D", "'=E"]) {
    assert.ok(body.includes(expected), `${expected} missing in ${body}`);
  }
}

function headerOf(listExport: ListExport): string {
  return serializeListCsv(listExport).slice(BOM.length).split("\r\n")[0]!;
}

// Custom Field columns follow the fixed ones in definition order. Text and
// Dropdown are written as typed (Text is formula-neutralized), Number is
// left alone so a negative value stays numeric, Date is normalized to
// YYYY-MM-DD, and an unset value is an empty cell.
{
  const listExport: ListExport = {
    customFields: [
      { id: "f-text", name: "Owner", type: "TEXT" },
      { id: "f-number", name: "Score", type: "NUMBER" },
      { id: "f-dropdown", name: "Stage", type: "DROPDOWN" },
      { id: "f-date", name: "Ship", type: "DATE" },
      { id: "f-unset", name: "Notes", type: "TEXT" },
    ],
    rows: [
      row({
        assigneeNames: [],
        labelNames: [],
        startDate: null,
        dueDate: null,
        customFieldValues: {
          "f-text": "=evil",
          "f-number": "-5",
          "f-dropdown": "Review",
          "f-date": "2026-10-01T00:00:00.000Z",
        },
      }),
    ],
  };
  assert.equal(headerOf(listExport), `${FIXED_HEADER},Owner,Score,Stage,Ship,Notes`);
  assert.ok(bodyOf(listExport).endsWith(",'=evil,-5,Review,2026-10-01,\r\n"), bodyOf(listExport));
}

// A Custom Field whose name matches a fixed column, or an earlier column,
// gets " (custom)" appended (numbered if that still collides); no column is
// merged or dropped.
{
  const listExport: ListExport = {
    customFields: [
      { id: "a", name: "State", type: "TEXT" },
      { id: "b", name: "State (custom)", type: "TEXT" },
      { id: "c", name: "Title", type: "TEXT" },
    ],
    rows: [],
  };
  assert.equal(
    headerOf(listExport),
    `${FIXED_HEADER},State (custom),State (custom) (custom),Title (custom)`
  );

  // The suffixed name is already taken by an earlier field, so a number is added.
  const numberedCollision: ListExport = {
    customFields: [
      { id: "a", name: "State (custom)", type: "TEXT" },
      { id: "b", name: "State", type: "TEXT" },
    ],
    rows: [],
  };
  assert.equal(headerOf(numberedCollision), `${FIXED_HEADER},State (custom),State (custom 2)`);
}

function rawItem(id: string, overrides: Partial<RawExportItem> = {}): RawExportItem {
  return {
    id,
    title: id,
    parentId: null,
    sectionId: null,
    state: "TO_DO",
    blockerReason: null,
    priority: "NORMAL",
    startDate: null,
    dueDate: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    creator: { name: "Ada" },
    assignees: [],
    labels: [],
    customFieldValues: [],
    ...overrides,
  };
}

const day = (n: number) => new Date(`2026-09-${String(n).padStart(2, "0")}T00:00:00.000Z`);

// Rows follow Section order, then creation order inside a Section, with
// unsectioned Items last; children sit directly after their parent (at any
// depth) and carry the parent's title. Archived Items are kept.
{
  const built = buildListExport({
    sections: [
      { id: "s-late", name: "Later", order: 1 },
      { id: "s-first", name: "First", order: 0 },
    ],
    customFields: [],
    items: [
      rawItem("loose", { createdAt: day(1) }),
      rawItem("late-a", { sectionId: "s-late", createdAt: day(2) }),
      rawItem("first-b", { sectionId: "s-first", createdAt: day(4) }),
      rawItem("first-a", { sectionId: "s-first", createdAt: day(3) }),
      rawItem("child-2", { parentId: "first-a", sectionId: "s-first", createdAt: day(6) }),
      rawItem("child-1", { parentId: "first-a", sectionId: "s-first", createdAt: day(5) }),
      rawItem("grandchild", { parentId: "child-1", sectionId: "s-first", createdAt: day(7) }),
      rawItem("archived", { sectionId: "s-late", state: "ARCHIVED", createdAt: day(8) }),
    ],
  });

  assert.deepEqual(
    built.rows.map((r) => r.id),
    ["first-a", "child-1", "grandchild", "child-2", "first-b", "late-a", "archived", "loose"]
  );
  assert.deepEqual(
    built.rows.map((r) => r.parentTitle),
    [null, "first-a", "child-1", "first-a", null, null, null, null]
  );
  assert.equal(built.rows.find((r) => r.id === "archived")!.state, "ARCHIVED");
  assert.equal(built.rows.find((r) => r.id === "first-a")!.sectionName, "First");
  assert.equal(built.rows.find((r) => r.id === "loose")!.sectionName, null);
}

// An Item whose parent is not among the exported Items is treated as
// top-level rather than dropped, and row fields are flattened from the
// relations (creator/assignee/label names, custom field values by id).
{
  const built = buildListExport({
    sections: [],
    customFields: [{ id: "f1", name: "Owner", type: "TEXT" }],
    items: [
      rawItem("orphan", {
        parentId: "missing",
        creator: { name: "Grace" },
        assignees: [{ user: { name: "Ada" } }, { user: { name: "Linus" } }],
        labels: [{ label: { name: "docs" } }],
        customFieldValues: [{ definitionId: "f1", value: "Platform" }],
      }),
    ],
  });
  assert.equal(built.rows.length, 1);
  assert.equal(built.rows[0]!.parentTitle, null);
  assert.equal(built.rows[0]!.creatorName, "Grace");
  assert.deepEqual(built.rows[0]!.assigneeNames, ["Ada", "Linus"]);
  assert.deepEqual(built.rows[0]!.labelNames, ["docs"]);
  assert.deepEqual(built.rows[0]!.customFieldValues, { f1: "Platform" });
  assert.deepEqual(built.customFields, [{ id: "f1", name: "Owner", type: "TEXT" }]);
}

// The filename is the List name slug plus the UTC export date, and stays
// safe for a Content-Disposition header whatever the List is called.
{
  const now = new Date("2026-10-02T23:30:00.000-05:00"); // already Oct 3 in UTC
  assert.equal(buildExportFilename("Platform Retrofit!", now), "platform-retrofit-2026-10-03.csv");
  assert.equal(buildExportFilename('  Q4 "Plan" / résumé; \r\nx ', now), "q4-plan-r-sum-x-2026-10-03.csv");
  assert.equal(buildExportFilename("!!!", now), "list-export-2026-10-03.csv");
  assert.equal(buildExportFilename("", now), "list-export-2026-10-03.csv");
  assert.ok(buildExportFilename("a".repeat(500), now).length < 100);
}

// A Custom Field header is user-typed text, so it is formula-neutralized
// too; so is a stored Date value that does not parse as a date.
{
  const listExport: ListExport = {
    customFields: [
      { id: "h", name: "=cmd", type: "TEXT" },
      { id: "d", name: "When", type: "DATE" },
    ],
    rows: [row({ customFieldValues: { d: "=HYPERLINK(1)" } })],
  };
  assert.equal(headerOf(listExport), `${FIXED_HEADER},'=cmd,When`);
  assert.ok(bodyOf(listExport).endsWith(",'=HYPERLINK(1)\r\n"), bodyOf(listExport));
}

async function run() {
  // The download response carries the CSV with attachment and no-store
  // headers; a refused export is a bare 404.
  {
    const ok = toCsvDownloadResponse({ status: "ok", filename: "plan-2026-10-02.csv", body: "a,b\r\n" });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("Content-Type"), "text/csv; charset=utf-8");
    assert.equal(ok.headers.get("Content-Disposition"), 'attachment; filename="plan-2026-10-02.csv"');
    assert.equal(ok.headers.get("Cache-Control"), "no-store");
    assert.equal(await ok.text(), "a,b\r\n");

    const refused = toCsvDownloadResponse({ status: "not-found" });
    assert.equal(refused.status, 404);
    assert.equal(await refused.text(), "");
  }

  console.log("list csv export serializer tests passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
