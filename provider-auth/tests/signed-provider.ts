import assert from "node:assert/strict";
import { generateKeyPairSync, createHash, sign, verify } from "node:crypto";
import { request as httpsRequest, createServer as createHttpsServer } from "node:https";
import { createServer } from "node:net";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import type { createExampleApp } from "../src/server/app.js";
import type { withApplicationLifecycle } from "../src/server/compose.js";
import type { startHttps } from "../src/server/https.js";
import type { ProviderName } from "../src/public-config.js";
import type { AskrApp } from "@askrjs/server/askr";
import type { ProviderEnvironment } from "../src/server/environment.js";

const tenant = "01234567-89ab-cdef-0123-456789abcdef";
const scopes = {
  auth0: "read:summary",
  microsoft: "https://graph.microsoft.com/User.Read",
  google: "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  apple: "",
};
const identityScopes = {
  auth0: "openid profile email offline_access",
  microsoft: "openid profile email offline_access",
  google: "openid profile email",
  apple: "openid name email",
};
export const canaries = [
  "MOCK_CLIENT_PRIVATE_CANARY",
  "MOCK_ACCESS_PRIVATE_CANARY",
  "MOCK_REFRESH_PRIVATE_CANARY",
  "MOCK_ID_PRIVATE_CANARY",
  "MOCK_JWT_PRIVATE_CANARY",
  "MOCK_SESSION_ENCRYPTION_CANARY",
];
export interface MockEvent {
  readonly kind: string;
  readonly target: string;
  readonly fields?: Readonly<Record<string, string>>;
}
export async function bounded<T>(operation: Promise<T>, label: string, ms = 2500): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Owned fixture deadline: ${label}`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function port() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const value = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return value;
}
function cookieHeaders(lines: readonly string[]) {
  return lines.map((line) => line.split(";")[0]).join("; ");
}
function html(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
export interface FixtureOwners {
  readonly createExampleApp: typeof createExampleApp;
  readonly withApplicationLifecycle: typeof withApplicationLifecycle;
  readonly startHttps: typeof startHttps;
  readonly createDocumentApp: (
    app: Pick<AskrApp, "fetch">,
    document: string,
  ) => Pick<AskrApp, "fetch">;
}
export async function signedProviderFixture(
  provider: ProviderName,
  mode: "ssr" | "spa",
  owners: FixtureOwners,
  document: string,
  assetsDirectory?: string,
  publicOrigin?: string,
  browserSimulation = false,
) {
  // A different reserved site preserves SameSite semantics without invoking a
  // provider's OS sign-in extension. This is never a live provider origin.
  const browserAuthorizationOrigin = browserSimulation
    ? "https://provider.example-provider.test"
    : undefined;
  const directory = await mkdtemp(join(tmpdir(), "askr-provider-app-"));
  // The complete allocation phase is covered, including certificate, key and listener setup.
  let cleanupEarly: (() => Promise<void>) | undefined;
  try {
    const events: MockEvent[] = [];
    const callbackRequests: Array<{
      url: string;
      method: string;
      headers: Record<string, string>;
      body?: Uint8Array;
    }> = [];
    const failures: unknown[] = [];
    const unknownTraffic: string[] = [];
    const releaseHolds = new Set<() => void>();
    let now = Date.now();
    let deny = false;
    let invalidSignature = false;
    let refreshError: string | undefined;
    let refreshes = 0;
    let exchanges = 0;
    let revoked = false;
    let hold:
      | {
          entered: Promise<void>;
          enter(): void;
          released: Promise<void>;
          release(): void;
          aborted: Promise<void>;
          abort(): void;
        }
      | undefined;
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const apple = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const jwk = {
      ...rsa.publicKey.export({ format: "jwk" }),
      kid: "fixture-rsa",
      alg: "RS256",
      use: "sig",
    };
    const caPath = join(directory, "ca.pem");
    const keyPath = join(directory, "tls.key");
    const applePath = join(directory, "apple.p8");
    const generated = spawnSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "2",
        "-subj",
        "/CN=Askr owned protocol fixture",
        "-addext",
        "subjectAltName=DNS:app.example.test,DNS:provider.example-provider.test,DNS:tenant.example.test,DNS:login.microsoftonline.com,DNS:accounts.google.com,DNS:oauth2.googleapis.com,DNS:www.googleapis.com,DNS:appleid.apple.com,DNS:api.example.test,DNS:graph.microsoft.com",
        "-keyout",
        keyPath,
        "-out",
        caPath,
      ],
      { encoding: "utf8", timeout: 30_000 },
    );
    if (generated.status !== 0) {
      await rm(directory, { recursive: true, force: true });
      throw new Error("Owned TLS fixture requires a working openssl executable");
    }
    await writeFile(applePath, apple.privateKey.export({ format: "pem", type: "pkcs8" }));
    const ca = await readFile(caPath);
    const appPort = await port();
    const origin = publicOrigin ?? `https://app.example.test:${appPort}`;
    const issuer =
      provider === "auth0"
        ? "https://tenant.example.test/"
        : provider === "microsoft"
          ? `https://login.microsoftonline.com/${tenant}/v2.0`
          : provider === "google"
            ? "https://accounts.google.com"
            : "https://appleid.apple.com";
    const authorize =
      provider === "auth0"
        ? `${issuer}authorize`
        : provider === "microsoft"
          ? `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`
          : provider === "google"
            ? `${issuer}/o/oauth2/v2/auth`
            : `${issuer}/auth/authorize`;
    const token =
      provider === "auth0"
        ? `${issuer}oauth/token`
        : provider === "microsoft"
          ? `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`
          : provider === "google"
            ? "https://oauth2.googleapis.com/token"
            : `${issuer}/auth/token`;
    const jwks =
      provider === "auth0"
        ? `${issuer}.well-known/jwks.json`
        : provider === "microsoft"
          ? "https://login.microsoftonline.com/common/discovery/v2.0/keys"
          : provider === "google"
            ? "https://www.googleapis.com/oauth2/v3/certs"
            : `${issuer}/auth/keys`;
    const revoke =
      provider === "auth0"
        ? `${issuer}oauth/revoke`
        : provider === "google"
          ? "https://oauth2.googleapis.com/revoke"
          : provider === "apple"
            ? `${issuer}/auth/revoke`
            : undefined;
    const api =
      provider === "auth0"
        ? "https://api.example.test/summary"
        : provider === "microsoft"
          ? "https://graph.microsoft.com/v1.0/me?$select=displayName"
          : provider === "google"
            ? "https://www.googleapis.com/calendar/v3/users/me/calendarList"
            : undefined;
    const discovery = `${issuer.replace(/\/$/u, "")}/.well-known/openid-configuration`;
    const browserAuthorize = browserAuthorizationOrigin
      ? new URL(new URL(authorize).pathname, browserAuthorizationOrigin).href
      : authorize;
    const allowed = new Set([
      discovery,
      authorize,
      token,
      jwks,
      ...(revoke ? [revoke] : []),
      ...(api ? [api] : []),
    ]);
    const codes = new Map<
      string,
      { nonce: string; challenge: string; redirect: string; scope: string }
    >();
    let sequence = 0;
    let last: { nonce: string; challenge: string; redirect: string; scope: string } | undefined;
    let refreshToken = "MOCK_REFRESH_PRIVATE_CANARY_0";
    const accessTokens = new Set<string>();
    const idTokens = new Set<string>();
    const jwt = (claims: Record<string, unknown>) => {
      const header = Buffer.from(
        JSON.stringify({ alg: "RS256", kid: "fixture-rsa", typ: "JWT" }),
      ).toString("base64url");
      const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
      const signature = sign(
        "RSA-SHA256",
        Buffer.from(`${header}.${payload}`),
        invalidSignature
          ? generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey
          : rsa.privateKey,
      ).toString("base64url");
      return `${header}.${payload}.${signature}`;
    };
    const mock = createHttpsServer(
      { cert: ca, key: await readFile(keyPath) },
      async (request, response) => {
        try {
          const target = new URL(request.url ?? "/", `https://${request.headers.host}`);
          if (browserAuthorizationOrigin && target.origin === browserAuthorizationOrigin) {
            assert.equal(`${target.origin}${target.pathname}`, browserAuthorize);
            const canonical = new URL(authorize);
            target.host = canonical.host;
            target.protocol = canonical.protocol;
          }
          const exact = `${target.origin}${target.pathname}${target.search}`;
          const endpoint = `${target.origin}${target.pathname}`;
          assert.ok(allowed.has(endpoint) || allowed.has(exact), "Unknown provider endpoint");
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of request) {
            const bytes = Buffer.from(chunk);
            size += bytes.length;
            assert.ok(size <= 32768);
            chunks.push(bytes);
          }
          const fields = new URLSearchParams(Buffer.concat(chunks).toString());
          events.push({
            kind:
              endpoint === authorize
                ? "authorize"
                : endpoint === token
                  ? (fields.get("grant_type") ?? "token")
                  : "request",
            target: exact,
            fields: Object.fromEntries(endpoint === authorize ? target.searchParams : fields),
          });
          response.setHeader("content-type", "application/json");
          if (endpoint === discovery)
            return response.end(
              JSON.stringify({
                issuer,
                authorization_endpoint: authorize,
                token_endpoint: token,
                jwks_uri: jwks,
                response_types_supported: ["code"],
                response_modes_supported: ["query", "form_post"],
                subject_types_supported: ["public"],
                id_token_signing_alg_values_supported: ["RS256"],
                code_challenge_methods_supported: ["S256"],
                token_endpoint_auth_methods_supported: ["client_secret_post"],
                scopes_supported: identityScopes[provider].split(" "),
                ...(provider === "microsoft"
                  ? {
                      end_session_endpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/logout`,
                    }
                  : {}),
              }),
            );
          if (endpoint === jwks) return response.end(JSON.stringify({ keys: [jwk] }));
          if (endpoint === authorize) {
            const query = target.searchParams;
            assert.equal(query.get("response_type"), "code");
            assert.equal(query.get("code_challenge_method"), "S256");
            assert.equal(query.get("redirect_uri"), `${origin}/auth/callback/${provider}`);
            assert.ok(query.get("state"));
            assert.ok(query.get("nonce"));
            assert.ok(query.get("code_challenge"));
            if (provider === "auth0" && query.has("audience")) {
              assert.equal(query.get("audience"), "urn:fixture:api");
              assert.ok(query.get("scope")?.split(" ").includes(scopes.auth0));
            }
            if (provider === "microsoft" || provider === "google") {
              assert.equal(query.has("resource"), false);
              assert.equal(query.has("audience"), false);
            }
            const code = `owned-code-${++sequence}`;
            const transaction = {
              nonce: query.get("nonce")!,
              challenge: query.get("code_challenge")!,
              redirect: query.get("redirect_uri")!,
              scope: query.get("scope")!,
            };
            codes.set(code, transaction);
            last = transaction;
            const result = new URLSearchParams({
              state: query.get("state")!,
              ...(deny ? { error: "access_denied" } : { code }),
            });
            if (provider === "apple") assert.equal(query.get("response_mode"), "form_post");
            if (provider === "apple" || browserAuthorizationOrigin) {
              response.setHeader("content-type", "text/html; charset=utf-8");
              return response.end(
                `<form method="${provider === "apple" ? "post" : "get"}" action="${html(transaction.redirect)}">${[...result, ...(provider === "apple" ? [["user", JSON.stringify({ name: { firstName: "Unsigned", lastName: "Display Hint" } })]] : [])].map(([key, value]) => `<input type="hidden" name="${html(key!)}" value="${html(value!)}">`).join("")}<button id="continue" type="submit">Complete ${provider} sign in</button></form>`,
              );
            }
            response.writeHead(303, { location: `${transaction.redirect}?${result}` });
            return response.end();
          }
          if (endpoint === token || endpoint === revoke) {
            assert.equal(fields.get("client_id"), "fixture-client");
            if (provider === "apple") {
              const secret = fields.get("client_secret")!;
              const parts = secret.split(".");
              assert.equal(parts.length, 3);
              assert.ok(
                verify(
                  "sha256",
                  Buffer.from(`${parts[0]}.${parts[1]}`),
                  { key: apple.publicKey, dsaEncoding: "ieee-p1363" },
                  Buffer.from(parts[2]!, "base64url"),
                ),
              );
              const header = JSON.parse(Buffer.from(parts[0]!, "base64url").toString());
              const claims = JSON.parse(Buffer.from(parts[1]!, "base64url").toString());
              assert.equal(header.alg, "ES256");
              assert.equal(header.kid, "KEY1234567");
              assert.equal(claims.iss, "TEAM123456");
              assert.equal(claims.sub, "fixture-client");
              assert.equal(claims.aud, issuer);
              assert.ok(claims.exp > now / 1000 && claims.exp <= now / 1000 + 300);
            } else assert.equal(fields.get("client_secret"), "MOCK_CLIENT_PRIVATE_CANARY");
            if (endpoint === revoke) {
              assert.equal(fields.get("token"), refreshToken);
              revoked = true;
              response.statusCode = 200;
              return response.end("{}");
            }
            let transaction = last;
            if (fields.get("grant_type") === "authorization_code") {
              exchanges++;
              const code = fields.get("code")!;
              transaction = codes.get(code);
              codes.delete(code);
              assert.ok(transaction);
              assert.equal(fields.get("redirect_uri"), transaction.redirect);
              assert.equal(
                createHash("sha256").update(fields.get("code_verifier")!).digest("base64url"),
                transaction.challenge,
              );
            } else {
              assert.equal(fields.get("grant_type"), "refresh_token");
              refreshes++;
              if (provider === "auth0") {
                assert.equal(fields.get("audience"), "urn:fixture:api");
                assert.ok(fields.get("scope")?.split(" ").includes(scopes.auth0));
              }
              if (provider === "microsoft" || provider === "google") {
                assert.equal(fields.has("resource"), false);
                assert.equal(fields.has("audience"), false);
                assert.ok(fields.get("scope")?.split(" ").includes(scopes[provider]));
              }
              assert.equal(fields.get("refresh_token"), refreshToken);
              if (hold) {
                const owned = hold;
                response.once("close", () => {
                  if (!response.writableEnded) owned.abort();
                });
                owned.enter();
                await owned.released;
              }
              if (refreshError || revoked) {
                response.statusCode = 400;
                return response.end(JSON.stringify({ error: refreshError ?? "invalid_grant" }));
              }
            }
            assert.ok(transaction);
            refreshToken = `MOCK_REFRESH_PRIVATE_CANARY_${exchanges + refreshes}`;
            const access = `MOCK_ACCESS_PRIVATE_CANARY_${exchanges + refreshes}`;
            accessTokens.add(access);
            const selected = fields.get("scope") ?? transaction.scope;
            const idToken = jwt({
              iss: issuer,
              aud: "fixture-client",
              sub: "fixture-account",
              nonce: transaction.nonce,
              iat: Math.floor(now / 1000),
              exp: Math.floor(now / 1000) + 3600,
              ...(provider === "microsoft" ? { tid: tenant } : {}),
              email: "signed@example.test",
              email_verified: "true",
              is_private_email: "false",
              private_claim: "MOCK_JWT_PRIVATE_CANARY",
            });
            idTokens.add(idToken);
            return response.end(
              JSON.stringify({
                access_token: access,
                token_type: "Bearer",
                expires_in: 1,
                refresh_token: refreshToken,
                id_token: idToken,
                ...(provider === "apple" ? {} : { scope: selected }),
              }),
            );
          }
          assert.equal(exact, api);
          assert.ok(
            accessTokens.has((request.headers.authorization ?? "").replace(/^Bearer /u, "")),
          );
          response.end(
            JSON.stringify({
              displayName: "Explicit API display",
              private: "MOCK_ID_PRIVATE_CANARY",
            }),
          );
        } catch (error) {
          failures.push(error);
          response.statusCode = 500;
          response.end('{"error":"owned-provider-fixture"}');
        }
      },
    );
    cleanupEarly = async () => {
      mock.closeAllConnections();
      await bounded(
        new Promise<void>((resolve) => mock.close(() => resolve())),
        "early mock shutdown",
      );
    };
    await bounded(
      new Promise<void>((resolve, reject) => {
        mock.once("error", reject);
        mock.listen(0, "127.0.0.1", resolve);
      }),
      "mock listener setup",
    );
    const address = mock.address();
    assert.ok(address && typeof address === "object");
    const mockPort = address.port;
    async function pinned(
      url: URL,
      init: {
        method?: string;
        headers?: Record<string, string>;
        body?: Uint8Array;
        signal?: AbortSignal;
      },
      destination: number,
    ) {
      return new Promise<Response>((resolve, reject) => {
        const request = httpsRequest(
          {
            hostname: "127.0.0.1",
            port: destination,
            servername: url.hostname,
            ca,
            method: init.method ?? "GET",
            path: `${url.pathname}${url.search}`,
            headers: { ...init.headers, host: init.headers?.host ?? url.host },
            signal: init.signal,
          },
          (response) => {
            const chunks: Buffer[] = [];
            response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
            response.once("error", reject);
            response.once("end", () => {
              const headers = new Headers();
              for (let index = 0; index < response.rawHeaders.length; index += 2)
                headers.append(response.rawHeaders[index]!, response.rawHeaders[index + 1]!);
              resolve(
                new Response(
                  init.method === "HEAD" || [204, 205, 304].includes(response.statusCode!)
                    ? null
                    : new Uint8Array(Buffer.concat(chunks)),
                  { status: response.statusCode, headers },
                ),
              );
            });
          },
        );
        request.once("error", reject);
        request.end(init.body);
      });
    }
    const transport: typeof fetch = async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      if (!allowed.has(`${url.origin}${url.pathname}`) && !allowed.has(url.href)) {
        unknownTraffic.push(url.href);
        throw new Error("Unallowlisted provider transport");
      }
      return pinned(
        url,
        {
          method: request.method,
          headers: Object.fromEntries(request.headers),
          body: request.body ? new Uint8Array(await request.arrayBuffer()) : undefined,
          signal: request.signal,
        },
        mockPort,
      );
    };
    const base = {
      mode,
      origin,
      listenPort: appPort,
      sessionSecrets: [Buffer.alloc(32, 9).toString("base64url")],
      actionCsrfSecret: "OWNED_ACTION_CSRF_SECRET",
      tls: { certPath: caPath, keyPath },
    };
    const env: ProviderEnvironment =
      provider === "auth0"
        ? {
            ...base,
            provider,
            credentials: {
              domain: "tenant.example.test",
              clientId: "fixture-client",
              clientSecret: "MOCK_CLIENT_PRIVATE_CANARY",
            },
            api: { resource: "urn:fixture:api", scopes: [scopes.auth0], url: api! },
          }
        : provider === "microsoft"
          ? {
              ...base,
              provider,
              credentials: {
                tenantId: tenant,
                clientId: "fixture-client",
                clientSecret: "MOCK_CLIENT_PRIVATE_CANARY",
              },
              api: {
                resource: "https://graph.microsoft.com",
                scopes: [scopes.microsoft],
                url: api!,
              },
            }
          : provider === "google"
            ? {
                ...base,
                provider,
                credentials: {
                  clientId: "fixture-client",
                  clientSecret: "MOCK_CLIENT_PRIVATE_CANARY",
                },
                api: { resource: "https://www.googleapis.com", scopes: [scopes.google], url: api! },
              }
            : {
                ...base,
                provider,
                credentials: {
                  servicesId: "fixture-client",
                  teamId: "TEAM123456",
                  keyId: "KEY1234567",
                  privateKeyPath: applePath,
                },
              };
    let serving: Awaited<ReturnType<typeof startHttps>> | undefined;
    let app: AskrApp | undefined;
    try {
      const application = await owners.createExampleApp(env, {
        fetch: transport,
        clock: () => now,
      });
      const applicationOwner = owners.withApplicationLifecycle(
        owners.createDocumentApp(application.app, document),
        application.app,
        application.publicConfig,
      );
      // The preset still constructs and validates canonical endpoints. Only the
      // simulated browser hop uses a reserved origin, keeping OS provider SDKs
      // outside this signed HTTP fixture (notably Apple's macOS AppSSO).
      app = browserAuthorizationOrigin
        ? {
            ...applicationOwner,
            async fetch(request) {
              const requestUrl = new URL(request.url);
              if (
                requestUrl.origin === origin &&
                requestUrl.pathname === `/auth/callback/${provider}`
              ) {
                callbackRequests.push({
                  url: request.url,
                  method: request.method,
                  headers: Object.fromEntries(request.headers),
                  ...(request.body
                    ? { body: new Uint8Array(await request.clone().arrayBuffer()) }
                    : {}),
                });
              }
              if (requestUrl.origin === origin && requestUrl.pathname === "/__fixture/authorize") {
                assert.equal(request.method, "GET");
                const simulated = new URL(browserAuthorize);
                simulated.search = requestUrl.search;
                return new Response(
                  `<a id="provider-continue" href="${html(simulated.href)}">Continue to signed simulated provider</a>`,
                  {
                    headers: {
                      "content-type": "text/html; charset=utf-8",
                      "cache-control": "no-store",
                    },
                  },
                );
              }
              const response = await applicationOwner.fetch(request);
              const location = response.headers.get("location");
              if (!location) return response;
              const target = new URL(location, origin);
              if (target.origin === origin) return response;
              assert.equal(`${target.origin}${target.pathname}`, authorize);
              assert.equal(response.status, 303);
              events.push({ kind: "browser_authorize_redirect", target: target.href });
              // WebKit reports a native cross-site 303 navigation as interrupted.
              // Keep the actual response/cookies and make the simulator handoff
              // explicit before a browser gesture enters the separate provider site.
              const handoff = new URL("/__fixture/authorize", origin);
              handoff.search = target.search;
              const headers = new Headers(response.headers);
              headers.set("location", handoff.href);
              return new Response(response.body, { status: response.status, headers });
            },
          }
        : applicationOwner;
      const assets = assetsDirectory ?? join(directory, "assets");
      if (!assetsDirectory) {
        await mkdir(assets);
        await writeFile(join(assets, "owned.js"), "export {};\n");
      }
      serving = await owners.startHttps(app, env, assets);
    } catch (error) {
      for (const release of releaseHolds) release();
      const results = await Promise.allSettled([
        bounded(
          Promise.resolve().then(() => app?.close()),
          "early app shutdown",
        ),
        cleanupEarly(),
      ]);
      const cleanupFailures = results
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) => result.reason);
      cleanupEarly = undefined;
      if (cleanupFailures.length)
        throw new AggregateError([error, ...cleanupFailures], "Fixture startup failed");
      throw error;
    }
    let closed: Promise<void> | undefined;
    return {
      provider,
      mode,
      origin,
      env,
      events,
      callbackRequests,
      failures,
      unknownTraffic,
      browserDestinations: new Map([
        [`${new URL(origin).hostname}:${new URL(origin).port || "443"}`, appPort],
        ...[...(browserAuthorizationOrigin ? [browserAuthorize] : allowed)].map(
          (endpoint): [string, number] => {
            const url = new URL(endpoint);
            return [`${url.hostname}:${url.port || "443"}`, mockPort];
          },
        ),
      ]),
      assertBrowserDestination(url: string) {
        const target = new URL(url);
        if (
          target.origin !== origin &&
          (browserAuthorizationOrigin
            ? `${target.origin}${target.pathname}` !== browserAuthorize
            : !allowed.has(`${target.origin}${target.pathname}`) && !allowed.has(target.href))
        ) {
          unknownTraffic.push(target.href);
          throw new Error("Unknown browser destination");
        }
      },
      browserAuthorizationOrigin: new URL(browserAuthorize).origin,
      secrets() {
        return [
          "MOCK_CLIENT_PRIVATE_CANARY",
          env.actionCsrfSecret,
          ...env.sessionSecrets,
          ...accessTokens,
          ...idTokens,
          refreshToken,
        ];
      },
      get exchanges() {
        return exchanges;
      },
      get refreshes() {
        return refreshes;
      },
      advance(ms: number) {
        now += ms;
      },
      deny(value: boolean) {
        deny = value;
      },
      invalidSignature(value: boolean) {
        invalidSignature = value;
      },
      refreshFailure(value?: string) {
        refreshError = value;
      },
      holdRefresh() {
        assert.equal(hold, undefined);
        let enter!: () => void;
        let release!: () => void;
        const entered = new Promise<void>((resolve) => {
          enter = resolve;
        });
        const released = new Promise<void>((resolve) => {
          release = resolve;
        });
        let abort!: () => void;
        const aborted = new Promise<void>((resolve) => {
          abort = resolve;
        });
        const owned = {
          entered,
          enter,
          released,
          aborted,
          abort,
          release: () => {
            release();
            if (hold === owned) hold = undefined;
          },
        };
        hold = owned;
        releaseHolds.add(owned.release);
        return owned;
      },
      async request(
        path: string,
        init: {
          method?: string;
          headers?: Record<string, string>;
          body?: Uint8Array;
          signal?: AbortSignal;
        } = {},
      ) {
        return pinned(new URL(path, origin), init, appPort);
      },
      async browserResponse(
        url: string,
        init: { method: string; headers: Record<string, string>; body?: Uint8Array },
      ) {
        const target = new URL(url);
        if (target.origin === origin) return pinned(target, init, appPort);
        if (allowed.has(`${target.origin}${target.pathname}`) || allowed.has(target.href))
          return pinned(target, init, mockPort);
        unknownTraffic.push(target.href);
        throw new Error("Unknown browser destination");
      },
      async login(
        returnTo = "/account",
        api?: { readonly resource: string; readonly scopes: readonly string[] },
      ) {
        const query = new URLSearchParams({ returnTo });
        if (api) {
          query.set("resource", api.resource);
          for (const scope of api.scopes) query.append("scope", scope);
        }
        const login = await pinned(
          new URL(`/auth/login/${provider}?${query}`, origin),
          {},
          appPort,
        );
        assert.equal(login.status, 303);
        const cookies = cookieHeaders(login.headers.getSetCookie());
        const authorization = await pinned(
          new URL(
            browserSimulation
              ? events.filter((event) => event.kind === "browser_authorize_redirect").at(-1)!.target
              : login.headers.get("location")!,
          ),
          {},
          mockPort,
        );
        let callback: Response;
        if (provider === "apple" || browserAuthorizationOrigin) {
          const page = await authorization.text();
          const fields = new URLSearchParams();
          for (const match of page.matchAll(/name="([^"]+)" value="([^"]*)"/gu))
            fields.append(
              match[1]!,
              match[2]!
                .replaceAll("&quot;", '"')
                .replaceAll("&lt;", "<")
                .replaceAll("&gt;", ">")
                .replaceAll("&amp;", "&"),
            );
          const callbackUrl = new URL(`/auth/callback/${provider}`, origin);
          if (provider !== "apple") callbackUrl.search = fields.toString();
          callback = await pinned(
            callbackUrl,
            {
              method: provider === "apple" ? "POST" : "GET",
              headers: {
                cookie:
                  provider === "apple"
                    ? cookies
                        .split("; ")
                        .filter((value) => value.startsWith("__Host-askr-txn-"))
                        .join("; ")
                    : cookies,
                "content-type": "application/x-www-form-urlencoded",
                origin: new URL(browserAuthorize).origin,
              },
              ...(provider === "apple" ? { body: Buffer.from(fields.toString()) } : {}),
            },
            appPort,
          );
        } else
          callback = await pinned(
            new URL(authorization.headers.get("location")!),
            { headers: { cookie: cookies } },
            appPort,
          );
        return {
          response: callback,
          cookie: cookieHeaders(callback.headers.getSetCookie()),
          loginCookie: cookies,
          authorization,
        };
      },
      close() {
        return (closed ??= (async () => {
          for (const release of releaseHolds) release();
          const results = await Promise.allSettled([
            bounded(serving!.close(), "application shutdown"),
            bounded(
              new Promise<void>((resolve, reject) => {
                mock.close((error) => (error ? reject(error) : resolve()));
                mock.closeAllConnections();
              }),
              "mock shutdown",
            ),
          ]);
          await rm(directory, { recursive: true, force: true });
          for (const result of results)
            if (result.status === "rejected") failures.push(result.reason);
          assert.deepEqual(unknownTraffic, []);
          assert.deepEqual(failures, []);
        })());
      },
    };
  } catch (error) {
    let cleanupError: unknown;
    try {
      await cleanupEarly?.();
    } catch (failure) {
      cleanupError = failure;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
    if (cleanupError) throw new AggregateError([error, cleanupError], "Fixture allocation failed");
    throw error;
  }
}
