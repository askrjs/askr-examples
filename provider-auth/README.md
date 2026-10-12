# One server-owned provider session

This Northstar extension uses one `createAskrApp` for provider login, callback,
session resolution, logout, protected pages, APIs and actions. Select Auth0,
Microsoft, Google or Apple explicitly. Browser code receives a minimal identity
snapshot and application display results. Provider access, refresh and ID tokens,
session IDs, client secrets and signing keys stay on the server.

This source targets the coordinated 0.5 consumer graph and declares
`>=0.5.0 <0.6.0` platform dependencies. Before executing it, generate ordinary
locks against the reviewed final archives through the candidate registry. The
four preset packages, SDK retirement, Server action auth type and Core fresh CSRF
resolver must be accepted first. Nothing here publishes a package.

## Follow the application

1. `src/server/environment.ts` validates one discriminated, server-only provider
   configuration. `providers.ts` selects its public preset; Apple reads its P-256
   key file here, never in browser code.
2. `src/server/app.ts` creates the sole engine through Server, registers the same
   route factory used by the client, declares `/api/action-csrf` and `/api/private`,
   and handles the protected `provider.read-summary` action.
3. `src/registry.tsx` owns `/`, `/login`, `/account`, `/account/details` and `/*`.
   Both private routes explicitly require a user and allow the action. The
   returned `sessionAuth` object is passed unchanged to the registry and boot.
4. `src/server/production.ts` imports the Vite-composed document and the exact raw
   entry singleton. `compose.ts` forwards composed fetch and raw engine cleanup;
   it never creates a second engine. Public provider/mode meta markers are filled
   after composition without exposing server configuration.
5. `src/client.tsx` validates those synchronous markers before taking ownership
   of `#app`. SSR calls `hydrateSPA`; pure SPA calls `createSPA`. Invalid markers
   clear the still-unowned root and fail before a session request or private boot.
6. `src/server/https.ts` loads a finite regular-file asset map, applies the public
   Node adapter's Host policy to assets and app together, and owns bounded shutdown.
   No request path is joined to the filesystem and no server/key/source-map files
   are served.

The default provider authority and display hints are in memory. This is a
single-process example: restarting invalidates its sessions, and two independent
engines do not share authority even when they use the same encryption keys.
Production multi-process deployments need the explicit shared provider store and
its atomic ownership/locking contract; a shared cookie secret alone is not one.

## Configure HTTPS and one provider

Use Node **24.21.0** and npm **12.0.1** for the qualified Vite+ toolchain. All
build, lint, format and unit-test commands use Vite+ 0.3.3. TypeScript compilers,
native Node serving and Playwright remain their explicit compiler/runtime gates.

```sh
cp .env.example .env.local
# Fill only the selected provider's credentials and all common settings.
npm install
npm run dev                 # Vite+ client + SSR build, then the same HTTPS server
# Or perform these two steps separately:
npm run build
npm start
```

`dev` deliberately builds then starts. This example claims neither HMR nor a
Vite development proxy path. Both modes use the same production HTTPS adapter.
The listener binds `127.0.0.1`; `ASKR_LISTEN_PORT` is its local port. `ASKR_ORIGIN`
is the browser-visible HTTPS origin, including an explicit port when appropriate.
Use a certificate trusted by your browser for that hostname and set its server
certificate/key paths. Keep `.env.local`, `.tls` and private keys out of source
control. Never disable Node/browser TLS verification globally.

Generate `ASKR_SESSION_SECRETS` with `crypto.randomBytes(32).toString('base64url')`:
one to four distinct canonical keys, newest first and comma-separated. Set a
separate unpredictable `ASKR_ACTION_CSRF_SECRET`. Session rotation and action CSRF
have separate owners. Error messages name required settings without printing
values. `.env.example` intentionally contains blank credentials.

Register the exact callback `${ASKR_ORIGIN}/auth/callback/<provider>` in the
provider application. Provider redirect URIs contain no fragment. The final
application `returnTo` may retain a safe path, query and fragment; it rejects
scheme-relative, foreign-origin, raw/encoded backslash, control and traversal
targets and falls back to `/account`.

| Selection   | Required provider settings                                                                                                   | Explicit server API operation                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `auth0`     | `AUTH0_DOMAIN` as a DNS hostname only (no scheme, path or port), client ID and secret; optional expected organization ID     | Optional: set audience, exact space-separated API scopes and HTTPS API URL together. No API target is guessed.             |
| `microsoft` | A specific tenant GUID, client ID and secret; register a confidential **Web** callback even when this app uses SPA rendering | Graph `https://graph.microsoft.com`, permission `https://graph.microsoft.com/User.Read`, `/v1.0/me?$select=displayName`    |
| `google`    | Web client ID and secret; optional exact `GOOGLE_HOSTED_DOMAIN`                                                              | `https://www.googleapis.com`, CalendarList readonly permission, CalendarList endpoint                                      |
| `apple`     | Services ID, Team ID, Key ID and server-readable P-256 `.p8` private-key path                                                | Identity only; the action displays the bounded application-owned profile hint or identity result. No API token capability. |

Auth0 login starts identity-only because its optional API policy is server-owned.
A server action needing API consent returns the typed canonical resource/scopes;
Core performs one explicit document recovery. Auth0 refresh-family reuse requires
provider-side audience/scope policies, offline access and refresh-token rotation.
Its [MRRT documentation](https://auth0.com/docs/secure/tokens/refresh-tokens/multi-resource-refresh-token)
limits this feature to first-party apps and APIs that allow skipping consent.
The simulated fixture deliberately assumes that policy for its configured API;
it does not establish your tenant's configuration.

Microsoft uses a fixed tenant and fully qualified configured Graph permissions.
Google uses explicit API scopes, keeps API grants separate from OIDC identity,
and requests consent only through the preset's bounded recovery policy. See the
primary [Microsoft authorization-code protocol](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
and [Google web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server).
An API permission does not become a browser role merely because a provider issued
an ID token or because a scope was requested.

Apple requires a registered public HTTPS hostname; localhost and IP literals are
rejected by this example's configuration. For local testing, use an appropriately
registered public tunnel/hostname and a trusted certificate, forwarding to the
loopback listener. The real browser returns a cross-site `form_post`; the sealed
transaction cookie is usable without the Lax application cookie. The preset
validates the signed identity and ES256 client-secret lifecycle. Its name hint is
unsigned, bounded display data and never authorization. Only deliberately
validated email/boolean fields and the separate name hint reach `onSignIn`; the
application stores a bounded label for at most eight hours. The persisted and
SSR principal remains minimal. Apple's private daily account validation is
family-locked; the default eight-hour app lifetime expires before a daily check
would normally become due. The engine/preset suite separately tests longer-lived
checks. Live Apple PKCE/provider behavior remains pending, alongside all other
live-provider compatibility claims.

## SSR and pure SPA

Set `ASKR_RENDER_MODE=ssr` or `spa`. SSR resolves authority and prefetches the
private query on the server; hydration adopts that snapshot without an initial
`GET /auth/session`. Pure SPA uses an explicit middleware only for known document
GET/HEAD routes: it returns an empty fragment and executes no SSR page, loader,
query or snapshot. Browser boot then makes exactly one initial session request.
Auth/API/action/asset routes and unsafe methods continue through the same app.

The private query belongs to Core's current app data runtime. Logout publishes
anonymous state locally, retires private DOM and aborts in-flight private work;
reload confirms the server authority is gone. This is local logout. Provider
revocation/logout is a separate explicit server capability, not implied by that
button. The signed HTTP tests also exercise supported explicit revocation.

Every action submission resolves a fresh CSRF token from `/api/action-csrf`, with
same-origin credentials, no-store, redirect errors and the supplied AbortSignal.
It never caches an SSR token; explicit `undefined` prevents fallback when no
session exists. API bearer tokens are obtained by `ctx.auth.token` and used only
by the server fetch with the same request signal. The application cancels the
upstream response body and returns a deliberate bounded message. It does not
proxy arbitrary provider JSON. Action error handling explicitly passes its
Problem Details cause to `sessionAuth.handleAuthFailure`; there is no global fetch
wrapper or automatic token-refresh retry.

## Reproduce acceptance after the final graph is available

```sh
npm run fmt -- --check
npm run check              # lint, strict typecheck, units, native installed surface
npm run test:types6        # this stage's actual TypeScript 6 compiler
npm run test:types7        # this stage's actual TypeScript 7 compiler
npm run build              # real client and Vite-composed production server
npm exec playwright install chromium firefox webkit
npm run test:browser       # pretest builds the real server fixture entry
```

The browser suite covers four providers × SSR/SPA × three engines, exact initial
session GET counts, SSR node identity, safe next/query/hash, secure HttpOnly/Lax
session cookies, Apple's cross-site POST without that application cookie, server
API actions, copied-callback rejection, consent, expiry, private-query cancellation,
logout/reload and bundle/console secret absence. An additional malformed-marker
control clears a previously signed-in server root before boot. HTTP tests exercise
actual signatures, state, nonce, PKCE, Apple ES256, rotation/revocation, engine
isolation, action-CSRF, strict Host/assets and shutdown. Existing producer suites
remain responsible for exhaustive protocol and authority race coverage.

`tests/signed-provider.ts` generates an owned temporary CA with OpenSSL, serves
signed protocol responses over real loopback HTTPS, and forwards only exact
allowlisted canonical provider endpoints through a pinned CA. Browser requests
retain canonical provider URLs and site/cookie semantics while Playwright routes
their transport to those real local servers. Unknown network traffic fails. No
live credentials, global DNS rewrite, TLS bypass, test-only producer source import
or browser token SDK is supplied. Every hold is released in finally and drains
are bounded. Native installed checks use public package export paths and module
identities, not source aliases. The seven-stage final candidate helper additionally
checks ordinary independent install/fresh-ci/lock/SRI/physical graph provenance.

These are prepared acceptance controls. Passing them later establishes simulated
release evidence, not real Auth0/Microsoft/Google/Apple service certification.

## Browser qualification currently blocked

The current Playwright transport fixture cannot complete redirected provider
navigation. Its public route handler intercepts only the first request in a
redirect chain; after the application's actual 303 response, the browser follows
the canonical provider URL outside that handler. This produces a DNS failure for
the simulated Auth0 tenant and can contact a real provider hostname for other
presets. Do not count the prepared browser matrix as passing acceptance.

A bounded experiment that stopped the top-level redirect and initiated a fresh
GET to the exact Location also raced navigation and failed. It is not included in
this source. The remaining fixture correction must preserve the actual 303,
Set-Cookie processing, canonical URLs, state/nonce/PKCE, callback behavior and
strict network/cancellation assertions. Installed contracts, unit tests,
TypeScript compilers and production builds are separate gates.
