# Grill Session: Export CSV for a List

## Context

Design ticket under the "Wire up all backend-ready features to the frontend" wayfinder map, resolving [#57](https://github.com/codesuke/ListItUp/issues/57): the disabled "Export CSV" button on the List page. ADR 0012 and `docs/Specs-Planned/reports-and-analytics.md` already settle that CSV export is core v1, List-scoped, and served from a Route Handler. This session settles columns, access, archived Items, and delivery details.

Research going in: Saved Reports and Report filters are not built yet (no Report model in the schema; `lib/report/` only holds `list-dashboard`). The List page has no filter UI. Route Handlers already exist for attachments.

## Questions

### 1. Whole List or a Report's results?

**Recommended answer**: Export the whole List's Items now; filter-aware export arrives with Saved Reports and reuses the same serializer.

**User answer**: Go with recommended.

**Settled outcome**: The button exports every Item in the List, unfiltered. This narrows ADR 0012's "a Report's current results" for the interim (see the ADR addendum).

### 2. Who may export?

**Recommended answer**: Anyone with Workspace or List access, including Viewers and List Viewers; not Guests.

**User answer**: Go with recommended.

**Settled outcome**: Export is a read, so the Viewer ceiling does not block it. Guests cannot export, since the data would leave the system and they are external.

### 3. Archived Items?

**Recommended answer**: Always include, with State = Archived.

**User answer**: Go with recommended.

**Settled outcome**: Archived Items are included; no option dialog.

### 4. Columns?

**Recommended answer**: Item ID, Title, Parent Item, Section, State, Blocker, Priority, Assignees, Labels, Start Date, Due Date, Creator, Created, Updated, then one column per Custom Field in definition order. Multi-values joined with `; `, Assignees by Display Name, ISO 8601 dates. Excluded: Notes, Personal Notes, Attachments, Dependencies, Assignee emails.

**User answer**: Agreed.

**Settled outcome**: As recommended. Personal Notes must never appear in an export.

### 5. Delivery?

**Recommended answer**: GET Route Handler linked by a plain download link; authorization via `lib/permissions/`; `Content-Disposition: attachment`, `Cache-Control: no-store`.

**User answer**: Agreed.

**Settled outcome**: Route Handler, per the spec and the attachments route pattern.

### 6. Formula injection?

**Recommended answer**: The serializer prefixes `'` to text cells starting with `= + - @`, tab, or carriage return.

**User answer**: Agreed.

**Settled outcome**: Handled centrally in the serializer with a unit test; generated numeric/date columns are exempt.

### 7. File format?

**Recommended answer**: UTF-8 with BOM, CRLF, RFC 4180 quoting, header row; ordered by Section order then Item position, children directly after their parent; blank Section for unsectioned Items.

**User answer**: Agreed.

**Settled outcome**: As recommended.

### 8. Custom Field cells and header collisions?

**Recommended answer**: Text/Number as typed, Dropdown as option label, Date as `YYYY-MM-DD`, unset as empty. A header colliding with a fixed column or another field gets ` (custom)` (plus a number if needed).

**User answer**: Agreed.

**Settled outcome**: As recommended; columns are never merged or dropped.

### 9. Filename?

**Recommended answer**: `{list-name-slug}-{YYYY-MM-DD}.csv` (UTC date), falling back to `list-export`; slug sanitized for the header.

**User answer**: Agreed.

**Settled outcome**: As recommended.

### 10. Guardrails and audit trail?

**Recommended answer**: None in v1: no row cap, audit log, or rate limit.

**User answer**: Agreed.

**Settled outcome**: Revisit only if scale or abuse demands it.

### 11. Archived Lists and button visibility?

**Recommended answer**: Archived Lists remain exportable. The button is hidden for users who cannot export. A direct URL hit by a Guest returns 404.

**User answer**: Agreed.

**Settled outcome**: As recommended; the button replaces the disabled stub.
