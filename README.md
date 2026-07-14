# Askr examples

Small, runnable examples for the Askr server platform.

The examples are intentionally staged:

1. `api-only` — a Fetch-based API app developed with Vite and served with the Node adapter.
2. `ssr-only` — an Askr page app rendered on the server and hydrated in the browser.
3. `api-ssr` — API routes and page SSR composed in one app.

Each example keeps application assembly in `src/app.ts` and surfaces concrete
dependencies from an outer server entry under `src/server/`.

## API-only

The app is in [`api-only/`](api-only/). It uses one `createServerApp()` call, a request middleware, and ordinary method-aware routes. Vite development uses `@askrjs/vite`; the Node entry uses `@askrjs/node` for a production-style runtime.

Run it from the example directory:

```sh
cd api-only
npm install
npm run dev
```

Then try:

```sh
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/greetings/Askr
curl -X POST http://127.0.0.1:3000/api/echo \
  -H 'content-type: application/json' \
  -d '{"hello":"world"}'
```

The package dependencies point at the sibling platform packages while they are developed together. Once those packages are published, this example can switch to versioned dependencies without changing the app code.

Run `cd api-only && npm run dev` or `cd ssr-only && npm run dev` to start an individual example.

## SSR-only

`ssr-only` adds a shared Askr page route table and browser hydration. The app renders the page fragment; the normal Vite `index.html` owns the document shell.

## API + SSR

`api-ssr` combines both surfaces in one `createServerApp()`: API routes resolve first, while unmatched page requests render the shared Askr route table. Unknown `/api/*` requests remain API 404s.
