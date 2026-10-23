import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createDocumentApp } from "@askrjs/vite/server";
import { createExampleApp } from "../src/server/app.js";
import { withApplicationLifecycle } from "../src/server/compose.js";
import { startHttps } from "../src/server/https.js";
import { signedProviderFixture, bounded, canaries } from "./signed-provider.js";
import type { ProviderName } from "../src/public-config.js";
const owned: Array<Awaited<ReturnType<typeof signedProviderFixture>>> = [];
afterEach(async () => {
  const results = await Promise.allSettled(owned.splice(0).map((fixture) => fixture.close()));
  for (const result of results) if (result.status === "rejected") throw result.reason;
});
async function fixture(provider: ProviderName, mode: "ssr" | "spa" = "ssr", publicOrigin?: string) {
  const f = await signedProviderFixture(
    provider,
    mode,
    { createExampleApp, withApplicationLifecycle, startHttps, createDocumentApp },
    await readFile(new URL("../index.html", import.meta.url), "utf8"),
    undefined,
    publicOrigin,
  );
  owned.push(f);
  return f;
}
function actionHeaders(origin: string, cookie: string, csrf: string) {
  return {
    cookie,
    origin,
    "content-type": "application/json",
    accept: "application/vnd.askr.action+json;v=1",
    "x-askr-action": "provider.read-summary",
    "x-askr-csrf-token": csrf,
  };
}
describe("real signed provider application transport", () => {
  it.each(["auth0", "microsoft"] as const)(
    "retires local authority before %s provider logout without exposing tokens",
    async (provider) => {
      const f = await fixture(provider);
      const signed = await f.login();
      const response = await f.request("/auth/logout", {
        method: "POST",
        headers: { cookie: signed.cookie, origin: f.origin, "content-type": "application/json" },
        body: Buffer.from(
          JSON.stringify({
            provider,
            providerLogout: true,
            revoke: provider === "auth0",
            returnTo: "/",
          }),
        ),
      });
      expect(response.status).toBe(303);
      const location = response.headers.get("location")!;
      const destination = new URL(location);
      expect(`${destination.origin}${destination.pathname}`).toBe(
        provider === "auth0"
          ? "https://tenant.example.test/oidc/logout"
          : "https://login.microsoftonline.com/01234567-89ab-cdef-0123-456789abcdef/oauth2/v2.0/logout",
      );
      expect(Object.fromEntries(destination.searchParams)).toEqual({
        client_id: "fixture-client",
        post_logout_redirect_uri: `${f.origin}/`,
      });
      for (const secret of [...canaries, ...f.secrets()]) expect(location).not.toContain(secret);
      expect(
        response.headers
          .getSetCookie()
          .some((line) => line.startsWith("__Host-askr-session=;") && line.includes("Max-Age=0")),
      ).toBe(true);
      const retired = await f.request("/auth/session", { headers: { cookie: signed.cookie } });
      expect((await retired.json()).authenticated).toBe(false);
      // The simulator never follows an end-session redirect to a live service.
      expect(
        f.events.some((event) =>
          event.target.startsWith(`${destination.origin}${destination.pathname}`),
        ),
      ).toBe(false);
    },
  );
  it.each(["auth0", "microsoft", "google", "apple"] as const)(
    "completes %s signed HTTPS state/PKCE/JWKS and contains snapshots",
    async (provider) => {
      const f = await fixture(provider);
      const returnTo = "/account/details?view=full#panel";
      const signed = await bounded(f.login(returnTo, f.env.api), "signed login");
      expect(signed.response.status).toBe(303);
      expect(signed.response.headers.get("location")).toBe(new URL(returnTo, f.origin).href);
      const session = await f.request("/auth/session", { headers: { cookie: signed.cookie } });
      expect(session.headers.get("cache-control")).toBe("no-store");
      const snapshot = await session.text();
      expect(JSON.parse(snapshot)).toMatchObject({
        authenticated: true,
        principal: { subject: "fixture-account" },
      });
      expect(JSON.parse(snapshot)).not.toHaveProperty("session");
      for (const canary of [...canaries, ...f.secrets()]) expect(snapshot).not.toContain(canary);
      const csrf = await (
        await f.request("/api/action-csrf", { headers: { cookie: signed.cookie } })
      ).json();
      expect(Object.keys(csrf)).toEqual(["csrfToken"]);
      const action = await f.request("/account", {
        method: "POST",
        headers: actionHeaders(f.origin, signed.cookie, csrf.csrfToken),
        body: Buffer.from("{}"),
      });
      expect(action.status).toBe(200);
      const result = await action.text();
      for (const canary of [...canaries, ...f.secrets()]) expect(result).not.toContain(canary);
      if (provider !== "apple")
        expect(
          f.events.some((event) =>
            event.target.includes(
              provider === "microsoft"
                ? "graph.microsoft.com/v1.0/me"
                : provider === "google"
                  ? "calendar/v3"
                  : "api.example.test/summary",
            ),
          ),
        ).toBe(true);
      const logout = await f.request("/auth/logout", {
        method: "POST",
        headers: { cookie: signed.cookie, origin: f.origin, "content-type": "application/json" },
        body: Buffer.from(JSON.stringify({ provider, revoke: provider !== "microsoft" })),
      });
      expect(logout.status).toBe(204);
      const retired = await (
        await f.request("/auth/session", { headers: { cookie: signed.cookie } })
      ).json();
      expect(retired.authenticated).toBe(false);
    },
  );
  it.each(["ssr", "spa"] as const)(
    "composes the %s document without exposing private server configuration",
    async (mode) => {
      const f = await fixture("google", mode);
      const signed = await f.login();
      const response = await f.request("/account", { headers: { cookie: signed.cookie } });
      const text = await response.text();
      expect(text).toContain(`name="askr-example-provider" content="google"`);
      expect(text).toContain(`name="askr-example-mode" content="${mode}"`);
      if (mode === "spa") {
        expect(text).toContain('<div id="app"></div>');
        expect(text).not.toContain("Private account");
        expect(text).not.toContain("fixture-account");
      } else {
        expect(text).toContain("Private account");
        expect(text).toContain("fixture-account");
      }
      for (const canary of [...canaries, ...f.secrets()]) expect(text).not.toContain(canary);
      expect(text).not.toContain("OWNED_ACTION_CSRF_SECRET");
      expect(response.headers.get("cache-control")).toBe("no-store");
    },
  );
  it("rejects wrong Host for assets and auth before dispatch and keeps static methods finite", async () => {
    const f = await fixture("auth0");
    // TLS servername remains pinned while the supplied HTTP Host deliberately differs.
    expect((await f.request("/assets/owned.js")).status).toBe(200);
    expect(await (await f.request("/assets/owned.js", { method: "HEAD" })).text()).toBe("");
    expect((await f.request("/assets/owned.js", { method: "POST" })).status).toBe(405);
    expect((await f.request("/assets/%252e%252e/server/production.js")).status).not.toBe(200);
    expect((await f.request("/assets/missing.js")).status).toBe(404);
    expect(
      (await f.request("/assets/owned.js", { headers: { host: "foreign.example.test" } })).status,
    ).toBe(400);
    expect(
      (await f.request("/auth/session", { headers: { host: "foreign.example.test" } })).status,
    ).toBe(400);
  });
  it("rejects actual signed identity corruption with no successful session", async () => {
    const f = await fixture("auth0");
    f.invalidSignature(true);
    const failed = await f.login();
    expect(failed.response.status).toBe(400);
    expect(
      (await (await f.request("/auth/session", { headers: { cookie: failed.cookie } })).json())
        .authenticated,
    ).toBe(false);
  });
  it("isolates two app engines even when a copied encrypted cookie is supplied", async () => {
    const first = await fixture("google");
    const second = await fixture("google", "ssr", first.origin);
    expect(second.origin).toBe(first.origin);
    expect(second.env.sessionSecrets).toEqual(first.env.sessionSecrets);
    expect(second.env.listenPort).not.toBe(first.env.listenPort);
    const signed = await first.login();
    expect(
      (await (await first.request("/auth/session", { headers: { cookie: signed.cookie } })).json())
        .authenticated,
    ).toBe(true);
    expect(
      (await (await second.request("/auth/session", { headers: { cookie: signed.cookie } })).json())
        .authenticated,
    ).toBe(false);
  });
  it.each(["auth0", "google"] as const)(
    "requires explicit API consent after an identity-only %s sign-in",
    async (provider) => {
      const f = await fixture(provider);
      const signed = await f.login();
      expect(signed.response.status).toBe(303);
      const authorization = f.events.find((event) => event.kind === "authorize");
      expect(authorization).toBeTruthy();
      expect(new URL(authorization!.target).searchParams.has("audience")).toBe(false);
      expect(new URL(authorization!.target).searchParams.get("scope")?.split(" ")).not.toContain(
        f.env.api!.scopes[0],
      );
      const csrf = await (
        await f.request("/api/action-csrf", { headers: { cookie: signed.cookie } })
      ).json();
      const action = await f.request("/account", {
        method: "POST",
        headers: actionHeaders(f.origin, signed.cookie, csrf.csrfToken),
        body: Buffer.from("{}"),
      });
      expect(action.status).toBe(401);
      expect(await action.json()).toMatchObject({
        code: "interaction-required",
        reason: "consent",
        provider,
        resource: f.env.api!.resource,
        scopes: f.env.api!.scopes,
      });
      expect(f.refreshes).toBe(0);
      expect(f.events.some((event) => event.target === f.env.api!.url)).toBe(false);
    },
  );
  it("aborts an allocated refresh before a logout response can revive private state", async () => {
    const f = await fixture("google");
    const signed = await f.login("/account", f.env.api);
    const csrf = await (
      await f.request("/api/action-csrf", { headers: { cookie: signed.cookie } })
    ).json();
    f.advance(2000);
    const hold = f.holdRefresh();
    const controller = new AbortController();
    const action = f.request("/account", {
      method: "POST",
      headers: actionHeaders(f.origin, signed.cookie, csrf.csrfToken),
      body: Buffer.from("{}"),
      signal: controller.signal,
    });
    const observed = action.then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    try {
      await bounded(hold.entered, "refresh allocation");
      const logout = await bounded(
        f.request("/auth/logout", {
          method: "POST",
          headers: { cookie: signed.cookie, origin: f.origin, "content-type": "application/json" },
          body: Buffer.from("{}"),
        }),
        "logout during refresh",
      );
      expect(logout.status).toBe(204);
      await bounded(hold.aborted, "identity-owned upstream transport abort");
      const settled = await bounded(observed, "retired action settlement");
      if ("value" in settled && settled.value) {
        expect(settled.value.status).toBeGreaterThanOrEqual(400);
        const body = await settled.value.text();
        for (const canary of canaries) expect(body).not.toContain(canary);
        expect(body).not.toContain("The provider API accepted");
      } else expect("error" in settled).toBe(true);
    } finally {
      controller.abort();
      hold.release();
      await bounded(observed, "released action drain");
    }
    expect(
      (await (await f.request("/auth/session", { headers: { cookie: signed.cookie } })).json())
        .authenticated,
    ).toBe(false);
  });
});
