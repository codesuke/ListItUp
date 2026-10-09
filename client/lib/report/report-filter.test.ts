import assert from "node:assert/strict";

import { buildReportItemWhere, validateReportFilter, validateReportName } from "./report-filter";

// Name validation: trims, rejects empty, bounds length.
{
  assert.deepEqual(validateReportName("  Overdue this week  "), { valid: true, name: "Overdue this week" });
  assert.deepEqual(validateReportName("   "), {
    valid: false,
    reason: "Report name cannot be empty.",
  });
  assert.equal(validateReportName("x".repeat(101)).valid, false);
  assert.equal(validateReportName("x".repeat(100)).valid, true);
}

// An empty filter is valid — matches every Item on the List.
{
  const result = validateReportFilter({});
  assert.deepEqual(result, { valid: true, filter: {} });
}

// assigneeUserIds: array of non-empty strings, deduplicated.
{
  const result = validateReportFilter({ assigneeUserIds: ["u1", "u2", "u1"] });
  assert.deepEqual(result, { valid: true, filter: { assigneeUserIds: ["u1", "u2"] } });

  assert.equal(validateReportFilter({ assigneeUserIds: "u1" }).valid, false);
  assert.equal(validateReportFilter({ assigneeUserIds: [1] }).valid, false);
}

// states: array of valid ItemState values only.
{
  const result = validateReportFilter({ states: ["TO_DO", "BLOCKED"] });
  assert.deepEqual(result, { valid: true, filter: { states: ["TO_DO", "BLOCKED"] } });

  assert.equal(validateReportFilter({ states: ["NOT_A_STATE"] }).valid, false);
}

// dueAfter/dueBefore: must be valid dates, and dueAfter cannot be later than dueBefore.
{
  const result = validateReportFilter({ dueAfter: "2026-01-01", dueBefore: "2026-01-31" });
  assert.deepEqual(result, {
    valid: true,
    filter: { dueAfter: "2026-01-01", dueBefore: "2026-01-31" },
  });

  assert.equal(validateReportFilter({ dueAfter: "not-a-date" }).valid, false);
  assert.equal(
    validateReportFilter({ dueAfter: "2026-02-01", dueBefore: "2026-01-01" }).valid,
    false
  );
}

// Non-object filters are rejected outright.
{
  assert.equal(validateReportFilter(null).valid, false);
  assert.equal(validateReportFilter("filter").valid, false);
  assert.equal(validateReportFilter([]).valid, false);
}

// buildReportItemWhere: an empty filter scopes to the List only.
{
  assert.deepEqual(buildReportItemWhere("list-1", {}), { listId: "list-1" });
}

// buildReportItemWhere: every dimension is ANDed in; assignee/state filters
// are OR-matched within their own dimension via `in`.
{
  const where = buildReportItemWhere("list-1", {
    assigneeUserIds: ["u1", "u2"],
    states: ["TO_DO", "BLOCKED"],
    dueAfter: "2026-01-01T00:00:00.000Z",
    dueBefore: "2026-01-31T00:00:00.000Z",
  });

  assert.deepEqual(where, {
    listId: "list-1",
    assignees: { some: { userId: { in: ["u1", "u2"] } } },
    state: { in: ["TO_DO", "BLOCKED"] },
    dueDate: {
      gte: new Date("2026-01-01T00:00:00.000Z"),
      lte: new Date("2026-01-31T00:00:00.000Z"),
    },
  });
}

console.log("report filter test passed");
