# ListItUp

ListItUp helps people turn scattered intentions into clear, usable lists. This glossary defines product language for the repo so specs, issues, tests, and UI copy use the same terms.

## Language

**List**:
A named container for related things a user wants to remember, organize, compare, or complete.
_Avoid_: Board, project, bucket

**Item**:
A single entry inside a List. An Item may represent a task, idea, product, note, or decision candidate depending on the List's purpose, and may carry task-like accountability details when action is required. Item capabilities are consistent in personal and shared Workspaces.
_Avoid_: Todo, card, row, task

**My Tasks**:
A unified personal planning view that gathers Items owned by the current User, including Items from shared Workspaces, with each Item's source Workspace retained as context. A shared Item shown in My Tasks remains the same Item: its completion and other changes update the shared Workspace directly.
_Avoid_: Mirrored task, synced task, duplicate

**Note**:
A lightweight text update attached to an Item for context or decisions.
_Avoid_: Comment, reply, thread

**Personal Note**:
A private planning note a User attaches to a shared Item they own. It is visible only to that User and does not change the shared Item or its team-visible Notes.
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

**Owner**:
The User responsible for moving an actionable Item forward. In a personal Workspace, the Owner is usually the User who created the Item.
_Avoid_: Assignee, responsible person, accountable person

**Priority**:
The coarse importance level of an Item: Low, Normal, or High.
_Avoid_: Urgency, severity, rank

**Workspace**:
The operating space where one or more Users keep Lists. A personal Workspace is a single-member Workspace provisioned for its User after verified first sign-in; a User may also create or join shared Workspaces.
_Avoid_: Dashboard, tenant, organization, personal space, project space

**Admin**:
A Workspace role for a User who can manage the Workspace and its members.
_Avoid_: Workspace owner, manager, superuser

**Platform Operator**:
An internal ListItUp role authorized to manage product-wide security and operational concerns. It is distinct from Workspace roles and never grants access merely through Workspace membership.
_Avoid_: Workspace admin, superuser, customer support agent

**Member**:
A Workspace role for a User who can participate in shared work by creating or updating Lists and Items.
_Avoid_: Collaborator, teammate, contributor

**Viewer**:
A Workspace role for a User who can read shared Lists, Reports, and Analytics without changing work.
_Avoid_: Guest, observer, read-only user

**Capture**:
The act of quickly adding an Item before fully organizing it.
_Avoid_: Dump, jot, submit

**Inbox List**:
The default List in a personal Workspace that receives newly captured Items before the User organizes them elsewhere.
_Avoid_: Unsorted list, backlog

**Organize**:
The act of refining a List by grouping, ordering, editing, completing, or removing Items.
_Avoid_: Manage, sort out, clean up

**Open**:
The state of an Item that still needs attention from the Owner.
_Avoid_: Active, pending, todo

**Blocked**:
The state of an Item whose progress is stopped by an external dependency or unresolved decision.
_Avoid_: Stuck, waiting, on hold

**Blocker**:
The short reason explaining why an Item is Blocked.
_Avoid_: Impediment, dependency record, issue

**Complete**:
The state of an Item that no longer needs attention from the User.
_Avoid_: Done, closed, resolved

**Archive**:
The act of removing a List or Item from active use while preserving it for later reference.
_Avoid_: Delete, hide, retire

**Report**:
A live summary view of Items across Lists, usually filtered by Owner, state, date, or Workspace.
_Avoid_: Export, snapshot, document

**Analytics**:
Operational health signals derived from Items and Lists, such as completion rate, blocked count, overdue count, aging Open Items, and Owner workload.
_Avoid_: Productivity score, streak, leaderboard

**Spec**:
A written plan for a product capability, usually stored under `docs/Specs-Planned/` until shipped.
_Avoid_: Brief, ticket, notes

**ADR**:
An architecture decision record stored under `docs/ADR/` when a durable technical decision needs context.
_Avoid_: Decision note, dev log
