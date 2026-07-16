# Static runbook reference

This supplemental workspace generates public Northstar operations runbooks. It demonstrates a shared document renderer, parameterized `entries()`, deterministic seed data, atomic output, generated metadata, and a small hydrated acknowledgment control.

## Commands

```sh
npm install
npm run dev             # inspect routes in Vite development
npm run generate        # run full generation through the Askr CLI
npm run build           # build assets and atomically publish the complete site
npm start               # serve the built static output
npm test                # route expansion, document, and metadata assertions
npm run typecheck
npm run lint
```

## File boundaries

- `src/data.ts` contains deterministic runbooks.
- `src/routes.tsx` declares `/` and parameterized `/runbooks/{slug}` entries.
- `src/document.ts` renders every complete HTML document.
- `src/pages.tsx` and `src/components/*` compose theme primitives.
- `src/client.tsx` hydrates the interactive control.
- `ssg.config.ts` defines output, seed, and concurrency.
- `askr ssg` runs the executable config and atomically publishes pages, metadata, the incremental manifest, and client assets.

After `npm run build`, open `/`, `/runbooks/api-recovery`, and `/runbooks/policy-rollback` through `npm start`. The generated `dist/static/metadata.json` records the complete route result.
