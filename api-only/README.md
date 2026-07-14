# API-only

This example is a complete API application built with `@askrjs/server`.

- `src/app.ts` defines the router, wires dependencies, and turns it into a Fetch app.
- `src/server.ts` starts the Node process.
- `vite.config.ts` runs it in Vite development through `@askrjs/vite`.
- `src/server.ts` runs the same app through `@askrjs/node`.
- `src/routes/` contains the HTTP route surface, while `src/domains/` contains domain contracts and implementations.
- `src/routes/index.ts` composes all route modules.

The route DSL includes the standard HTTP verbs: `get`, `head`, `post`, `put`, `patch`, `delete`, `options`, `trace`, and `connect`.

Handlers use context-bound response helpers such as `ctx.ok()`, `ctx.created()`, `ctx.badRequest()`, `ctx.notFound()`, `ctx.noContent()`, and `ctx.internalServerError()`.

All error helpers return RFC Problem Details responses with `type`, `title`, `status`, and optional `detail` fields.

Dependencies are created in `src/boot/dependencies.ts` and passed directly to domain route registration functions. Route handlers do not look up services from `ctx`.

`src/app.ts` exposes `createApp(deps)` for isolated tests and alternate configurations, while also exporting a default configured `app` for the runtime entrypoints.

The route definitions stay close to the shape of the HTTP API:

```ts
const router = createRouter();
router.use(requestId);
router.get('/api/health', health);
router.post('/api/echo', echo);

const app = createServerApp(router);
```

## Development

```sh
npm install
npm run dev
```

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
