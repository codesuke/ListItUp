# Domain Docs

How engineering skills should consume this repo's domain documentation.

## Before Exploring, Read These

- `CONTEXT.md` at the repo root for domain language.
- `Brand.md` for tone, positioning, and naming.
- `DESIGN.md` for product and interface direction.
- `Architecture.md` for repo layout and the `client/` app's structure.
- `sample.html` for the current visual reference implementation of `DESIGN.md`.
- `docs/ADR/` for architecture decisions relevant to the area being changed.

If any file is missing, proceed silently and use the best available context.

## File Structure

This is a single-context repo:

```text
/
├── CONTEXT.md
├── Brand.md
├── DESIGN.md
├── Architecture.md
├── sample.html
├── AGENTS.md / CLAUDE.md
├── client/
└── docs/
    ├── ADR/
    ├── QnA/
    ├── Specs-Planned/
    ├── Specs-Completed/
    ├── Templates/
    └── agents/
```

## Use The Glossary Vocabulary

When output names a domain concept in an issue title, PRD, test name, UI proposal, or refactor plan, use the term as defined in `CONTEXT.md`.

If the needed concept is missing, use `grill-with-docs` to resolve the term and update `CONTEXT.md`.

## Flag ADR Conflicts

If a proposal contradicts an existing ADR, surface the conflict explicitly before implementing.
