# API + SSR

This example combines the API-only and SSR-only patterns in one cohesive app.

- `src/app.ts` creates one router and one `@askrjs/server` app from injected dependencies.
- `src/routes/api.ts` registers API endpoints on that router.
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
