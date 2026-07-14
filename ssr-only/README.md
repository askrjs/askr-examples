# SSR-only

This example renders Askr pages on the server through `@askrjs/server` and
uses `@askrjs/vite` for development.

- `src/app.ts` creates the server app with the shared page route table.
- `src/server/entry-server.ts` is the outer composition root used by Vite SSR.
- `index.html` is the Vite client document and build entry.
- `src/routes/index.tsx` defines the pages and fallback route.
- `src/client.tsx` hydrates the exact same route table in the browser.
- `src/server/entry-server.ts` is the Vite SSR build entry.
- `src/server.ts` runs the app through `@askrjs/node`.

## Development

```sh
npm install
npm run dev
```

Open <http://127.0.0.1:3001/> and view the rendered page before hydration runs.

Build the ordinary Vite client and SSR entry with:

```sh
npm run build
npm run preview
```

`npm run preview` serves the built client artifact. Use `npm start` to exercise
the request-time Node SSR runtime.

## Node runtime

```sh
npm start
```

The next example will combine this page surface with API routes in one app.
