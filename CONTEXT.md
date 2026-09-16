# ListItUp

ListItUp helps people turn scattered intentions into clear, usable lists — and coordinate the work that comes out of them, alone or with a team. This glossary defines product language for the repo so specs, issues, tests, and UI copy use the same terms.

## Language

**List**:
A named container for related Items a user wants to remember, organize, compare, or complete. A List may group its Items into Sections and support multiple views over the same Items.
_Avoid_: Board, project, bucket

**Starred**:
A per-User boolean flag on a List marking it for quick access, filterable on the List-browsing page.
_Avoid_: Favorite, pinned, bookmarked List

**List Status**:
The coarse health of a List as a whole, set by its members: On Track, On Hold, Completed, or Dropped. Distinct from an Item's lifecycle state.
_Avoid_: Project status, health, phase

**Section**:
A named grouping of an Item's siblings within a List, used to organize a List's Items (e.g. by stage or theme).
_Avoid_: Column, stage, bucket

**Channel**:
A named, ongoing text conversation within a List, organized Discord-style — a List may have multiple Channels, each with its own message history, shown in the List's Messages view. Every List gets one un-deletable default Channel on creation; a List Lead or Workspace Admin can create, rename, delete, or reorder additional ones. Any User with access to the List — including a List Viewer or a Guest — can read, post, and attach files in its Channels, even though they cannot edit that List's Items (see Viewer, Guest). A sender can delete their own message; a List Lead or Workspace Admin can delete anyone's. v2 feature — not built in v1.
_Avoid_: Thread, chat room, chat (as a noun for the concept itself)

**Item**:
A single entry inside a List, or a nested child of another Item. An Item may represent a task, idea, product, note, or decision candidate depending on the List's purpose, and may carry accountability details (Assignees, state, due date) when action is required. Item capabilities are consistent in personal and shared Workspaces.
_Avoid_: Todo, card, row, task, subtask

**Assignee**:
One of the Users responsible for moving an actionable Item forward. An Item may have zero or more Assignees. Any single Assignee can mark an accountable Item Complete.
_Avoid_: Owner, responsible person, accountable person

**Creator**:
The User who originally created an Item. Immutable — does not change as an Item's Assignees change.
_Avoid_: Author, owner

**My Tasks**:
A unified personal planning view that gathers Items assigned to the current User, including Items from shared Workspaces, with each Item's source Workspace retained as context. A shared Item shown in My Tasks remains the same Item: its completion and other changes update the shared Workspace directly.
_Avoid_: Mirrored task, synced task, duplicate

**Home**:
A per-Workspace landing page shown after opening a Workspace, surfacing widgets scoped to that Workspace such as a My Tasks preview, Recent Lists, and Items I've Assigned.
_Avoid_: Dashboard, Overview

**Profile**:
A User's cross-Workspace personal identity page (avatar, Display Name, About Me). Independent of any single Workspace and carries no work widgets.
_Avoid_: Account settings, Dashboard

**Updates**:
A top-level page listing notifications relevant to the current User (Assignee changes, Notes, Item state changes, Mentions), organized into tabs (Activity, Bookmarks, Archive, @Mentioned). Distinct from the Inbox List.
_Avoid_: Inbox, notification center, activity hub

**Note**:
A lightweight text update attached to an Item for context or decisions.
_Avoid_: Comment, reply, thread

**Mention**:
A `@name` reference to a User inside a Note, notifying that User. Only Users who already have access to the Note's Item (its Assignees, or the List's Members/Leads/Viewers/Guests) can be mentioned.
_Avoid_: Tag, ping

**Direct Message**:
A private 1:1 text conversation between two Users who share at least one Workspace, independent of any List. Lives in its own top-level nav surface, separate from Updates and Profile. Reuses the same Attachment infrastructure as Items and Channels for file sharing. v2 feature — not built in v1.
_Avoid_: Private message, chat, thread

**Personal Note**:
A private planning note a User attaches to a shared Item they are assigned to. It is visible only to that User and does not change the shared Item or its team-visible Notes.
_Avoid_: Private comment, hidden task

**Attachment**:
A file attached to an Item to provide supporting project context.
_Avoid_: Upload, asset, document store

**User**:
The person using ListItUp to create, manage, or review Lists and Items. A User may belong to multiple Workspaces.
_Avoid_: Customer, client, account

**Display Name**:
A short, non-unique name a User chooses for membership and activity labels.
_Avoid_: Username, handle, full legal name

**Priority**:
The coarse importance level of an Item: Low, Normal, or High.
_Avoid_: Urgency, severity, rank

**Label**:
A freeform, multi-valued, User-defined tag on an Item, used to organize and filter Items across Lists (unlike Section, which groups Items within one List). In a Personal Space, the User creates their own Labels freely. In a shared Workspace, only the Workspace Owner or Admin can create a Label, mirroring List-creation rights; any Member with access to an Item can apply an existing Label to it.
_Avoid_: Tag (as a verb, to avoid confusion with Mention), category

**Custom Field**:
A typed field (Text, Number, Dropdown, or Date) defined on a List by its Lead or a Workspace Admin, with a value set per Item by any List Member. Distinct from Label: a Custom Field is structured and scoped to one List; a Label is freeform and spans Lists.
_Avoid_: Property, attribute, metadata field

**Dependency**:
A directional link between two Items — one `blocks`, the other `is blocked by` — manageable across Lists. Purely informational: adding a Dependency does not change either Item's lifecycle state.
_Avoid_: Blocker (the freeform reason an Item is Blocked, a different concept), predecessor/successor, link

**Personal Space**:
A single-member operating space where a User keeps private Lists, provisioned automatically for the User after verified first sign-in. Always present for a User regardless of which Workspace they currently have open.
_Avoid_: Personal Workspace, personal workspace, private space

**Workspace**:
A shared operating space where two or more Users collaborate on Lists. A User may create or join multiple Workspaces.
_Avoid_: Dashboard, tenant, organization, personal space, project space

**Demo Workspace**:
A pre-filled Workspace provisioned automatically alongside a User's Personal Space after verified first sign-in, giving them real-looking Lists, Items, and teammates to explore before creating anything of their own. Functionally an ordinary Workspace (a User may edit or leave it like any other); distinguished only by having been auto-provisioned with sample content rather than by any different capability.
_Avoid_: Sample workspace, tutorial, onboarding workspace

**Workspace Owner**:
The sole User with ultimate authority over a Workspace. Cannot be removed, demoted, or modified by any other User, and can only transfer ownership explicitly. Has implicit access to every List in the Workspace, including private ones.
_Avoid_: Admin, superuser, account holder

**Admin**:
A Workspace-level role for a User who can manage the Workspace, its members, and its Lists (including creating new Lists). Has implicit access to every List in the Workspace, including private ones. Cannot remove, demote, or replace the Workspace Owner.
_Avoid_: Workspace owner, manager, superuser

**Platform Operator**:
An internal ListItUp role authorized to manage product-wide security and operational concerns. It is distinct from Workspace roles and never grants access merely through Workspace membership.
_Avoid_: Workspace admin, superuser, customer support agent

**Member**:
A Workspace-level role for a User who belongs to the Workspace but has no access to any List by default, and cannot create Lists. A Member can only access a List once explicitly added to it, where their List-level role determines what they can do there.
_Avoid_: Collaborator, teammate, contributor

**Viewer**:
A Workspace-level role for a User who is strictly read-only, both in the Workspace and in any List they are explicitly added to. Viewer is a permission ceiling: even if given a higher List-level role, a Viewer's effective permissions never exceed read-only. This ceiling applies to Items and List content; it does not extend to a List's Channels, where a Viewer can read, post, and attach files like any other role (see Channel, ADR 0013).
_Avoid_: Guest, observer, read-only user

**List Lead**:
A List-level role for a User who manages one specific List: its settings, its List-level membership, and its Guests. A List may have one or more Leads.
_Avoid_: Project lead, list owner, list admin

**List Member**:
A List-level role for a User who can create and edit Items within one specific List.
_Avoid_: Collaborator, contributor

**List Viewer**:
A List-level role for a User who can read one specific List's Items without changing them. Can nonetheless read, post, and attach files in that List's Channels — the read-only ceiling covers Items, not Channels (see Channel, ADR 0013).
_Avoid_: Guest, observer

**Guest**:
An external person granted read-only access to one specific List, without joining the Workspace. A Guest has no Workspace-level identity and no visibility into anything outside the List(s) they were explicitly granted access to. The same person may hold independent Guest access to multiple Lists. A Guest can nonetheless read, post, and attach files in that List's Channels — the read-only grant covers Items, not Channels (see Channel, ADR 0013).
_Avoid_: External collaborator, client, viewer

**Capture**:
The act of quickly adding an Item before fully organizing it.
_Avoid_: Dump, jot, submit

**Inbox List**:
The default List in a Personal Space that receives newly captured Items before the User organizes them elsewhere.
_Avoid_: Unsorted list, backlog

**Organize**:
The act of refining a List by grouping, ordering, editing, completing, or removing Items.
_Avoid_: Manage, sort out, clean up

**To Do**:
The state of an Item that has not yet been started by its Assignee(s).
_Avoid_: Open, pending, backlog

**In Progress**:
The state of an Item that an Assignee has started working on but not yet completed.
_Avoid_: Started, active, doing

**Blocked**:
The state of an Item whose progress is stopped by an external dependency or unresolved decision.
_Avoid_: Stuck, waiting, on hold

**Blocker**:
The short reason explaining why an Item is Blocked.
_Avoid_: Impediment, dependency record, issue

**Complete**:
The state of an Item that no longer needs attention. Any single Assignee can mark an Item Complete.
_Avoid_: Done, closed, resolved

**Archive** / **Archived**:
The act (and resulting state) of removing a List or Item from active use while preserving it for later reference.
_Avoid_: Delete, hide, retire

**Restore**:
The act of returning an Archived List or Item to active use.
_Avoid_: Unarchive, recover

**Report**:
A live summary view of a single List's Items, filtered by Assignee, state, or date. Any Member can name and save a Report's filter setup for reuse (private to them by default; re-opening it always re-runs against current data, never a frozen copy) and export its current results as a CSV file.
_Avoid_: Snapshot, document (a saved Report re-runs live; it does not freeze data)

**Analytics**:
Operational health signals derived from Items and Lists, such as completion rate, blocked count, overdue count, aging To Do Items, and Assignee workload, shown via widgets and visualizations (e.g. a completion heatmap, a per-Member contribution map, a progress graph, a state-imbalance radar chart) each tied to one specific accountability question.
_Avoid_: Productivity score, streak, leaderboard

**Dashboard**:
The View (alongside List, Board, Calendar, Files) available on My Tasks and on a List, showing widgets built from Report and Analytics data — completion/overdue counts, breakdowns by state/Section/List, and the Analytics visualizations.
_Avoid_: Report, Analytics (Dashboard is where you look at that data, not the data itself)

**Workload**:
A later-phase Analytics view, scoped to a single List, showing each Member's open-Item count so a Lead/Admin can spot who's overloaded or underused. Not a Workspace-wide or cross-List view.
_Avoid_: Portfolio, capacity plan

**Spec**:
A written plan for a product capability, usually stored under `docs/Specs-Planned/` until shipped.
_Avoid_: Brief, ticket, notes

**ADR**:
An architecture decision record stored under `docs/ADR/` when a durable technical decision needs context.
_Avoid_: Decision note, dev log
