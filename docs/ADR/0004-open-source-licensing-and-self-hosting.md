# Open Source Licensing and Self-Hosting Model

ListItUp will ship as a fully open source, permissively licensed project (MIT), self-hostable via a generic `docker-compose.yml` or a platform-managed Dockerfile (Dokploy), alongside a maintainer-run hosted instance at `listitup.virtunode.tech`. No feature is reserved as paid-only for self-hosters (no open-core split) at this stage.

## Status

accepted

## Considered Options

- **MIT** (chosen): matches the reference projects (Better-Auth, Dokploy) that set the "professional OSS" bar for this project; maximizes contributor and adopter trust; already the license in place.
- **AGPL-3.0**: would close the loophole of a competitor re-hosting a modified fork as a competing SaaS without contributing back, at the cost of extra friction for contributors and enterprise adopters, and possible tension with the stated goal of being unambiguously "open source" in the way the reference projects are.
- **Open-core** (Bitwarden/GitLab/Plane-style, OSS core + a proprietary `ee/`-style module for paid features): rejected for now — no concrete paid-only feature has been identified yet, so the added complexity (a second license, a gating mechanism) has no immediate payoff. Revisit if a genuinely enterprise-only feature (e.g. SSO, audit logs) is scoped.

## Consequences

- `LICENSE` stays MIT with copyright held by `VirtuNode`; no relicensing work needed now, but relicensing later (e.g. to AGPL or open-core) gets harder once external contributors hold copyright on their own patches, unless a CLA is introduced first.
- Self-hosting has two supported paths: a root-level `docker-compose.yml` (bundles Postgres, runs Prisma migrations via a `migrate` service, works on any Docker host) and the existing Dokploy-oriented `client/Dockerfile` (expects the platform to supply `DATABASE_URL` and other runtime env vars and manage the database separately).
- The hosted instance (`listitup.virtunode.tech`) and self-hosting are both first-class, equally-featured ways to run ListItUp; monetization is scoped to hosting convenience only until/unless an open-core decision is made explicitly.
- Standard OSS community health files (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`) and a `good first issue` label (see `docs/agents/triage-labels.md`) exist to support outside human contributors, distinct from the agent-oriented triage labels already in place.
