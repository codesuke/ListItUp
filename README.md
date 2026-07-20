<div align="center">

# ListItUp

**From scattered to sorted, without making organization feel like a second job.**

A self-hostable project and task management app for people who want to capture work and get it done, without the ceremony of most enterprise project management tools.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/codesuke/ListItUp/actions/workflows/ci.yml/badge.svg)](https://github.com/codesuke/ListItUp/actions/workflows/ci.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Self-Hosted](https://img.shields.io/badge/Self--Hosted-Docker%20Compose-2496ED?logo=docker&logoColor=white)](#getting-started)
[![Contributor Covenant](https://img.shields.io/badge/Code%20of%20Conduct-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

[**Try the hosted instance**](https://listitup.virtunode.tech/) · [Self-host it](#getting-started) · [Read the docs](#documentation) · [Report a bug](https://github.com/codesuke/ListItUp/issues/new)

</div>

---

## Table of Contents

- [About](#about)
- [Project Status](#project-status)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Option A — Docker Compose (self-host anywhere)](#option-a--docker-compose-self-host-anywhere)
  - [Option B — Dokploy](#option-b--dokploy)
  - [Option C — Local development](#option-c--local-development)
  - [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Code of Conduct](#code-of-conduct)
- [Security](#security)
- [License](#license)

---

## About

Most project management tools optimize for the enterprise buyer: endless configuration, permission matrices, and dashboards nobody asked for. ListItUp is built for the opposite instinct — capture a thought, turn it into something actionable, and move on with your day.

It ships two ways, on purpose:

- **Hosted** — sign up at [listitup.virtunode.tech](https://listitup.virtunode.tech/) and we run it for you.
- **Self-hosted** — clone this repo and run it on your own infrastructure, under an MIT license, with no feature gated behind a paywall.

Both run the exact same open source code. Nothing about the hosted instance is a separate, more-capable product.

## Project Status

ListItUp is under **active early development**. Here's what's actually true today, not aspirational:

| Area                                                                | Status      |
| ------------------------------------------------------------------- | ----------- |
| Authentication (sign-up, sign-in, password reset, 2FA, magic links) | Shipped     |
| Personal workspace provisioning                                     | Shipped     |
| `My Tasks` personal planning view                                   | Shipped     |
| List and Item management                                            | In progress |
| Shared/team workspaces                                              | In progress |
| Reports & Analytics                                                 | Planned     |

Track live progress in [GitHub Issues](https://github.com/codesuke/ListItUp/issues). Screenshots will land in this README once the core List/Item UI ships — we'd rather under-promise here than show you a mockup and call it done.

## Features

ListItUp's domain model (fully defined in [`CONTEXT.md`](CONTEXT.md)) is built around a small set of concepts that stay consistent whether you're working solo or with a team:

- **Lists** — named containers for anything you want to organize, compare, or complete.
- **Items** — entries inside a List. An Item can be a task, an idea, or a decision candidate, and picks up task-like accountability (owner, priority, due date) only when it actually needs one.
- **Workspaces** — every user gets a private personal Workspace automatically after their first verified sign-in, and can create or join shared Workspaces with teammates. Item capabilities are identical in both.
- **My Tasks** — a single, unified planning view across your personal Lists and anything assigned to you in shared Workspaces. It's the same canonical Item either way — complete it once, and it's done everywhere.
- **Notes & Personal Notes** — lightweight context on an Item, plus a private planning note only you can see, even on Items you don't own.
- **Reports & Analytics** — live views of Items across Lists, and operational signals like completion rate, blocked count, and aging Open Items — not vanity metrics like streaks or leaderboards.

## Tech Stack

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

</div>

- **Framework**: [Next.js](https://nextjs.org/) (App Router), React 19, TypeScript
- **Styling**: [Tailwind CSS](https://tailwindcss.com/), `shadcn` UI primitives, [Lucide](https://lucide.dev/) icons
- **Data**: [Prisma](https://www.prisma.io/) + `@prisma/adapter-pg` against PostgreSQL
- **Auth**: [Better Auth](https://www.better-auth.com/) — email/password, magic links, TOTP two-factor
- **Deployment**: Docker, Docker Compose, and [Dokploy](https://dokploy.com/)

## Getting Started

### Prerequisites

| Tool                                                       | Version                                                              | Needed for                                           |
| ---------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| [Docker](https://docs.docker.com/get-docker/) + Compose v2 | latest                                                               | Options A & B                                        |
| [Node.js](https://nodejs.org/)                             | 24+ (CI runs 24; the production image runs 26)                       | Option C                                             |
| [pnpm](https://pnpm.io/)                                   | 10.x — run `corepack enable` to get the pinned version automatically | Option C                                             |
| PostgreSQL                                                 | 16+                                                                  | Option C, if not using the bundled Compose database  |
| An SMTP account                                            | any provider                                                         | All options — required for verification/reset emails |

### Option A — Docker Compose (self-host anywhere)

The fastest way to run the whole stack — app, database, and migrations — on any machine with Docker.

```bash
git clone https://github.com/codesuke/ListItUp.git
cd ListItUp
cp .env.example .env
# edit .env: set BETTER_AUTH_SECRET, BETTER_AUTH_URL, POSTGRES_PASSWORD, and your SMTP credentials
docker compose up -d
```

What this does, step by step:

1. `db` starts a PostgreSQL 17 container with a persistent named volume.
2. `migrate` waits for `db` to report healthy, then runs `prisma migrate deploy` against it and exits.
3. `app` waits for `migrate` to finish successfully, then builds and starts the Next.js production server on `http://localhost:3000`.

Check status any time with `docker compose ps`, and logs with `docker compose logs -f app`.

### Option B — Dokploy

[`client/Dockerfile`](client/Dockerfile) is built for platform-managed deploys like [Dokploy](https://dokploy.com/), where the platform — not Compose — owns the database and injects environment variables at runtime:

1. In Dokploy, create a new application from this repository.
2. Set the build context to `client/`.
3. Provision (or point at) a PostgreSQL instance and set `DATABASE_URL` accordingly.
4. Copy the remaining variables from [`client/.env.example`](client/.env.example) into Dokploy's environment settings: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and the `SMTP_*` variables.
5. Deploy. Dokploy handles applying migrations and restarting the container.

### Option C — Local development

For working on ListItUp itself rather than just running it:

```bash
git clone https://github.com/codesuke/ListItUp.git
cd ListItUp
docker compose up -d db          # bring up just the database
cd client
cp .env.example .env             # point DATABASE_URL at localhost:5432
pnpm install
pnpm exec prisma migrate dev
pnpm dev
```

The app is now running at `http://localhost:3000` with hot reload. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor workflow, testing commands, and coding conventions.

### Environment Variables

| Variable                                | Required              | Notes                                                                              |
| --------------------------------------- | --------------------- | ---------------------------------------------------------------------------------- |
| `DATABASE_URL`                          | Yes, in Option C only | Options A & B set this automatically (Compose) or expect the platform to (Dokploy) |
| `POSTGRES_PASSWORD`                     | Option A only         | Password for the bundled Postgres container                                        |
| `BETTER_AUTH_SECRET`                    | Yes                   | Random string, 32+ characters — signs sessions and tokens                          |
| `BETTER_AUTH_URL`                       | Yes                   | The externally reachable base URL of this instance                                 |
| `MAIL_PROVIDER`                         | No                    | Free-text label for logging/diagnostics only — doesn't change behavior             |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Yes                   | Connection details for your SMTP provider                                          |
| `SMTP_USER`, `SMTP_PASSWORD`            | Yes                   | SMTP auth credentials                                                              |
| `MAIL_FROM_NAME`, `MAIL_FROM_EMAIL`     | Yes                   | From header on verification/reset emails                                           |

See [`.env.example`](.env.example) (Compose) or [`client/.env.example`](client/.env.example) (local dev / Dokploy) for copy-paste starting points.

## Testing

The required behavior suite runs against disposable PostgreSQL, Redis, and Mailpit services. It never uses a real SMTP account.

```bash
docker compose -f docker-compose.test.yml up -d
cd client
cp .env.test.example .env.test
set -a; . .env.test; set +a
pnpm exec prisma migrate deploy
pnpm test
```

The test database is disposable. Stop the services with `docker compose -f docker-compose.test.yml down` when finished. CI uses the same service configuration and runs migrations before the suite. The browser release journeys are added by the follow-up [issue #32](https://github.com/codesuke/ListItUp/issues/32).

## Project Structure

```text
/
├── AGENTS.md / CLAUDE.md   agent and contributor working rules
├── Architecture.md         full repo layout and client/ app structure
├── CONTEXT.md              product glossary
├── Brand.md                brand voice
├── DESIGN.md               interface direction
├── docker-compose.yml      self-hosting stack (app + Postgres)
├── docs/                   QnA, specs, ADRs, templates
└── client/                 the Next.js application
    ├── app/                App Router routes
    ├── components/         shared UI, incl. generated shadcn primitives
    ├── lib/                auth, mailer, session, workspace, and other feature logic
    └── Dockerfile           production image, built for Dokploy-style platforms
```

See [`Architecture.md`](Architecture.md) for the full breakdown.

## Documentation

- [`CONTEXT.md`](CONTEXT.md) — product glossary and domain language
- [`Brand.md`](Brand.md) — product voice and positioning
- [`DESIGN.md`](DESIGN.md) — interface direction
- [`Architecture.md`](Architecture.md) — repo layout and the `client/` app's structure
- [`docs/licensing.md`](docs/licensing.md) — what the MIT license means for you, in plain English
- [`docs/`](docs/) — QnA sessions, specs, and architecture decision records

## Roadmap

No fixed dates — this is a small, actively developed project, and we'd rather ship honestly than promise a quarter. In rough order:

1. List and Item CRUD, replacing the current auth-only UI.
2. Shared/team Workspaces, invitations, and roles.
3. Reports & Analytics views.
4. Attachments (S3-compatible storage — see [ADR 0002](docs/ADR/0002-s3-compatible-attachment-storage.md)).

Open a [feature request](https://github.com/codesuke/ListItUp/issues/new) if there's something specific you'd want prioritized.

## Contributing

Contributions are welcome, whether that's code, docs, bug reports, or design feedback. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full dev setup, testing workflow, and coding conventions.

New here? Issues labeled [`good first issue`](https://github.com/codesuke/ListItUp/labels/good%20first%20issue) are scoped to be a manageable first contribution.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you're expected to uphold it.

## Security

Found a vulnerability? Please don't open a public issue — see [SECURITY.md](SECURITY.md) for how to report it privately.

## License

ListItUp is [MIT licensed](LICENSE), © VirtuNode. See [`docs/licensing.md`](docs/licensing.md) for a plain-English explanation of what that means for you.
