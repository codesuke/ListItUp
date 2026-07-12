# Code Quality

The bar for "clean" code in this repo, and how to check for it. This condenses the catalog used by the `/smell` skill down to what matters for this stack (TypeScript, React, Next.js); see the skill itself for the full catalog and severity model.

## Before Opening a PR

Run `/smell` against the target branch on any non-trivial `feature`, `refactor`, or `bugfix` change. Treat any `BLOCKER` or `HIGH` finding as something to fix before requesting review, not after.

## Clean Code Baseline

- **Functions do one thing.** Small, one level of abstraction, no more than 3 arguments, no boolean flag arguments that make the function do two things (`CC.F3`, `CC.G30`, `CC.G34`).
- **Names reveal intent.** Long-lived or wide-scope names should be descriptive; short names are only fine in short scopes (`CC.N1`, `CC.N5`).
- **Duplication is the worst smell.** Extract shared logic rather than copy-adapt (`CC.G5`).
- **No magic numbers or dense one-liners.** Name constants and extract explanatory variables for anything non-obvious (`CC.G16`, `CC.G19`, `CC.G25`).
- **Encapsulate conditionals.** Extract compound booleans into a named predicate instead of inlining them (`CC.G28`).
- **Comments explain why, not what.** Delete obsolete, redundant, or commented-out code rather than leaving it (`CC.C2`, `CC.C3`, `CC.C5`).
- **No dead code.** Remove unused functions, branches, and symbols instead of leaving them "just in case" (`CC.F4`, `CC.G9`).

## TypeScript Baseline

- Don't escape the type system with `any`, double assertions, or `as unknown as` — narrow or use generics instead (`TS.ANY-ESCAPE`).
- Don't silence a real mismatch with `@ts-ignore`/`@ts-expect-error` without a narrow, stated reason (`TS.IGNORE-DIRECTIVE`).
- Validate data at the boundary — `JSON.parse`, API responses, `searchParams`, form data, env vars — don't trust it into typed code unchecked (`TS.UNVALIDATED-JSON`).
- Every promise is awaited, returned, or explicitly voided with error handling — no floating promises (`TS.PROMISE-FLOATING`).
- Model state machines as discriminated unions, not parallel booleans that can go out of sync (`TS.BOOLEAN-PROP-DRIFT`).

## React / Next.js Baseline

- Keep Server/Client boundaries deliberate: don't leak browser-only APIs into a Server Component, and don't push `"use client"` higher than it needs to be (`REACT.CLIENT-BOUNDARY-LEAK`).
- Fetch server-owned data in Server Components/Actions, not from the client, unless there's a specific interactivity reason (`REACT.SERVER-DATA-IN-CLIENT`).
- `useEffect` is for syncing with external systems, not for deriving state from props/state or handling user actions — derive during render or handle in the event handler instead (`REACT.EFFECT-DERIVED-STATE`, `REACT.EFFECT-EVENT-HANDLER`).
- List keys are stable IDs, never array index or random values (`REACT.UNSTABLE-KEY`).
- Interactive elements have an accessible name and keyboard semantics; don't build clickable divs (`REACT.A11Y-MISSING-NAME`, `REACT.A11Y-CLICK-ONLY`).

See `docs/agents/nextjs-conventions.md` for the Next.js-specific rendering/caching/data rules, and the `/smell` skill's full catalog (`Clean Code`, `Gang of Four`, `TypeScript`, `React`, `Next.js` sections) for anything not covered above.
