# API-only

This example is a complete API application built with `@askrjs/server`.

- `src/api.ts` defines documented routes and their OpenAPI contract.
- `src/app.ts` injects dependencies, materializes the router, and turns it into a Fetch app.
- `src/server.ts` starts the Node process.
- `vite.config.ts` runs it in Vite development through `@askrjs/vite`.
- `src/server.ts` runs the same app through `@askrjs/node`.
- `src/routes/` contains the HTTP route surface, while `src/domains/` contains domain contracts and implementations.
- `src/routes/index.ts` composes all route modules.

The strict OpenAPI DSL includes the documented HTTP verbs and requires an
operation ID, summary, and at least one response for every route.

Handlers use context-bound response helpers such as `ctx.ok()`, `ctx.created()`, `ctx.badRequest()`, `ctx.notFound()`, `ctx.noContent()`, and `ctx.internalServerError()`.

All error helpers return RFC Problem Details responses with `type`, `title`, `status`, and optional `detail` fields.

Dependencies are created in `src/boot/dependencies.ts` and passed to
`api.createRouter(deps)`. Each handler receives that same object as its second
argument; route handlers do not look up services from `ctx`.

`src/app.ts` exposes `createApp(deps)` for isolated tests and alternate configurations, while also exporting a default configured `app` for the runtime entrypoints.

The route definitions stay close to the shape of the HTTP API:

```ts
const users = api.group('/api/users').tags('Users');

users.get('/{id}', async (ctx, { users }) => {
  const user = await users.find(ctx.params.id);
  return user ? ctx.ok(user) : ctx.notFound('User not found');
})
  .operationId('getUser')
  .summary('Get a user')
  .pathParam('id', schema.string())
  .ok(User)
  .notFound();
```

## Development

```sh
npm install
npm run dev
```

Generate the checked-in `openapi.yml` after changing the API definition, and
use the byte-for-byte check in CI:

```sh
npm run openapi
npm run openapi:check
```

The schema metadata documents the existing contract; it does not validate
requests. Handlers continue to call `ctx.bind()` explicitly.

## Node runtime

```sh
npm start
```

Try the API with:

```sh
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/greetings/Askr
curl -X POST http://127.0.0.1:3000/api/echo \
  -H 'content-type: application/json' \
  -d '{"hello":"world"}'
```
