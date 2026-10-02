# Reports Support Saving and CSV Export

While grilling [#11](https://github.com/Dhruvivek/ListItUp/issues/11) (Reports/Analytics scope), we reversed the old model's explicit rule that a `Report` is a live view only, with no saved or exported documents (`docs/QnA/listitup-product-model.md` Q7). At the "medium fish" scale, a live-only Report can't support a recurring workflow — e.g. copying last week's completion numbers into an email, or re-checking the same filtered view every Monday — without re-building the filter from scratch each time.

Two separate capabilities cover that gap without turning `Report` into a document-management feature:

- **Save**: a Report's filter/setup can be persisted inside the app as a named, reusable definition. Re-opening it re-runs against current data — it is never a frozen snapshot. Any Member can save one, and it's private to its creator by default (no List/Label-style creation gate, since saving one doesn't restructure anything for anyone else).
- **Export**: a Report's current results can be downloaded as a CSV file. This is the only way data leaves the live system as a static artifact, and it's an explicit, one-off user action rather than an automatic or scheduled process.

v1 scope for both is List-scoped only — there is no cross-List or Workspace-wide ad-hoc Report surface, and no new top-level "Reports" nav item. Report-building lives inside a List's Dashboard tab.

## Status

accepted

## Consequences

- `CONTEXT.md`'s `Report` entry drops "_Avoid_: Export, snapshot, document" for export specifically; "snapshot"/"document" remain avoided as descriptions of the *save* mechanism, since a Saved Report always re-runs live rather than freezing data.
- No new storage model is needed for a frozen point-in-time record — a Saved Report is just a persisted filter definition, not a copy of the underlying Items.
- My Tasks does not get this surface in v1 — only a List's Dashboard does (`docs/QnA/reports-analytics-scope.md` Q16). My Tasks keeps its fixed Dashboard widgets only.
- If real demand emerges for cross-List or Workspace-wide reporting, or for frozen historical snapshots, that needs a fresh decision — this ADR only covers List-scoped, live-reissuing Saved Reports and CSV export.

## Addendum: whole-List export ships first

Until Saved Reports and Report filters exist, the List page's Export CSV button exports the whole List (all Items, Archived included) rather than a Report's results. Once Reports ship, export becomes filter-aware by passing a filtered Item set to the same serializer. Guests cannot export. See `docs/QnA/list-csv-export.md`.
