# API + SSR

This example combines the API-only and SSR-only patterns in one cohesive app.

- `src/api.ts` owns the documented API definition and OpenAPI metadata.
- `src/app.ts` injects dependencies, materializes those routes, and appends the
  deliberately undocumented `/api/*` fallback before creating one server app.
- `src/routes/api.ts` registers API handlers through the fluent definition.
- `src/routes/pages.tsx` defines Askr pages for SSR and hydration.
- `src/client.tsx` hydrates the same page route table in the browser.
- `src/server/entry-server.ts` is the outer composition root used by Vite SSR.
- `src/server.ts` runs the composed app through `@askrjs/node`.
- `index.html` and the Vite config provide the normal Vite client/SSR build surface.

## Development

```sh
npm install
npm run dev
```

An endpoint definition keeps runtime and documentation together:

```ts
api.get('/api/users/{id}', async (ctx, { users }) => {
  const user = await users.find(ctx.params.id);
  return user ? ctx.ok(user) : ctx.notFound('User not found');
})
  .operationId('getUser')
  .summary('Get a user')
  .pathParam('id', schema.string())
  .ok(User)
  .notFound();
```

Regenerate the checked-in contract after API changes and reject drift in CI:

```sh
npm run openapi
npm run openapi:check
```

The wildcard API fallback stays on the generic router and is intentionally
absent from `openapi.yml`. It is appended after the documented routes, so those
routes still take precedence and unknown API paths never reach the page fallback.
Schemas do not replace the existing explicit `ctx.bind()` calls.

Try both surfaces:

```sh
curl http://127.0.0.1:3002/
curl http://127.0.0.1:3002/api/health
curl http://127.0.0.1:3002/api/users/1
```

Build and preview with the ordinary Vite client and SSR builds:

```sh
npm run build
npm run preview
```

`npm run preview` serves the built client artifact. Use `npm start` to exercise
the request-time Node API + SSR runtime.
