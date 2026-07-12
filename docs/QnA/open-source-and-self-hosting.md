# Grill Session: Open Source Licensing and Self-Hosting

## Context

The user wants ListItUp to become a properly open-sourced, self-hostable project management app — a simpler alternative to the enterprise incumbents — with the polish of reference projects Better-Auth and Dokploy: a real LICENSE, README, and standard OSS repo scaffolding.

## Questions

### 1. Which license should the repo use?

**Recommended answer**:

MIT, matching the existing LICENSE file and the reference projects (Better-Auth is MIT, Dokploy is Apache-2.0 — both permissive), unless protecting the hosted-instance revenue from SaaS cloning is a concrete near-term priority, in which case AGPL-3.0 (as used by direct competitors Plane, Vikunja, Cal.com) is the legitimate alternative.

**User answer**:

Asked to discuss tradeoffs first, then asked how Bitwarden's open-core model (GPL-3.0 core + proprietary `bitwarden_license/` for enterprise features) compares. After that discussion, chose MIT.

**Settled outcome**:

Keep MIT, matching the LICENSE file already in the repo. No relicensing work needed.

### 2. Is open-core (paid features even for self-hosters) part of the plan?

**Recommended answer**:

Only if there's already a concrete feature in mind to gate; otherwise defer, since building a license-key gating mechanism with no feature to justify it is premature.

**User answer**:

Not sure yet / decide later.

**Settled outcome**:

No open-core split now. Monetization is scoped to hosting convenience only. Revisit open-core explicitly once a genuine enterprise-only feature is scoped (see ADR 0004).

### 3. Is `Copyright (c) 2026 VirtuNode` in LICENSE the correct copyright holder?

**Recommended answer**:

Confirm rather than assume, since it could be a placeholder.

**User answer**:

Yes, keep VirtuNode.

**Settled outcome**:

VirtuNode remains the copyright holder across LICENSE, README, and package.json `author` fields.

### 4. `README.md` and `Readme.md` both exist (case-duplicate) — how to resolve?

**Recommended answer**:

Delete `Readme.md`, write the full professional readme into `README.md` (the conventional casing).

**User answer**:

Yes, keep README.md only.

**Settled outcome**:

`Readme.md` deleted. `README.md` rewritten as the canonical, professional readme.

### 5. Should the README use screenshots, given the core List/Item UI isn't built yet (only auth flows and a bare `my-tasks` page exist)?

**Recommended answer**:

Text-first, no screenshots — avoids overpromising on an unfinished UI and matches Brand.md's "avoid marketing-heavy visuals" guidance.

**User answer**:

Text-first for now, no screenshots.

**Settled outcome**:

README has no images. Add real screenshots once List/Item management ships. Mid-session, the user also asked to make the repo "as beautiful and open-source-friendly as possible" — addressed through structure (badges, clear sections, calm on-brand tone) rather than imagery.

### 6. Should self-hosting support a generic docker-compose path, or is the existing Dokploy-only Dockerfile enough?

**Recommended answer**:

Add a root `docker-compose.yml` (app + bundled Postgres, works on any Docker host) alongside the existing Dokploy-oriented `client/Dockerfile`, since "a self-hosted app anyone can use" implies more than one deployment platform.

**User answer**:

Add docker-compose.yml too.

**Settled outcome**:

New root-level `docker-compose.yml` with a `db` (Postgres), `migrate` (runs `prisma migrate deploy`), and `app` service, plus a root `.env.example`. The existing `client/Dockerfile` is untouched and still documented as the Dokploy path.

### 7. Does a live hosted instance exist to link from the README?

**Recommended answer**:

Only link a hosted-instance CTA if a real URL exists; a dead/aspirational link undercuts the professional bar.

**User answer**:

Yes — `https://listitup.virtunode.tech/`.

**Settled outcome**:

README links the hosted instance alongside self-hosting instructions. GitHub repo `homepageUrl` also set to this URL.

### 8. Should standard OSS community health files be added now?

**Recommended answer**:

Yes, add `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md` — all three are part of GitHub's Community Standards checklist and none existed.

**User answer**:

Yes, add all three.

**Settled outcome**:

All three added. `CONTRIBUTING.md` documents the existing dev/TDD/docs-first workflow from `AGENTS.md` for human contributors; `CODE_OF_CONDUCT.md` uses Contributor Covenant v2.1; `SECURITY.md` points to GitHub private vulnerability reporting.

### 9. How should security vulnerabilities be reported?

**Recommended answer**:

GitHub's built-in private vulnerability reporting (Security tab), which avoids publishing a personal email.

**User answer**:

GitHub private vulnerability reporting.

**Settled outcome**:

`SECURITY.md` points to the repo's Security tab. Private vulnerability reporting also enabled on the GitHub repo itself.

### 10. What contact should `CODE_OF_CONDUCT.md` list for reporting violations?

**Recommended answer**:

The user's email on file, unless a dedicated address is preferred.

**User answer**:

nomadic.nightraven@gmail.com, codesuke@gmail.com, and team@virtunode.tech.

**Settled outcome**:

All three emails listed as enforcement contacts in `CODE_OF_CONDUCT.md`.

### 11. Should a `good first issue` label be introduced for external human contributors, given the existing labels are all agent-workflow oriented?

**Recommended answer**:

Yes — it's the GitHub-standard label external contributors already search for, and none of the existing five (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix) serve that discovery purpose.

**User answer**:

Yes, add `good first issue`.

**Settled outcome**:

`docs/agents/triage-labels.md` documents `good first issue` as a label applied alongside `ready-for-human` for small, self-contained starter issues.

### 12. Should GitHub repo metadata (description, topics, homepageUrl, vulnerability reporting) be updated?

**Recommended answer**:

Yes — the existing description has a typo/trailing space and doesn't reflect the calmer Brand.md voice, no topics are set, and homepageUrl is empty despite a live hosted instance existing.

**User answer**:

Yes, update GitHub repo metadata.

**Settled outcome**:

Updated via `gh`: description, topics (self-hosted, open-source, nextjs, typescript, project-management), `homepageUrl` set to the hosted instance, private vulnerability reporting enabled.

### 13. Should `package.json` metadata (license, author, repository, homepage, bugs) be filled in for both root and `client/`?

**Recommended answer**:

Yes — standard for OSS tooling (npm, GitHub's dependency graph) and currently bare in both files.

**User answer**:

Yes, fill in package.json metadata.

**Settled outcome**:

Both `package.json` files now have `license: "MIT"`, `author: "VirtuNode"`, `repository`, `homepage`, and `bugs` fields.

## Date

2026-07-12

## Follow-Ups

- Glossary updates: none — no new domain terms introduced.
- ADRs created: `docs/ADR/0004-open-source-licensing-and-self-hosting.md`.
- Specs affected: none directly; a future spec should cover the actual List/Item management UI referenced as "still being built" in the new README's Project Status section.
