# Recon

## Source Inputs

- `CONTEXT.md`: Use product nouns precisely: User, Workspace, List, Item, My Tasks, Inbox List.
- `Brand.md`: Calm, practical, fast, no productivity theater.
- `DESIGN.md` and `sample.html`: Compact operational interface, dark workspace shell, hairline borders, primary orange, mono labels, ambient network canvas.
- `docs/Specs-Planned/authentication-and-account-recovery.md`: Login must support password sign-in, magic-link alternate path, reset password, optional 2FA, and default landing in My Tasks.

## Page Inventory

- Single login page mock in `mocks/login.html`.
- Above-fold must communicate secure return to My Tasks and show what waits after sign-in.

## Constraints

- Simple HTML and Tailwind CDN.
- Treat `sample.html` as the visual reference.
- Avoid a generic centered auth card.
