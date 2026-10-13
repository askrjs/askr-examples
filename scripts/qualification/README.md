# Application consumer checks

Run `npm run check` and `npm run build` first. `npm run test:runtime` then exercises the actual compiled API-only server, MCP stdio/stateless HTTP/stateful HTTP with SSE progress and session deletion, and the served SSG output in Chromium. Each child process must shut down cleanly. SSG checks the three generated documents, JavaScript/CSS MIME and bytes, missing-route 404, pre-module node identity through hydration, exactly one acknowledgment click, and unchanged installed-CLI incremental generation. It uses the application's explicit completion marker rather than framework internals.

`npm run test:browser` preserves the existing SPA, SSR-only and authenticated API/SSR journeys, including native forms with JavaScript disabled, server node reuse, no duplicate dashboard fetch, actions, theme/locale persistence, deferred success/failure, and Monaco save. `npm run acceptance` includes both runtime gates.

## Standalone published baseline

This historical mode requires a source revision with published 0.4 dependency
declarations. It deliberately rejects the current 0.5 manifests; use frozen
candidate mode below for this revision.

Use an absolute path to this workspace's installed Playwright module, and a new output directory outside this checkout:

```sh
npm run test:stages -- --baseline --out /tmp/askr-examples-baseline-new --playwright-module /absolute/checkout/node_modules/playwright/index.mjs
```

This copies all six stages independently, installs only each stage's own manifest, then replays the generated lock with `npm ci` in a separate directory and a fresh cache. It verifies physical installed packages stay inside the copied stage, canonical registry URLs, package versions and archive integrity, the exact lock replay, normal peer trees, full and production audits, and each stage's check/build commands. API-only, MCP and SSG also execute the runtime fixtures. Select stages with `--stages api-only,mcp-server,ssg`; select a supported SSG browser with `--engine chromium|firefox|webkit` after installing that binary.

The runner records `npm ls --all --json` diagnostics. The existing Vite+ 0.3.3 alias triggers one known development-only metadata conflict: `@vitest/mocker@4.1.11` advertises Vite 6/7/8 peers. That exact diagnostic is reported as a limitation, separately from normal install/ci and application gates; any other peer problem fails the runner. No strict-peer flag, force, or legacy-peer flag is supplied.

These SSG routes have no invalidation keys: unchanged incremental generation deliberately rerenders all three routes, reports three cache hits with Core's `written:false`, and preserves the published HTML bytes. CLI atomic publication may replace physical files, so this does not assert unchanged inodes or modification times. It does not claim three skipped routes.

CI lints these helpers on all three operating systems and runs the compiled runtime acceptance after building on Linux and macOS. The process-lifecycle checks use Unix SIGTERM semantics; Windows retains its existing application checks without claiming this runtime gate is portable there.

Baseline mode explicitly requires the current `>=0.4.0 <0.5.0` declarations and published 0.4 packages. It records the actual Node/npm versions; `packageManager` metadata is not substituted for the executing npm version. The helpers remove `NODE_PATH`/`NODE_OPTIONS`, supply no application dependencies or overrides, and do not rewrite manifests. Existing root browser journeys remain a separate gate.

## Frozen release candidate

The current manifests declare the coordinated 0.5 dependencies. Replace
`--baseline` with:

```sh
--inventory /absolute/frozen-graph.json --registry http://127.0.0.1:4873/
```

Candidate mode rejects 0.4 declarations and requires all 18 reviewed packages in the frozen inventory:

```json
{
  "schemaVersion": 1,
  "version": "0.5.0",
  "packages": {
    "@askrjs/askr": {
      "version": "0.5.0",
      "integrity": "sha512-...",
      "tarballSha256": "64 hex characters",
      "sourceCommit": "40 hex characters"
    }
  }
}
```

Before installing any stage, the runner downloads all 18 archives from the loopback
registry at their canonical npm tarball paths. Each archive must return HTTP 200
without redirects and match both the inventory's SHA-256 and SHA-512 SRI. It writes
the measured hashes, byte counts, canonical/served URLs and inventory producer
commits to `candidate-archives.json`; the final stage receipt includes the same
records. The coordinator must establish the source-commit-to-archive binding when
producing the frozen inventory: hashing package bytes cannot derive a Git commit.

The loopback registry must serve those exact archives while preserving canonical npm tarball URLs in generated locks. Every installed Askr package must match the frozen version and SRI; no `file:`/link dependencies, forced installs, optional-peer suppression, or extra application dependencies are introduced. An explicit `--npm-cli /absolute/npm/bin/npm-cli.js` selects a toolchain when invoking the helper directly; `npm run test:stages` uses its executing npm CLI.

`npm run test:qualification` exercises the archive boundary with owned HTTP
servers. Its runner regression supplies a valid SRI with a wrong SHA-256 and
asserts rejection before npm installation. Additional cases cover all 18 package
names, changed bytes, a wrong SRI, a missing archive and a rejected redirect.
`npm run check` and ordinary CI include these tests.

Full and production audits always query the public npm advisory database. The
candidate registry serves archive and metadata GETs only, so audit POSTs must
not be sent to it.

Final 0.5 qualification also needs the existing root browser acceptance, installed-CLI-created starters, Website and Destroyer against the same frozen graph. A successful published baseline does not complete that release gate.

## Provider session candidate extension

Candidate mode also copies `provider-auth` as a seventh independent stage. It
runs that stage's normal install, fresh-directory/cache `npm ci`, exact producer
version/SRI/physical-directory checks, audits, lint/unit/type/build gates, both
stage-owned TypeScript compilers, and the signed HTTPS browser suite. Install
Chromium, Firefox and WebKit for the stage-owned Playwright version beforehand;
OpenSSL must be available for the owned temporary CA. The stage supplies all its
own dependencies and never borrows a root dependency to repair its manifest.
The final API/action-CSRF/preset/SDK-retirement producers must be present in the
frozen candidate graph. Its declared ranges and normal generated lock must move
together during final preparation. Published-baseline mode deliberately keeps
its original six stages because published 0.4 lacks these new provider surfaces.
