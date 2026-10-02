# PRD: List CSV Export

Resolves [#57](https://github.com/codesuke/ListItUp/issues/57). Decisions and rationale: `docs/QnA/list-csv-export.md`. Builds on ADR 0012 (see its addendum).

## Problem Statement

The List page has an "Export CSV" button that is permanently disabled. A User who wants to share a List's contents outside ListItUp, archive a point-in-time copy, or analyze it in a spreadsheet has no way to get the data out.

## Solution

Enable the button. It downloads a single CSV file containing every Item in the List — Archived Items included — with one row per Item and one column per Item attribute and Custom Field. Anyone with Workspace or List access can export, except Guests. Saved Reports and filter-aware export are a later slice that reuses the same serializer.

## User Stories

1. As a List Member, I want to download the List's Items as a CSV file, so that I can share or archive them outside ListItUp.
2. As a List Viewer or Workspace Viewer, I want to export the List, so that read-only access still lets me work with the data in a spreadsheet.
3. As a Workspace Owner or Admin, I want to export any List in my Workspace, including private ones.
4. As a User, I want Archived Items included and clearly marked, so that the file is a complete record.
5. As a User, I want each Custom Field to appear as its own column, so that List-specific structure survives the export.
6. As a User, I want nested Items to appear directly after their parent with a Parent Item column, so that hierarchy is readable in a flat file.
7. As a User opening the file in Excel or Sheets, I want non-ASCII names to display correctly and typed text never to execute as a formula.
8. As a Guest, I do not see an Export button and cannot fetch the export URL, since the data would leave the system and I am external to the Workspace.
9. As a User, I want the file named after the List and the export date, so that downloads are easy to tell apart.

## Implementation Decisions

- **Seam**: a new `lib/report/list-csv-export.ts` (alongside `list-dashboard.ts`) with two parts: a data-loading function that reads the List's Items and returns a plain row model, and a pure `serializeListCsv()` function that turns that model into CSV text. The future Saved Report slice passes a filtered Item set to the same serializer.
- **Delivery**: GET Route Handler `app/api/workspaces/[workspaceId]/lists/[listId]/export/route.ts`, following the attachments route pattern. Response headers: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment` with the filename, `Cache-Control: no-store`. The page's button becomes a plain download link, so no client JS is needed.
- **Authorization**: `resolveListAccess()` currently returns `READ` for both a List Viewer and a Guest, so the level alone cannot tell them apart. Add a small `canExportList` check in `lib/permissions/` that requires access ≥ `READ` and excludes Guest-only access (a Guest grant with no Workspace membership and no List role). Do not query `Guest`/`ListMember` directly from the route. A Guest or any user without access gets 404, matching the other List routes, so the response does not reveal the List exists. The page hides the button using the same check.
- **Rows**: every Item in the List, including `ARCHIVED`. Ordered by Section order, then creation order (Item has no position field); children directly after their parent. Unsectioned Items have a blank Section cell. Archived Lists remain exportable.
- **Columns, in order**: Item ID, Title, Parent Item (parent's title, blank if top-level), Section, State, Blocker, Priority, Assignees, Labels, Start Date, Due Date, Creator, Created, Updated, then one column per Custom Field definition in definition order.
- **Cell formatting**: Assignees and Labels joined with `; `, Assignees by Display Name (no emails). State and Priority as their domain labels, with Archived Items showing `Archived`. Dates and timestamps as ISO 8601; Custom Field Date as `YYYY-MM-DD`. Dropdown as the option label; Text and Number as typed; unset as an empty cell.
- **Header collisions**: a Custom Field header that equals a fixed column or another field's header gets ` (custom)` appended, with a number added if that still collides. Columns are never merged or dropped.
- **Excluded data**: Notes, Personal Notes (private, must never appear), Attachments, Dependencies, Assignee emails.
- **Format**: UTF-8 with a BOM, CRLF line endings, RFC 4180 quoting, header row.
- **Formula injection**: the serializer prefixes a single quote to any text cell starting with `=`, `+`, `-`, `@`, tab, or carriage return. Custom Field headers and any Custom Field Date value that does not parse as a date count as text too. Generated numeric and date columns (and Custom Field Number) are exempt.
- **Filename**: `{list-name-slug}-{YYYY-MM-DD}.csv` using the UTC date, falling back to `list-export` if the slug is empty. The slug is sanitized so it is safe in `Content-Disposition`.
- **No guardrails in v1**: no row cap, audit log, or rate limit.
- **Docs on ship**: move this file to `docs/Specs-Completed/`, and remove the "Export CSV ships with the Reports & Analytics spec" tooltip text along with the disabled stub.

## Testing Decisions

- Highest seam: `serializeListCsv()` unit tests in `lib/report/list-csv-export.test.ts` against a fixed row model, asserting exact CSV output: header order, quoting of commas/quotes/newlines, BOM and CRLF, multi-value joining, ISO dates, empty unset cells, header-collision suffixing, and formula-injection prefixing (including that generated numeric/date columns are not prefixed).
- Data-loading integration test (`list-csv-export.integration.test.ts`, real Prisma): Archived Items included; ordering with Sections and nested children; Parent Item column; Custom Field values per Item; Personal Notes and Notes never present; Assignees as Display Names.
- Permission tests in `lib/permissions/list-access.test.ts`: Lead, Member, List Viewer, Workspace Viewer, Owner, and Admin can export; Guest and non-members cannot.
- Route behavior: the status/header mapping lives in `toCsvDownloadResponse()` (200 with the correct headers and filename; bare 404), unit-tested without a Next.js request scope; Guest, non-member, and nonexistent-List 404s are covered at `exportListCsv()` in the integration test, since a real request scope is unavailable under tsx.
- Page smoke test: the button renders as an enabled link for an allowed User and is absent for a Guest.
- No browser/E2E coverage required.

## Out Of Scope

- Filter-aware export and Saved Reports (reports-and-analytics spec); this slice exports the whole List.
- Export from My Tasks or any cross-List or Workspace-wide export.
- Options dialogs (include-archived toggle, column picker), other formats (XLSX, JSON), scheduled or emailed exports.
- Dependencies, Notes, Attachments, and Assignee emails in the file.
- Row caps, audit logging, and rate limiting.

## Further Notes

- If Saved Reports ship later, ADR 0012's addendum already records that export becomes filter-aware through the same serializer.
- If export abuse or very large Lists become real, a row cap and an audit event are new decisions, not assumed here.
