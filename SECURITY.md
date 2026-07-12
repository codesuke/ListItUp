# Security Policy

Thank you for helping keep ListItUp and its users safe. This document explains what's in scope, how to report a vulnerability, and what to expect after you do.

## Supported Versions

ListItUp does not yet publish versioned releases — it ships continuously from `main`, which is what both the hosted instance at [listitup.virtunode.tech](https://listitup.virtunode.tech/) and the Docker images track.

| What you're running                    | Supported                                                             |
| -------------------------------------- | --------------------------------------------------------------------- |
| The hosted instance                    | ✅ Always the latest `main`                                           |
| Self-hosted, tracking latest `main`    | ✅ Yes                                                                |
| Self-hosted, pinned to an older commit | ⚠️ Update to `main` before reporting — the issue may already be fixed |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for a security vulnerability.** Public issues are indexed and searchable, and a live vulnerability disclosed that way can be exploited before a fix ships.

Instead, use GitHub's private vulnerability reporting for this repository:

1. Go to the [Security tab](https://github.com/codesuke/ListItUp/security) of this repository.
2. Click **Report a vulnerability**.
3. Fill in as much of the following as you can:
   - A clear description of the vulnerability and its potential impact.
   - Step-by-step reproduction instructions, or a minimal proof of concept.
   - The affected version/commit, and whether it's reproducible on the hosted instance, self-hosted, or both.
   - Any suggested mitigation, if you have one.

This keeps the report private to maintainers until a fix is ready, and gives us a private thread to coordinate a disclosure timeline with you.

### What to expect

This is a small, actively maintained project rather than a company with a dedicated security team, so timelines are best-effort, not contractual:

- **Acknowledgment**: we aim to respond within a few business days.
- **Triage**: we'll confirm whether it's a valid vulnerability and its severity, and let you know our plan.
- **Fix & disclosure**: once a fix is merged and deployed to the hosted instance, we'll coordinate with you on when (and whether) to publish details — we default to crediting reporters unless you'd prefer to stay anonymous.

## Scope

**In scope:**

- The ListItUp application code in this repository (`client/`), including authentication, session handling, and workspace/permission logic.
- The production Docker build (`client/Dockerfile`) and the `docker-compose.yml` self-hosting stack.
- The hosted instance at `listitup.virtunode.tech`, to the extent the issue is in ListItUp's own code rather than underlying infrastructure.

**Out of scope:**

- Vulnerabilities in upstream dependencies (Next.js, Better Auth, Prisma, etc.) — please report those to the upstream project directly. We'd still appreciate a heads-up if one materially affects ListItUp, so we can track and patch accordingly.
- Denial-of-service attacks, spam, or social engineering against maintainers or users.
- Findings that require physical access to a self-hoster's own infrastructure.

## Safe Harbor

We consider security research conducted under this policy — in good faith, without accessing or modifying data beyond what's needed to demonstrate a vulnerability, and reported privately per the process above — to be authorized. We won't pursue legal action for that research.

## Acknowledgments

Reporters who help us fix a real vulnerability will be credited here, with their permission, once a fix has shipped.
