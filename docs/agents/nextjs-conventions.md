# Next.js Conventions

Rules to apply when writing or reviewing code in `client/`, which runs **Next.js 16.2.10** (App Router, Turbopack, React 19). This is a curated, version-accurate subset of the `vercel:nextjs`, `vercel:react-best-practices`, `vercel:next-cache-components`, `vercel:turbopack`, and `vercel:routing-middleware` skills. Consult those directly for anything not covered here, and re-check this doc when bumping the `next` version — the App Router's caching and rendering model changes fast.

## Rendering & RSC Boundaries

- Default to Server Components. Add `"use client"` only at the leaf that actually needs interactivity, hooks, or browser APIs — not on a whole route (`REACT.CLIENT-BOUNDARY-LEAK`). See the `/smell` finding on `app/page.tsx` for a concrete example of this rule being violated.
- A Client Component **cannot** be an `async function`. If a component needs to `await` something, fetch in a Server Component parent and pass the result down as a prop.
- Props crossing Server → Client must be JSON-serializable: no functions (except `"use server"` Server Actions), `Date`, `Map`/`Set`, class instances, or unregistered `Symbol`s. Serialize (`.toISOString()`, `Object.fromEntries()`, plain objects) before passing down.
- Fetch data in Server Components, Server Actions, or Route Handlers — a Client Component should not fetch server-owned data unless it needs client-side interactivity (refetch on user action, polling, etc.).

## Async APIs

Next.js's dynamic request APIs are asynchronous — always `await` them, never destructure synchronously:

```tsx
type Props = { params: Promise<{ slug: string }> };

export default async function Page({ params }: Props) {
  const { slug } = await params;
}
```

This applies to `params`, `searchParams`, `cookies()`, `headers()`, and `draftMode()` (`NEXT.REQUEST-API-AWAIT`). In a non-async (client) component, use `React.use(params)` instead of awaiting.

## Data Fetching

- Server Components are the default for reads — fetch directly, no API route needed.
- Server Actions (`"use server"`) are the default for mutations from the UI; call `revalidatePath`/`revalidateTag` (or `updateTag` — see Caching below) after a write so the UI doesn't go stale (`NEXT.REVALIDATION-MISSING`).
- Route Handlers (`route.ts`) are for external consumers only: webhooks, mobile clients, or GET endpoints that need HTTP-level caching. Don't add one just to move a fetch to the client.
- Parallelize independent requests — `Promise.all`, hoisting fetches above `await`, or separate `Suspense` boundaries per section — instead of awaiting them one after another (`NEXT.WATERFALL`).

## Caching: Cache Components (`use cache`)

Next.js 16 replaces `experimental.ppr` and `unstable_cache` with **Cache Components** (Partial Prerendering). This app doesn't have `cacheComponents` enabled yet — reach for it once a route needs real caching (e.g. server-rendered lists/dashboards), rather than hand-rolling `revalidate` exports.

```ts
// next.config.ts
const nextConfig: NextConfig = { cacheComponents: true };
```

With it on, a route's content is one of three kinds:

| Kind    | How                                          | Behavior                                   |
| ------- | -------------------------------------------- | ------------------------------------------ |
| Static  | plain sync JSX                               | prerendered at build time                  |
| Cached  | `"use cache"` + `cacheLife()` / `cacheTag()` | served from cache, revalidates on schedule |
| Dynamic | wrapped in `<Suspense>`                      | streamed in per-request                    |

```tsx
async function Stats() {
  "use cache";
  cacheLife("hours");
  cacheTag("dashboard-stats");
  return <StatsDisplay stats={await db.stats.aggregate()} />;
}
```

- `"use cache"` functions **cannot** call `cookies()`, `headers()`, or read `searchParams` directly — pass the needed value in as an argument (it becomes part of the cache key), or use `"use cache: private"` only when you truly can't refactor.
- Invalidate with `updateTag(tag)` (immediate, same request) or `revalidateTag(tag, profile)` (background) from a Server Action — never with the deprecated single-arg `revalidateTag(tag)` or `unstable_cache`.

## Middleware → `proxy.ts`

This repo has no root-level middleware yet. If you add request interception (auth redirects, rewrites), know that Next.js 16 renamed the file:

|         | Next.js 14–15         | Next.js 16+                |
| ------- | --------------------- | -------------------------- |
| File    | `middleware.ts`       | `proxy.ts`                 |
| Export  | `middleware()`        | `proxy()`                  |
| Config  | `export const config` | `export const proxyConfig` |
| Runtime | Edge or Node          | Node.js only               |

Don't create `middleware.ts` in this repo — it still works but is deprecated and will warn. Use `proxy.ts` from the start. `proxy.ts` is for network-boundary logic (rewrites, redirects, header injection) — it is **not** a substitute for real authorization checks in Server Components/Actions.

## Turbopack

Turbopack is the default bundler in Next.js 16 (both `next dev` and `next build`) — no flag needed. If custom bundler config is ever required, it's top-level `turbopack` in `next.config.ts` (not `experimental.turbopack`, and not a `webpack()` function, which Turbopack ignores). Prefer `server-only` (`import "server-only"` at the top of a server-only module) over hoping a boundary mistake gets caught in review — it fails the build instead of leaking server code to the client bundle.

## Security

- Server Actions and Route Handlers that read or mutate protected data need the same authz checks as an API endpoint — being a Server Action is not itself a security boundary (`NEXT.SECURITY-SERVER-ACTION-AUTH`).
- Never use `searchParams`, route params, or form data to build a DB query or a redirect target without validating/allow-listing first (`NEXT.SECURITY-TRUSTED-SEARCHPARAMS`, `NEXT.REDIRECT-UNVALIDATED`).

## Bundling & Assets

- Import directly from a module, not through a barrel `index.ts` re-export — Turbopack tree-shakes per-export, but barrels still cost more to resolve and can defeat `sideEffects: false` optimization (`bundle-barrel-imports`).
- A Client Component must not import server-only modules or Node APIs — that either bloats the bundle or breaks the build (`NEXT.BUNDLE-CLIENT-IMPORT`).
- Use `next/image` for any content image (never raw `<img>`), and `next/script` for third-party scripts with an explicit loading strategy (`NEXT.IMAGE-RAW-IMG`, `NEXT.SCRIPT-RAW`).
- Fonts go through `next/font` (already set up in `app/layout.tsx` with Geist/Geist Mono) — don't add a second font-loading path.
- Every `"use client"` boundary is a new chunk — if a build gets large, audit boundaries before reaching for `next/dynamic`.

## React Hygiene

- Don't define a component inside another component's render body (`rerender-no-inline-components`).
- Effects sync with external systems; derive state from props/state during render instead of mirroring it into `useState` + `useEffect` (`rerender-derived-state-no-effect`).
- Prefer a ternary over `&&` for conditional rendering to avoid accidentally rendering `0` or `""` (`rendering-conditional-render`).
- List keys are stable IDs, never array index (`REACT.UNSTABLE-KEY`).

## Shadcn / UI Primitives

- Regenerate `components/ui/*` via the `shadcn` CLI rather than hand-editing generated primitives; put app-specific composition in other files under `components/`.
- Icons come from `lucide-react` per `DESIGN.md` — don't hand-roll SVG icons for app UI.

## Version Watch

Things that will bite on the next `next` upgrade or when this app's needs grow: enabling `cacheComponents` (turns on stricter dynamic/static boundaries — expect build errors that pinpoint missing `Suspense` or `"use cache"`), adding `middleware.ts` instead of `proxy.ts`, and reintroducing `webpack()` config that Turbopack silently ignores. Run the `vercel:next-upgrade` skill before bumping major versions.

For the full rule set (hydration errors, self-hosting, parallel/intercepting routes, metadata, etc.) read the `vercel:nextjs`, `vercel:react-best-practices`, `vercel:next-cache-components`, and `vercel:turbopack` skills directly before large or unfamiliar changes.
