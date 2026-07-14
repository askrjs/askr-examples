# SPA operations workspace

## What remains unchanged from the previous stage

This is the starting stage. It establishes the Northstar vocabulary, routes, application components, deterministic data, and theme-first presentation that later stages retain.

## What this stage adds

- `/`, `/activity`, and a not-found route in one route registry.
- A shared operations layout with `Link`, Lucide icons, and `@askrjs/themes` navigation and layout primitives.
- `state`, `derive`, `For`, and `Show` through an interactive activity filter.
- A browser-only `createSPA()` boot.

## Commands

```sh
npm install
npm run dev             # development server
npm run build           # production client build
npm run preview         # serve the production client build
npm test                # unit and DOM behavior tests
npm run typecheck       # strict TypeScript
npm run lint            # source lint
```

This stage has no OpenAPI or static-generation command because it has no API or static output contract.

## File boundaries

- `src/application/data.ts` contains deterministic local data.
- `src/application/layout.tsx` owns shared navigation and page chrome.
- `src/application/pages.tsx` owns the overview, activity, and not-found pages.
- `src/application/routes.tsx` is where application routes are registered.
- `src/client.tsx` is the client-rendering boundary.
- `src/styles.css` imports the default theme and supplies only global defaults.

## Try it

Open `/`, follow the Activity link without a document reload, filter the activity list to deployments, toggle the color theme, and visit an unknown route to see the themed fallback.
