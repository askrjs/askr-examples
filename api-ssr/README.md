# Authenticated API and SSR workspace

## What remains unchanged from the previous stage

The public `/`, `/activity`, and `/*` experience remains recognizable and uses the same operations vocabulary, layout, components, styles, Vite document ownership, SSR entry, and hydrate-or-create client boot.

## What this stage adds

- `/login` and protected nested routes under `/workspace` for dashboards, users, and policy editing.
- Deterministic cookie sessions through `@askrjs/auth`, permission checks, and explicit 401/403 Problem Details.
- Fresh in-memory repositories behind dependency interfaces and `createDependencies()`.
- Queries, mutations, invalidation, server prefetch, dehydrated state, and browser cache adoption.
- Theme-based accessible controls, charts, dialogs, and Monaco policy editing.
- Documented APIs, middleware, probes, logging, security headers, and the production Node adapter.

## Commands

```sh
npm install
npm run dev             # Vite development with API and SSR
npm run build           # client and production server builds
npm start               # run the built Node application
npm test                # request, auth, query, mutation, and SSR tests
npm run openapi         # regenerate openapi.yml
npm run openapi:check   # byte-for-byte OpenAPI drift gate
npm run typecheck       # strict TypeScript
npm run lint            # source lint
```

Static generation is demonstrated separately in `../ssg`.

## File boundaries

- `src/application/*` owns public and protected page composition.
- `src/domains/*` owns repository interfaces, seeds, and reusable query definitions.
- `src/routes/api.ts` owns HTTP handlers and documented schemas.
- `src/api.ts` composes the OpenAPI definition.
- `src/boot/*` composes dependencies and query handlers.
- `src/app.ts` composes auth, middleware, API fallback, probes, and page SSR.
- `src/server/*` and `serve.mjs` are the Vite and Node hosting boundaries.

## Try it

Create a session, retain its cookie, and exercise both surfaces:

```sh
curl -i -X POST http://127.0.0.1:3002/api/session
curl http://127.0.0.1:3002/api/health
curl -H 'cookie: northstar-session=northstar-demo-session' http://127.0.0.1:3002/api/dashboard
curl -H 'cookie: northstar-session=northstar-demo-session' http://127.0.0.1:3002/workspace
```

In the browser, use Demo login, open a user dialog and save a change, toggle the persisted theme, then load and save the `support-escalation` policy in Monaco. Unknown `/api/*` paths remain API Problem responses and never fall into page SSR.

OpenAPI schemas document the contract; handlers still validate required bound values explicitly. Editable values come from the body, route and query values retain bind precedence, and `If-Match` is read explicitly from `ctx.headers`.
