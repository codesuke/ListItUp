# ListItUp — Frontend/UI Build Overview

A plan-language walkthrough of every ticket that has real UI in scope, for whoever is building screens/components. Backend-only tickets (schema, permission resolution, notification triggers) are omitted — see the GitHub issue tracker (`codesuke/ListItUp`) if you need those for context.

Product shape: ListItUp is a Todoist/Asana-style work tracker with Workspaces (shared) and a Personal Space (private), containing Lists, which contain Items (tasks), organized into Sections and viewable as List/Board/Calendar/Timeline/Files/Dashboard.

Every ticket below ships its own backend logic (`lib/<feature>/`) alongside the UI — so expect the UI to be gated by real role checks (a disabled/hidden control isn't just cosmetic, the server rejects the action too). Where a control should be hidden or disabled for certain roles, it's called out.

Issue numbers refer to GitHub issues on `codesuke/ListItUp`; open `gh issue view <n>` or the repo's Issues tab for full acceptance criteria.

---

## Build order (dependency chain)

Rough sequence — later items build on earlier ones:

1. **Lists** (#26 → #27 → #28, #29 → #30) — List browsing, per-List shell, roles, Sections, Item CRUD.
2. **Item views & facets** (#31, #32, #33, #34, #35, #36, #37, #38) — Board/Calendar/Timeline views, then Labels/Custom Fields/Dependencies/Attachments/Notes, then archive browsing. All depend on #30.
3. **Navigation shell** (#39) — Workspace switcher + Personal Space nav. Can start anytime.
4. **Profile** (#40) — independent, can start anytime.
5. **My Tasks** (#42 → #43, #44, #45) — cross-Workspace task view, then its extra views/actions/quick-add.
6. **Home** (#46) — depends on #39 (nav) and #42 (My Tasks core).
7. **Updates/notifications** (#47 → #48, #49) — Activity tab first, then preferences and the other tabs.
8. **Dashboards & analytics** (#51, #52 → #54, #55, #56, #57 → #58) — List Dashboard and My Tasks Dashboard widgets, then heatmap/progress/contribution/radar charts, then the peer-comparison toggle.

---

## 1. Lists

### #26 — List creation, lifecycle & List-browsing page

- A List-browsing page scoped to whichever Workspace or Personal Space is currently open.
- Search by name; filter by Status, Members, Starred.
- Star/unstar toggle per List (per-user, doesn't affect others' view).
- Status control (`ON_TRACK` / `ON_HOLD` / `COMPLETED` / `DROPPED`) — editable only by a List Lead or Workspace Admin.
- Archive/Restore action, plus an **Archived** tab on the browsing page.
- **UI gating:** creating a List inside a shared Workspace is Owner/Admin-only; Personal Space creation is open to anyone.

### #27 — Per-List page shell + Overview tab

- Tab bar on every List: **List, Board, Calendar, Files, Timeline, Dashboard, Messages** — build all seven tabs now. Dashboard and Messages render as visible "coming soon" placeholders (real content ships later; Messages is a v2 feature, don't build its content at all).
- Overview tab: shows Description + a read-only Roles list (Lead/Member/Viewer).
- Description is editable, but only by a List Lead or Workspace Admin.

### #28 — List-level role management

- The mutating half of Overview's Roles panel: add/remove Member or Viewer. (Guest access was removed — ADR 0022.)
- **UI gating:** only a List Lead can add/remove Member/Viewer. Everyone else sees the panel read-only (from #27) or not at all.

### #29 — Section management + List view

- The **List view**: Items grouped into Sections (default grouping).
- Section actions: Add, Rename, Duplicate, Delete, reorder (drag or similar), Expand/Collapse per Section, "Hide Empty Sections" toggle.
- **"Add Rule"** is just a grouping-config control (pick which field groups the view) — not an automation/rule engine, don't build automation UI here.
- **UI gating:** Section management available to List Lead/Member/Workspace Admin-Owner; List Viewer read-only.

### #30 — Item CRUD & core lifecycle

- Item creation form: title, Section, Assignees, Priority, due date.
- Item detail surface (a panel or page) showing: title, Section, Assignees, Priority, due date, state, Blocker reason.
- State control: `TO_DO` / `IN_PROGRESS` / `BLOCKED` / `COMPLETE` / `ARCHIVED`. Moving into `BLOCKED` must prompt for a short reason (required field, not optional).
- Any single Assignee can mark Complete themselves — no "all assignees must agree" flow.
- Nested child Items (subtasks-via-parent-item, arbitrary depth) — needs some kind of indent/tree UI in the Item detail or List view.
- **UI gating:** create/edit hidden or disabled for List Viewer.

---

## 2. Item views & facets

(all extend the Item detail surface and/or List page tabs built above)

### #31 — Board view

- Kanban-style board, columns are a **user-selectable field** (Section, state, Assignee, etc.) — not hardcoded to state.
- Drag an Item to a different column → updates that field on the Item (e.g. drag into "Blocked" column triggers the state transition, including prompting for the Blocker reason).

### #32 — Calendar view

- Places Items on the calendar day matching their due date. Items without a due date: excluded or shown in a separate "no due date" area (your call — just be consistent and document it).

### #33 — Timeline view

- Gantt-style date bars per Item with a due date (and start date if present).
- **Do not render dependency arrows** in this ticket — Timeline stays bars-only for now even though Dependency data exists.

### #34 — Label & Custom Field facets

- **Labels:** free-text/color chips, apply/remove from Item detail. Creating new Labels is Owner/Admin-only in a shared Workspace, unrestricted in Personal Space — but _applying_ an existing Label is open to any List Member.
- **Custom Fields:** List Lead/Admin defines fields (Text, Number, Dropdown, Date) at the List level (probably a settings panel); any List Member can fill in a Custom Field's value on an Item. Extend the Item detail surface to show/edit these.

### #35 — Dependency facet

- "Blocks" / "is blocked by" links between Items, including across different Lists.
- Purely informational — no automatic state changes, don't imply otherwise in the UI (e.g. no "unblock" button that changes state).
- Show both directions in Item detail.

### #36 — Attachment facet + Files view

- File upload control on Item detail. Accepted types: ZIP, images, PDFs, common office docs; 1GB cap; no in-app preview, no ZIP-browsing (download only).
- **Files view** (new List tab): aggregates every Attachment across the whole List's Items in one list/grid.

### #37 — Note + @Mention + Personal Note facet

- Notes thread on Item detail with `@mention` autocomplete (should only suggest Users who already have access to that Item).
- Separate **Personal Note** field on an Item, visible only to the current user if they're an Assignee — needs a clear "only you can see this" affordance, distinct from the shared Notes thread.

### #38 — Archived-Item browsing/restore

- Inside a List's own **List** and **Board** views (not the List-browsing page's Archived tab from #26, which is for whole archived Lists): an "Archived" filter/toggle showing that List's archived Items, each with a Restore action.

---

## 3. Navigation & workspace switching

### #39 — Workspace switcher + Personal Space nav

- Switcher dropdown/menu: lists only shared Workspaces the user belongs to.
- **Personal Space** is a separate, always-visible pinned nav section (collapsed by default, expandable) — never mixed into the switcher's list.
- Picking a Workspace navigates to that Workspace's Home.

### #40 — Profile page

- Cross-workspace identity page: avatar, Display Name, About Me (new field) — all editable by the signed-in user for themselves only.
- No work-related widgets here (no task counts, no goals) — keep it purely identity/bio.

---

## 4. My Tasks

### #42 — My Tasks core

- A unified, cross-Workspace list of Items assigned to the current user (replaces the current placeholder page). Each Item shows a tag/badge for its source Workspace.
- Default filter: only `TO_DO` and `BLOCKED` shown; user must explicitly opt in to see `COMPLETE`/`ARCHIVED`.
- Default sort: overdue first → High Priority → nearest due date → undated last.
- Filter by source Workspace.
- Completing an Item here must visually/behaviorally be the same Item as everywhere else (not a separate copy) — reflect state changes live.

### #43 — My Tasks additional views: Board/Calendar/Files + reserved Dashboard tab

- Same Board/Calendar/Files view patterns as the per-List versions, applied to the cross-Workspace My Tasks Item set.
- Dashboard tab: visible but placeholder-only for now (real widgets land in #52/#54-58).

### #44 — My Tasks actions: Add Task/Search/Filter/Sort/Group/Share

- Toolbar: Add Task, Search, Filter, Sort, Group controls over the My Tasks item set.
- **Share**: copies a direct link to one Item — that's it, no broader sharing UI. The link still respects normal access rules when opened (someone without access gets denied, even with the link).

### #45 — My Tasks Quick-Add capture

- A single-line "Quick-Add" text input that parses shorthand as you type/submit — dates, `@assignee`, `#label`, list name — into the right Item fields, similar to Todoist's quick-add syntax.
- No List specified → goes to the user's Inbox List by default.

---

## 5. Home

### #46 — Home page

- Per-Workspace landing page (replaces current placeholder). Keep it lightweight:
  - Greeting header: current date + time-based greeting only ("Good morning") — **no numeric stats**, don't invent a metrics row here.
  - **My Tasks preview** widget (small slice of the My Tasks data, scoped to current Workspace).
  - **Recent Lists** widget.
  - **"Items I've Assigned"** widget — Items the current user created and assigned to at least one other person.
  - Explicitly **no**: Collaborators/People widget, out-of-office indicator, team tags, app-store-style widgets, gamification/streaks.

---

## 6. Updates (notifications)

### #47 — Updates: Activity tab + unread badge + nav item

- Top-level nav item "Updates" with an unread-count badge.
- **Activity** tab (default view): feed of notifications (assignee changes, notes, state changes, mentions affecting the user), newest-first, with read/unread styling. Opening a notification marks it read and decrements the badge.

### #48 — Updates: Manage Notifications preferences page

- A settings page: one row per notification type (Assignee change, Note/Mention, Item state change, due-date reminder) with a toggle to turn it off for yourself.

### #49 — Updates: Bookmarks + Archive + @Mentioned tabs

- Three more tabs on Updates, reusing Activity's list-rendering pattern:
  - **Bookmarks** — notifications the user starred from Activity.
  - **Archive** — notifications the user archived (soft-hide, not delete).
  - **@Mentioned** — only notifications where the user was directly mentioned.

---

## 7. Dashboards & analytics widgets

These fill in the "Dashboard" tab placeholders left by #27 (per-List) and #43 (My Tasks). Every chart here is **aggregate/normalized data only** — no raw per-person leaderboards unless the org explicitly opts in (#58).

### #51 — List Dashboard: count/breakdown widgets

- Total / Completed / Incomplete / Overdue counts.
- Breakdown by Section and by state (bar/pie, your call).
- Completion-over-time chart.

### #52 — My Tasks Dashboard: count/breakdown widgets

- Same widget categories as #51 but scoped to the current user's assigned Items across all their Workspaces, and broken down by **source List** instead of Section.

### #54 — Completion heatmap

- Calendar-heatmap style ("GitHub contribution graph" look) showing completion density over time. Appears on both List Dashboard and My Tasks Dashboard. Aggregate only, never broken out per-Member.

### #55 — Progress graph

- A single "how close to done" progress indicator/chart for a List (or the user's personal queue on My Tasks). Both Dashboards.

### #56 — Contribution map

- Shows how consistently work is moving forward.
- On **My Tasks**: personal-only (never shows anyone else's data).
- On **List Dashboard**: one row per List Member, visible to any Member by default — but plotted as a **normalized rate/share**, never a raw item count, so it can't read as a raw-output leaderboard.

### #57 — Radar chart

- Shows attention balance across To Do / Blocked / Overdue / Complete.
- Same personal-only-on-My-Tasks vs. per-Member-on-List-Dashboard split as #56, same normalized-metric-only guardrail.

### #58 — Peer comparison setting

- A Workspace-level toggle (Owner/Admin only), off by default, that unlocks a more directly comparative view layered on top of #56/#57's charts. When off, those charts behave exactly as in #56/#57. The comparative view's exact visual design is open — just keep it normalized-metric, never raw count.

---

## Cross-cutting UI notes

- **Role gating is real, not cosmetic.** Every "Lead/Admin only" or "Viewer read-only" note above is enforced server-side too — disabling/hiding a control in the UI is the right pattern, but it won't be the only check.
- **Reserved tabs:** the List page's Dashboard/Messages tabs and My Tasks' Dashboard tab are built once (as visible placeholders) and filled in later — build them as an explicit empty/coming-soon state, not omitted entirely.
- **No stats invention:** where a ticket says "no numeric stats" or similar, that's deliberate — don't add a metrics widget that isn't specified, even if it seems natural.
- **Consistent view patterns:** Board/Calendar/Timeline/Files are each built once for a single List and then reused (not rebuilt) for My Tasks — worth sharing components across the two contexts from the start.
