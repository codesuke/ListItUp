# Contributing to ListItUp

Thanks for considering a contribution. This repo is built collaboratively by humans and AI agents, so the same rules apply to both — the source of truth is always the repository, not a chat history or a prior conversation.

By participating, you're expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

## Table of Contents

- [Before You Start](#before-you-start)
- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Testing Guide](#testing-guide)
- [Coding Standards](#coding-standards)
- [Commit Message Convention](#commit-message-convention)
- [Pull Request Process](#pull-request-process)
- [Finding Something to Work On](#finding-something-to-work-on)
- [Issue Labels](#issue-labels)

## Before You Start

Read these first, in this order:

1. [`AGENTS.md`](AGENTS.md) — the working rules for this repo, including test-driven development and documentation expectations.
2. [`CONTEXT.md`](CONTEXT.md) — the product glossary. Use these exact terms in code, issues, and PRs (e.g. always "Item," never "task" or "card").
3. [`Architecture.md`](Architecture.md) — repo layout and the `client/` app's structure, including where new code belongs.
4. [`docs/agents/code-quality.md`](docs/agents/code-quality.md) and [`docs/agents/nextjs-conventions.md`](docs/agents/nextjs-conventions.md) — the clean-code and Next.js/React conventions this codebase follows.

If a term or convention is missing from those docs, that's worth raising in your issue or PR rather than guessing.

## Ways to Contribute

Code isn't the only useful contribution:

- **Report a bug** — open an [issue](https://github.com/codesuke/ListItUp/issues/new) with reproduction steps, expected vs. actual behavior, and your environment (self-hosted or hosted, browser, OS).
- **Propose a feature** — open an issue describing the problem you're trying to solve before proposing a specific solution; see `docs/agents/domain.md` for how this repo turns fuzzy ideas into specs.
- **Improve docs** — typos, unclear setup steps, and missing explanations are all fair game for a PR.
- **Review a PR** — thoughtful feedback on an open PR is as valuable as writing one.
- **Write code** — see [Finding Something to Work On](#finding-something-to-work-on) below.

## Development Setup

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Compose v2, for the local database.
- [Node.js](https://nodejs.org/) 24 or newer (CI runs Node 24; the production Docker image runs Node 26).
- [pnpm](https://pnpm.io/) 10.x — run `corepack enable` once, and Corepack will use the exact pinned version from `packageManager` in `client/package.json`.
- An SMTP account (any provider — Gmail with an app password works fine for local dev) for verification and password-reset emails.

### Steps

```bash
git clone https://github.com/codesuke/ListItUp.git
cd ListItUp

# 1. Bring up a local Postgres only — no need to build the app image
docker compose up -d db

# 2. Configure the app
cd client
cp .env.example .env
# edit .env: DATABASE_URL should point at localhost:5432 (the compose db service),
# and BETTER_AUTH_SECRET / SMTP_* need real values

# 3. Install dependencies and apply the schema
pnpm install
pnpm exec prisma migrate dev

# 4. Run the dev server
pnpm dev
```

The app runs at `http://localhost:3000` with hot reload. Full self-hosting instructions (running the whole stack, including the app container) are in the root [README.md](README.md#getting-started).

### Troubleshooting

- **`corepack enable` fails or the wrong pnpm version runs**: reinstall Corepack via `npm install -g corepack@latest` first, then re-run `corepack enable`.
- **Prisma can't reach the database**: confirm `docker compose ps` shows `db` as healthy, and that `DATABASE_URL` in `client/.env` targets `localhost:5432`, not the in-container hostname `db` (that hostname only resolves inside the Compose network).
- **Emails never arrive locally**: double-check `SMTP_*` values; most providers require an app-specific password rather than your regular account password.

## Project Structure

```text
client/
├── app/            App Router routes, layouts, global CSS
├── components/ui/  generated shadcn primitives — regenerate via the shadcn CLI, don't hand-edit
├── lib/            shared logic, grouped by feature (auth/, mailer/, session/, two-factor/, workspace/)
└── public/         static assets
```

See [`Architecture.md`](Architecture.md) for the complete, current breakdown, including import alias conventions (`@/components`, `@/lib`, etc.).

## Testing Guide

This repo uses test-driven development for product behavior: write one failing behavior test, implement the minimal code to pass it, then refactor. Tests should verify behavior through public interfaces, not implementation details.

Tests are colocated with the code they cover (`*.test.ts`, `*.integration.test.ts`, `*.smoke.test.tsx`) and run via `tsx`, not a test framework runner. From `client/`:

```bash
pnpm test          # app smoke tests
pnpm test:auth     # authentication + workspace provisioning tests
pnpm test:mail     # mailer/email template tests
```

Run `pnpm lint` and `pnpm typecheck` before opening a PR — both are also enforced in CI (`.github/workflows/ci.yml`), alongside a production Docker build.

## Coding Standards

The full catalog lives in [`docs/agents/code-quality.md`](docs/agents/code-quality.md) and [`docs/agents/nextjs-conventions.md`](docs/agents/nextjs-conventions.md); the headline rules:

- Functions do one thing, at one level of abstraction, with no more than 3 arguments and no boolean-flag parameters that make a function do two things.
- Names reveal intent; duplication is refactored into shared logic rather than copy-adapted.
- No magic numbers, no dead code, no commented-out code — comments explain _why_, never _what_.
- No `any`, double assertions, or unchecked `@ts-ignore`; validate data at system boundaries.
- Server/Client component boundaries are deliberate — `"use client"` only at the leaf that needs it, never on a whole route.

## Commit Message Convention

This repo uses [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`, for example:

```text
fix(docker): install corepack explicitly on node:26-alpine
feat(workspace): add invitation acceptance flow
docs(readme): document docker-compose self-hosting path
```

Common types: `feat`, `fix`, `docs`, `build`, `test`, `refactor`. Scope is usually the feature area (`docker`, `workspace`, `auth`, `readme`, etc.).

## Pull Request Process

1. Open an issue first for anything non-trivial, so the approach can be discussed before code is written.
2. Keep the PR to one demoable vertical slice rather than a broad rewrite.
3. Make sure `pnpm lint`, `pnpm typecheck`, and the relevant test scripts pass — or explain in the PR description why one couldn't be run.
4. Update docs when product language, architecture, or workflow changes: `CONTEXT.md` for new domain terms, an ADR under `docs/ADR/` for decisions that are meaningful and hard to reverse.
5. Reference the issue the PR closes (`Closes #123`).
6. A maintainer will review, request changes if needed, and merge once CI is green and the review is resolved.

## Finding Something to Work On

Issues and PRDs live in [GitHub Issues](https://github.com/codesuke/ListItUp/issues) for this repo — see [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md) for tracker conventions.

New to the project? Look for issues labeled [`good first issue`](https://github.com/codesuke/ListItUp/labels/good%20first%20issue) — small, self-contained, and ready for a human to pick up without deep repo context.

## Issue Labels

| Label              | Meaning                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `needs-triage`     | Maintainer needs to evaluate this issue                                                    |
| `needs-info`       | Waiting on the reporter for more information                                               |
| `ready-for-agent`  | Fully specified, ready for an AFK coding agent                                             |
| `ready-for-human`  | Requires human implementation                                                              |
| `good first issue` | A `ready-for-human` issue that's also small and self-contained — a good first contribution |
| `wontfix`          | Will not be actioned                                                                       |

See [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md) for the full reference.
