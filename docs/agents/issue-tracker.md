# Issue Tracker: GitHub

Issues and PRDs for this repo live as GitHub Issues. Use the `gh` CLI for issue operations.

## Repository

`codesuke/ListItUp`

**History:** between 2026-08-26 and 2026-10-08 the tracker lived on `Dhruvivek/ListItUp` (the agent's fork) while the agent account only had read access to `codesuke/ListItUp`; early wayfinder tickets (#1–#11) and links to them in `docs/QnA/` still point there. As of 2026-10-08 the tracker is back on `codesuke/ListItUp`, which is `origin` in this clone. Pass `--repo codesuke/ListItUp` if `gh` resolves a different default.

## Conventions

- Create an issue: `gh issue create --title "..." --body "..."`
- Read an issue: `gh issue view <number> --comments`
- List issues: `gh issue list --state open --json number,title,body,labels,comments`
- Comment on an issue: `gh issue comment <number> --body "..."`
- Apply a label: `gh issue edit <number> --add-label "..."`
- Remove a label: `gh issue edit <number> --remove-label "..."`
- Close an issue: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` should do this automatically inside the clone.

## Local Spec Copies

GitHub Issues are the tracker. Durable product specs may also be copied into `docs/Specs-Planned/` and moved to `docs/Specs-Completed/` when shipped.

## When A Skill Says "Publish To The Issue Tracker"

Create a GitHub issue and apply the appropriate triage label from `docs/agents/triage-labels.md`.

## When A Skill Says "Fetch The Relevant Ticket"

Run `gh issue view <number> --comments`.

## Wayfinding Operations

For the `wayfinder` skill's map/ticket model:

- **The map**: a GitHub issue labeled `wayfinder:map`. Its tickets are its **native sub-issues** (GitHub's parent/child issue relation — confirmed available on this repo via `gh api repos/{owner}/{repo}/issues/{number}/sub_issues`).
- **Ticket type labels**: `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, `wayfinder:task` — one per ticket, alongside `wayfinder:map`'s child relation.
- **Claiming**: assign the ticket issue to the driving dev before work starts.
- **Blocking**: use GitHub's **native issue dependencies** (confirmed available via `gh api repos/{owner}/{repo}/issues/{number}/dependencies/blocked_by`, GET and POST). Add a blocking edge with:
  `gh api repos/{owner}/{repo}/issues/{blocked_number}/dependencies/blocked_by -X POST -f issue_id=<blocking_issue_node_id_or_id>`
  (check the exact payload shape against the current GitHub REST docs when wiring — this endpoint was in limited/beta rollout as of 2026-08-26).
- **The frontier**: open, unassigned child issues of the map with an empty `blocked_by` list. Query children via the sub-issues endpoint, then check each candidate's `dependencies/blocked_by` for open blockers.
- **Resolution**: post the answer as an issue comment, then `gh issue close <number> --comment "..."`.
