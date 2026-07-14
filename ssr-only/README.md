# SSR operations workspace

## What remains unchanged from the previous stage

The SPA's `data.ts`, `layout.tsx`, `pages.tsx`, `routes.tsx`, and `styles.css` are carried forward byte-for-byte. The routes remain `/`, `/activity`, and `/*`; the application is not rewritten for the server.

## What this stage adds

- A Fetch server app whose page fallback renders the existing registry.
- Vite development and production SSR entries plus the `@askrjs/node` adapter.
- Vite-owned document composition.
- A client boot that hydrates server markup or creates the app when no markup exists.

## Commands

```sh
npm install
npm run dev             # Vite development with request-time SSR
npm run build           # client and production SSR builds
npm start               # run the built Node SSR application
npm test                # SSR and fallback tests
npm run typecheck       # strict TypeScript
npm run lint            # source lint
```

This stage has no OpenAPI or static-generation command because it adds HTML hosting only.

## File boundaries

- `src/application/*` is the unchanged SPA application.
- `src/app.ts` adds the server page fallback.
- `src/server/entry-server.ts` composes the development server app.
- `src/server/production.ts` is Vite's production server build entry.
- `serve.mjs` runs that built entry through `@askrjs/node`.
- `src/client.tsx` selects hydration or fresh client creation.

## Try it

Request `/` with `curl` and observe the overview content in the HTML before JavaScript runs. Then open it in a browser, navigate to `/activity`, change a filter after hydration, and visit an unknown route.
