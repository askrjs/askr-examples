# Askr examples

These independently runnable applications form one progressive Northstar operations workspace. Start with the client-rendered app, add SSR without rewriting it, then add the authenticated full-stack API, schema, action, and data platform.

## Primary journey

1. [`spa/`](spa/) teaches routes, layouts, links, state, derived values, `For`/`Show`, icons, and theme components using deterministic local data.
2. [`ssr-only/`](ssr-only/) carries those application files forward and adds server rendering, a Vite server entry, Node serving, document composition, and hydration.
3. [`api-ssr/`](api-ssr/) keeps the public app recognizable and adds login, protected nested workspace routes, executable schemas, declared actions, authenticated APIs, queries, SSR prefetch, charts, dialogs, and Monaco policy editing.

The application UI leans on `@askrjs/themes` for layout, navigation, cards, stats, forms, empty states, and persisted color mode. The small example stylesheets contain only global defaults and feature-specific sizing.

| Stage      | Routes and application UI carried forward                                           | Files added at this stage                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| SPA        | `/`, `/activity`, `/*`; operations layout and deterministic activity                | `application/*`, browser boot                                                                                                     |
| SSR        | All SPA application modules and styles byte-for-byte                                | server app, Vite server entry, production entry, hydrate-or-create boot                                                           |
| Full stack | SSR public data, layout, pages, and styles unchanged; public routes remain in place | protected workspace pages, schemas, actions, repositories, query registry, APIs, auth, metadata, i18n, telemetry, server prefetch |

Install and run all repository gates from this directory:

```sh
npm install
npm run check
npm run build
npm run test:runtime
npm run test:browser
```

## Supplemental references

- [`api-only/`](api-only/) is the small server reference. Its health and user API patterns are reused directly by `api-ssr`.
- [`ssg/`](ssg/) generates public runbook pages, expands parameterized entries, emits metadata, and hydrates a small interactive control.
- [`mcp-server/`](mcp-server/) runs compiled MCP servers over stdio or HTTP, with an optional stateful session and progress stream.
- [`provider-auth/`](provider-auth/) extends the authenticated journey with one server-owned Auth0, Microsoft, Google or Apple session, explicit SSR/SPA boot, server-only API permissions and local logout.

Every workspace can also be copied, installed, tested, and run from its own directory. Dependencies use ordinary registry ranges. API/SSR owns its DOMPurify override so copying the stage preserves the same patched dependency as the root workspace.

## Platform boundary

The examples intentionally exclude developer tools, databases and ORMs,
vendor deployment adapters, WebSockets, and
proprietary telemetry backends. Those remain application or adapter choices,
not hidden framework defaults.

## Consumer qualification

`npm run acceptance` runs the existing workspace contracts, production builds, compiled API and MCP transport checks, built SSG browser hydration and incremental generation, and the SPA/SSR/API-SSR browser journeys. The runtime gate starts fresh processes and records evidence in a printed temporary directory. It requires the Playwright Chromium binary (`npx playwright install chromium`). SSG marks `#app` ready only after `hydrateSPA` completes; its browser check preserves actual server-created nodes and observes one acknowledgment toggle.

See [`scripts/qualification/README.md`](scripts/qualification/README.md) for standalone stage installs and the separate final release-candidate mode. Published 0.4 baseline results do not qualify the unpublished 0.5 graph.

## Provider session extension

The provider example is a separate, independently installable workspace. Its
[README](provider-auth/README.md) explains the single server authority, HTTPS
setup and provider registration. It preserves the earlier deterministic login
example as a small teaching stage rather than replacing it.

`npm run check` and `npm run build` include the new stage. After installing all
three Playwright engines, `npm run test:provider-types` checks its own strict
TypeScript 6 and 7 compilers, and `npm run test:provider-browser` builds the
native fixture and exercises all four signed simulated providers in both SSR
and pure SPA modes on Chromium, Firefox and WebKit. `npm run acceptance` includes
these gates. The fixtures use real HTTPS, signatures, PKCE and server actions;
they do not establish live-provider compatibility. No provider credentials are
needed for the simulated suite. Producer retirement and final 0.5 package graph
qualification remain prerequisites for running this newly prepared extension.
