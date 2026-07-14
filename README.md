# Askr examples

These independently runnable applications form one progressive Northstar operations workspace. Start with the client-rendered app, add SSR without rewriting it, then add the authenticated API and data platform.

## Primary journey

1. [`spa/`](spa/) teaches routes, layouts, links, state, derived values, `For`/`Show`, icons, and theme components using deterministic local data.
2. [`ssr-only/`](ssr-only/) carries those application files forward and adds server rendering, a Vite server entry, Node serving, document composition, and hydration.
3. [`api-ssr/`](api-ssr/) keeps the public app recognizable and adds login, protected nested workspace routes, authenticated APIs, queries, mutations, SSR prefetch, charts, dialogs, and Monaco policy editing.

The application UI leans on `@askrjs/themes` for layout, navigation, cards, stats, forms, empty states, and persisted color mode. The small example stylesheets contain only global defaults and feature-specific sizing.

| Stage | Routes and application UI carried forward | Files added at this stage |
| --- | --- | --- |
| SPA | `/`, `/activity`, `/*`; operations layout and deterministic activity | `application/*`, browser boot |
| SSR | All SPA application modules and styles byte-for-byte | server app, Vite server entry, production entry, hydrate-or-create boot |
| API + SSR | Public routes, vocabulary, layout, and base components | protected workspace pages, repositories, query registry, APIs, auth, server prefetch |

Install and run all repository gates from this directory:

```sh
npm install
npm run check
npm run build
npm run test:browser
```

## Supplemental references

- [`api-only/`](api-only/) is the small server reference. Its health and user API patterns are reused directly by `api-ssr`.
- [`ssg/`](ssg/) generates public runbook pages, expands parameterized entries, emits metadata, and hydrates a small interactive control.

Every workspace can also be copied, installed, tested, and run from its own directory. Local `file:` dependencies point at sibling platform packages during platform development.

## Platform boundary

WebSockets are intentionally deferred. `@askrjs/node` does not currently expose an HTTP upgrade adapter, so these examples do not advertise a route that cannot work in the production adapter. A future WebSocket example belongs at that adapter boundary.
