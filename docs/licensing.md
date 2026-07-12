# Licensing, in Plain English

ListItUp is licensed under the [MIT License](../LICENSE). This page explains what that means in practice. It is a convenience summary, not a substitute for the license text — if the two ever disagree, the [LICENSE](../LICENSE) file governs.

## The short version

You can do almost anything with this code — use it, copy it, modify it, run it commercially, even sell it — as long as you keep the original copyright notice and license text somewhere in your copy. There's no warranty, and the authors aren't liable if something breaks.

## What you can do

- **Self-host it**, for yourself, your team, or your company, for free, forever.
- **Modify it** — rebrand the UI, rip out features you don't need, add your own.
- **Run it as a commercial service** — including a hosted product that competes with `listitup.virtunode.tech`. MIT does not require you to share your changes back, or even to say you're using ListItUp.
- **Fork it** and take it in a completely different direction.
- **Bundle it** into a larger proprietary product.

## What you must do

- **Keep the copyright notice and license text** ([`LICENSE`](../LICENSE)) somewhere in any copy or substantial portion of the software you distribute.

That's the entire obligation. MIT is a permissive license, not a copyleft one — there's no requirement to open-source your modifications, publish your source, or credit the project publicly (though we'd appreciate it).

## What you're accepting

The software is provided "as is," with no warranty of any kind. If self-hosting ListItUp breaks something, loses data, or otherwise causes a problem, the license explicitly disclaims liability. Use it accordingly — take backups, and treat a self-hosted instance the way you'd treat any other production infrastructure.

## Why MIT, and not something else

This came up explicitly when the project decided to open source: given ListItUp runs both as self-hosted software and as a maintainer-run hosted instance, a more restrictive license (like AGPL-3.0, or a source-available license) would have made it harder for a competing service to legally re-host a modified fork without contributing back. We chose MIT anyway, for two reasons:

1. It matches the projects that set the bar for what a "professional" self-hosted open source project looks like (Better Auth is MIT, Dokploy is Apache-2.0) — both permissive, both still run successful hosted offerings on top of the same code everyone can self-host for free.
2. At this stage, maximizing trust, adoption, and contributor goodwill matters more than defending against a hypothetical competitor.

The full reasoning, alternatives considered, and consequences are recorded in [ADR 0004](ADR/0004-open-source-licensing-and-self-hosting.md).

## I have a question this page doesn't answer

MIT is a widely used, well-understood license — [opensource.org/license/mit](https://opensource.org/license/mit) and [choosealicense.com/licenses/mit](https://choosealicense.com/licenses/mit/) are good general references. For anything specific to how ListItUp is licensed or governed, open a [GitHub Discussion or issue](https://github.com/codesuke/ListItUp/issues).
