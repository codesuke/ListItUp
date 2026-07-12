# ListItUp Architecture

How the repo is physically laid out and how the `client/` app is built. For product language see `CONTEXT.md`; for interface direction see `DESIGN.md`; for agent workflow see `AGENTS.md`.

## Repo Layout

```text
/
├── AGENTS.md / CLAUDE.md   agent working rules
├── Architecture.md         this file
├── CONTEXT.md              product glossary
├── Brand.md                brand voice
├── DESIGN.md               interface direction
├── sample.html             visual reference implementation
├── docs/                   QnA, specs, ADRs, templates, agent config
└── client/                 the Next.js application
```

Everything under `client/` is one deployable app. There is no separate backend service; server logic lives inside the Next.js app (Route Handlers, Server Actions, Server Components).

## `client/` Stack

- **Framework**: Next.js (App Router), React, TypeScript.
- **Styling**: Tailwind CSS, `tw-animate-css` for motion utilities.
- **UI primitives**: `shadcn` (style: `base-nova`) generating into `components/ui`, backed by `@base-ui/react`. Icons from `lucide-react` — see `DESIGN.md` for the "no hand-rolled SVG icons" rule.
- **Data**: `@prisma/client` + `@prisma/adapter-pg` against Postgres (`pg`).
- **Auth**: `better-auth`.
- **Fonts**: `next/font` (Geist / Geist Mono), wired in `app/layout.tsx`.

## `client/` Structure

```text
client/
├── app/            App Router routes, layouts, global CSS
│   ├── layout.tsx  root layout — fonts, <html>/<body>, metadata
│   ├── page.tsx    route entry
│   └── globals.css Tailwind entry + design tokens
├── components/
│   └── ui/         generated shadcn primitives — do not hand-edit heavily, regenerate via `shadcn` instead
├── lib/            shared logic, grouped by feature
│   ├── auth/       Better Auth instance/config, sign-in/reset tokens, verification & email-change
│   ├── mailer/     SMTP transport, config, and transactional email templates
│   ├── session/    protected-route redirect logic, callback-url validation
│   ├── two-factor/ TOTP/backup-code verification
│   ├── workspace/  personal workspace provisioning, workspace invitations
│   ├── prisma.ts, database-url.ts, utils.ts   cross-cutting infra with no single feature owner
│   └── */*.test.ts, */*.integration.test.ts   colocated with the module they cover
└── public/         static assets
```

Import alias `@/*` maps to `client/*` (see `tsconfig.json`). Use `@/components`, `@/components/ui`, `@/lib`, `@/hooks` per `components.json` — don't use relative `../../..` paths across these boundaries.

### Where new code goes

- New routes/screens: `app/<route>/page.tsx`, colocating route-local components next to the route.
- Shared, reusable UI: `components/`. Generated primitives stay in `components/ui/`; compose them into feature components elsewhere in `components/`.
- Shared logic: `lib/<feature>/`, grouped by the feature it belongs to (see the structure above) rather than left flat. Only genuinely cross-cutting infra with no single feature owner (the Prisma client, `cn()`, etc.) stays at `lib/` root.
- Server-only code (DB access, auth checks): Server Components, Server Actions, or Route Handlers — never imported into a `"use client"` file. See `docs/agents/nextjs-conventions.md`. Modules that touch a secret or the database directly should also add `import "server-only"` so a client-side import fails the build instead of relying on review — see the modules already doing this (`lib/auth/auth.ts`, `lib/mailer/mailer.ts`, `lib/prisma.ts`, etc.) for the pattern. Skip the marker on a module that a colocated `*.test.ts` imports directly via `tsx`: the `server-only` package only no-ops under a bundler's `react-server` export condition, which plain `tsx` never sets, so marking such a module breaks its own test.

## Testing

Smoke tests are colocated with the code they cover as `*.smoke.test.tsx` (e.g. `app/page.smoke.test.tsx`) and run via `tsx` (`pnpm test`). Follow the same colocation pattern for new tests rather than a separate top-level `__tests__/` tree.

## Further Reading

- `docs/agents/nextjs-conventions.md` — Next.js/React rules to apply when writing or reviewing code in `client/`.
- `docs/agents/code-quality.md` — clean-code and smell-review expectations for all code in this repo.
- `docs/agents/domain.md` — how agents should consume the docs above before making changes.
