# API-only server reference

This supplemental example demonstrates the basic HTTP patterns reused by the authenticated API and SSR application.

## Contract

- `GET /api/health`
- `GET /api/users`
- `GET /api/users/{id}`
- `PATCH /api/users/{id}`

It includes request IDs, explicit dependencies, typed route parameters, response helpers, Problem Details, `ctx.bind()`, explicit `If-Match` handling, deterministic OpenAPI 3.1.2 generation, probes, middleware, and Node serving. OpenAPI schemas document requests; the handler validates bound input at runtime.

## Commands

```sh
npm install
npm run dev
npm run build
npm start
npm test
npm run openapi
npm run openapi:check
npm run typecheck
npm run lint
```

## File boundaries

- `src/domains/users/repository.ts` defines the user dependency and in-memory seed.
- `src/routes/users.ts` demonstrates reads, binding precedence, validation, and optimistic concurrency.
- `src/routes/index.ts` is the route-group extension point.
- `src/api.ts` defines reusable schemas and OpenAPI metadata.
- `src/app.ts` owns middleware, probes, and application error handling.
- `src/boot/dependencies.ts` is the dependency composition root used by runtime entries and tests.

## Try it

```sh
curl -i http://127.0.0.1:3000/api/health
curl -i http://127.0.0.1:3000/api/users
curl -i http://127.0.0.1:3000/api/users/1
curl -i -X PATCH 'http://127.0.0.1:3000/api/users/1?role=operator' \
  -H 'content-type: application/json' \
  -H 'if-match: "1"' \
  -d '{"name":"Katherine Johnson","role":"viewer"}'
```

The query value wins for `role`, the path wins for `id`, and the concurrency header is intentionally read from `ctx.headers` rather than the bound model.
