# Chat Channels Bypass the Viewer/Guest Read-Only Ceiling

`docs/ADR/0009` established that `Viewer` (at either the Workspace or List tier) is a hard permission ceiling: no matter what List-level role a Viewer is otherwise given, their effective access never exceeds read-only. `Guest` is even narrower — read-only access to one specific List, with no Workspace identity at all. Both rules were written as blanket statements covering "that List's content."

While designing the v1 Chat + VC system's scope (`docs/QnA/chat-vc-system-scope.md`, resolving [issue #12](https://github.com/Dhruvivek/ListItUp/issues/12)), the product call was made that a List's `Channel`s (its Discord-style chat surface) are exempt from this ceiling: any User with any form of access to a List — Lead, Member, Viewer, or an external Guest — can read, post messages, and attach files in that List's Channels. Only Channel *management* (creating, renaming, deleting, or reordering a Channel) stays gated to List Lead or Workspace Admin.

This is treated as a deliberate, narrow exception rather than a loosening of the general rule: the ceiling exists to protect the List's actual work record (Items, their state, assignments, custom fields) from being altered by someone who was only supposed to observe it. Conversation is not the work record — a Viewer or Guest posting a comment doesn't change any Item's state, assignment, or data. Message *deletion* is still gated (sender, or List Lead/Workspace Admin), so the exception doesn't extend to erasing others' contributions.

## Status

accepted (Guest half superseded by ADR 0022, which removed Guests; the Viewer exception stands)

## Consequences

- Every permission check on Channel read/post/attach must treat "has any access to this List" (including Guest) as sufficient — it must NOT reuse the same read-only gate that Item mutations use for Viewer/Guest.
- Channel *management* actions (create/rename/delete/reorder Channel) still need the stricter List Lead/Workspace Admin gate, so a single "can post in this List's chat" check is not sufficient for those actions — they need a separate authorization check.
- `CONTEXT.md`'s `Viewer` and `Guest`/`List Viewer` entries must state this exception explicitly, so a future feature that reuses the "Viewer/Guest are read-only" assumption doesn't silently break by copying the ceiling into a chat-adjacent feature (or by missing that chat is the one place it doesn't apply).
- Any future List-scoped content type (beyond Items and Channels) must explicitly decide which side of this line it falls on — this ADR does not establish a general "read-only ceiling doesn't apply to non-Item content" rule, only that Channels specifically are exempt.
- Since a Guest has no Workspace identity, their Channel messages must still be attributable and moderatable (sender-or-Lead/Admin delete) even though they never appear in any Workspace-level membership list.
