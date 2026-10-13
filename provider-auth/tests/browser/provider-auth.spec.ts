import { readFile, readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { test as base, expect } from "@playwright/test";
import { createLoopbackProxy } from "./loopback-proxy.js";
import type {
  BrowserContext,
  Page,
  ElementHandle,
  Request as BrowserRequest,
} from "@playwright/test";
import {
  signedProviderFixture,
  bounded,
  canaries,
  type FixtureOwners,
} from "../signed-provider.js";
import type { ProviderName } from "../../src/public-config.js";

const test = base.extend<{ browserWire: Awaited<ReturnType<typeof createLoopbackProxy>> }>({
  // Playwright discovers fixture dependencies through this required object pattern.
  // eslint-disable-next-line no-empty-pattern
  browserWire: async ({}, use) => {
    const proxy = await createLoopbackProxy();
    try {
      await use(proxy);
    } finally {
      await proxy.close();
    }
  },
  proxy: async ({ browserWire }, use) => use({ server: browserWire.url }),
  // This context can reach only the owned CONNECT listeners. Their ephemeral
  // fixture CA is not installed in OS/browser trust. Node's pinned CA remains strict.
  ignoreHTTPSErrors: true,
});

async function bundleText(directory: string): Promise<string> {
  let result = "";
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result += await bundleText(path);
    else if (entry.name.endsWith(".js") || entry.name.endsWith(".css"))
      result += await readFile(path, "utf8");
  }
  return result;
}
async function start(
  context: BrowserContext,
  provider: ProviderName,
  mode: "ssr" | "spa",
  browserWire: Awaited<ReturnType<typeof createLoopbackProxy>>,
  invalidBoot = false,
) {
  const imported: unknown = await import(
    pathToFileURL(join(process.cwd(), "dist/fixture/app-host.js")).href
  );
  if (
    !imported ||
    typeof imported !== "object" ||
    !("createExampleApp" in imported) ||
    !("withApplicationLifecycle" in imported) ||
    !("startHttps" in imported) ||
    !("createDocumentApp" in imported)
  )
    throw new Error("Build the actual fixture owner entry before browser acceptance");
  // Runtime shape validation is a dynamic built-module boundary, not a producer API cast.
  if (
    typeof imported.createExampleApp !== "function" ||
    typeof imported.withApplicationLifecycle !== "function" ||
    typeof imported.startHttps !== "function" ||
    typeof imported.createDocumentApp !== "function"
  )
    throw new Error("Invalid built fixture owner entry");
  const built = imported as FixtureOwners;
  const owners: FixtureOwners = invalidBoot
    ? {
        ...built,
        withApplicationLifecycle(...args) {
          const app = built.withApplicationLifecycle(...args);
          return {
            ...app,
            async fetch(request) {
              const response = await app.fetch(request);
              if (!response.headers.get("content-type")?.startsWith("text/html")) return response;
              const headers = new Headers(response.headers);
              headers.delete("content-length");
              return new Response(
                (await response.text()).replace(
                  'name="askr-example-provider" content="google"',
                  'name="askr-example-provider" content="foreign"',
                ),
                { status: response.status, statusText: response.statusText, headers },
              );
            },
          };
        },
      }
    : built;
  const document = await readFile(join(process.cwd(), "dist/index.html"), "utf8");
  const client = await bundleText(join(process.cwd(), "dist/assets"));
  for (const canary of [
    ...canaries,
    "OWNED_ACTION_CSRF_SECRET",
    "BEGIN PRIVATE KEY",
    "client_secret",
    "privateKeyPath",
  ])
    expect(client).not.toContain(canary);
  const f = await signedProviderFixture(
    provider,
    mode,
    owners,
    document,
    join(process.cwd(), "dist/assets"),
    "https://app.example.test",
    true,
  );
  browserWire.bind(f.browserDestinations);
  try {
    for (const secret of f.secrets()) expect(client).not.toContain(secret);
    const sessionGets: string[] = [];
    const actionRequests: string[] = [];
    const unauthorizedPrivateRequests = new Set<BrowserRequest>();
    const browserErrors: string[] = [];
    const consoleMessages: string[] = [];
    let scriptGate: Promise<void> | undefined;
    let releaseScripts: (() => void) | undefined;
    let privateHold:
      | {
          entered: Promise<void>;
          enter(): void;
          release(): void;
          released: Promise<void>;
          request?: BrowserRequest;
          expectedCancellation: boolean;
          cancelled: Promise<void>;
          cancel(): void;
        }
      | undefined;
    context.on("response", (response) => {
      const url = new URL(response.url());
      if (response.status() === 401 && url.origin === f.origin && url.pathname === "/api/private")
        unauthorizedPrivateRequests.add(response.request());
    });
    context.on("requestfailed", (request) => {
      if (privateHold?.request === request && privateHold.expectedCancellation)
        privateHold.cancel();
      // Retirement aborts the exact request whose 401 exposed the expired session.
      else if (unauthorizedPrivateRequests.delete(request)) return;
      else browserErrors.push(`Unexpected browser request failure: ${request.url()}`);
    });
    function observe(page: Page) {
      page.on("pageerror", (error) => browserErrors.push(error.message));
      page.on("console", (message) => consoleMessages.push(message.text()));
    }
    context.on("page", observe);
    for (const page of context.pages()) observe(page);
    context.on("request", (request) => {
      const url = new URL(request.url());
      if (!["data:", "about:"].includes(url.protocol))
        try {
          f.assertBrowserDestination(request.url());
        } catch (error) {
          browserErrors.push(error instanceof Error ? error.message : String(error));
        }
      if (url.origin === f.origin && url.pathname === "/auth/session" && request.method() === "GET")
        sessionGets.push(request.url());
      if (
        url.origin === f.origin &&
        request.method() === "POST" &&
        request.headers()["x-askr-action"] === "provider.read-summary"
      )
        actionRequests.push(request.url());
    });
    await context.route(
      (url) =>
        url.origin === f.origin &&
        (url.pathname === "/api/private" ||
          (url.pathname.startsWith("/assets/") && url.pathname.endsWith(".js"))),
      async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.protocol === "data:" || url.protocol === "about:") return route.continue();
        if (
          scriptGate &&
          url.origin === f.origin &&
          url.pathname.startsWith("/assets/") &&
          url.pathname.endsWith(".js")
        )
          await scriptGate;
        const held =
          privateHold && url.origin === f.origin && url.pathname === "/api/private"
            ? privateHold
            : undefined;
        if (held) {
          if (held.request) throw new Error("Only one private request may own this barrier");
          held.request = request;
          held.enter();
          await held.released;
        }
        if (held?.expectedCancellation) {
          await route.abort("aborted").catch(() => undefined);
          return;
        }
        try {
          f.assertBrowserDestination(request.url());
          await route.continue();
        } catch (error) {
          if (held?.expectedCancellation && held.request === request) {
            await route.abort("aborted").catch(() => undefined);
          } else {
            browserErrors.push(error instanceof Error ? error.message : String(error));
            await route.abort("failed").catch(() => undefined);
          }
        }
      },
    );
    return {
      f,
      sessionGets,
      actionRequests,
      browserErrors,
      consoleMessages,
      blockScripts() {
        if (releaseScripts) throw new Error("Previous script barrier is still owned");
        scriptGate = new Promise<void>((resolve) => {
          releaseScripts = resolve;
        });
      },
      releaseScripts() {
        releaseScripts?.();
        releaseScripts = undefined;
        scriptGate = undefined;
      },
      holdPrivate() {
        let cancel!: () => void;
        const cancelled = new Promise<void>((resolve) => {
          cancel = resolve;
        });
        let enter!: () => void;
        let release!: () => void;
        const entered = new Promise<void>((resolve) => {
          enter = resolve;
        });
        const released = new Promise<void>((resolve) => {
          release = resolve;
        });
        const hold = {
          entered,
          enter,
          released,
          cancelled,
          cancel,
          expectedCancellation: false,
          expectCancellation() {
            hold.expectedCancellation = true;
          },
          release: () => {
            release();
          },
        };
        privateHold = hold;
        return hold;
      },
      async close() {
        releaseScripts?.();
        privateHold?.release();
        const cleanupFailures: unknown[] = [];
        try {
          await bounded(context.unrouteAll({ behavior: "wait" }), "browser route drain");
        } catch (error) {
          cleanupFailures.push(error);
        }
        try {
          await browserWire.close();
        } catch (error) {
          cleanupFailures.push(error);
        }
        try {
          await f.close();
        } catch (error) {
          cleanupFailures.push(error);
        }
        if (cleanupFailures.length)
          throw new AggregateError(cleanupFailures, "Browser fixture cleanup failed");
        for (const canary of [...canaries, ...f.secrets()])
          expect(consoleMessages.join("\n")).not.toContain(canary);
        expect(
          f.events
            .filter((event) => event.kind === "browser_authorize_redirect")
            .map((event) => event.target),
        ).toEqual(
          f.events.filter((event) => event.kind === "authorize").map((event) => event.target),
        );
        if (invalidBoot)
          expect(browserErrors).toEqual(["Invalid provider application boot configuration"]);
        else expect(browserErrors).toEqual([]);
      },
    };
  } catch (error) {
    await f.close();
    throw error;
  }
}
async function ready(page: Page) {
  await expect(page.locator("#app")).toHaveAttribute("data-askr-ready", "true");
}
async function completeProvider(page: Page) {
  await page.waitForURL((url) => url.pathname === "/__fixture/authorize", {
    waitUntil: "domcontentloaded",
  });
  await page.locator("#provider-continue").click({ noWaitAfter: true });
  await page.waitForURL((url) => url.origin === "https://provider.example-provider.test", {
    waitUntil: "domcontentloaded",
  });
  await page.locator("#continue").click({ noWaitAfter: true });
}
async function completeLogin(page: Page, origin: string) {
  const target = page.waitForURL(
    (url) => url.origin === origin && url.pathname.startsWith("/account"),
    { waitUntil: "commit" },
  );
  void target.catch(() => undefined);
  const click = page.getByTestId("sign-in").click({ noWaitAfter: true });
  void click.catch(() => undefined);
  await completeProvider(page);
  await target;
  await click;
}
async function completeApiConsent(page: Page, owned: Awaited<ReturnType<typeof start>>) {
  const { f } = owned;
  const actionCount = owned.actionRequests.length;
  const authorizationCount = f.events.filter((event) => event.kind === "authorize").length;
  const returned = page.waitForEvent("framenavigated", {
    predicate: (frame) =>
      frame === page.mainFrame() &&
      new URL(frame.url()).origin === f.origin &&
      new URL(frame.url()).pathname.startsWith("/account"),
  });
  const callback = page.waitForResponse(
    (response) =>
      new URL(response.url()).origin === f.origin &&
      new URL(response.url()).pathname === `/auth/callback/${f.provider}` &&
      response.request().isNavigationRequest(),
  );
  void returned.catch(() => undefined);
  void callback.catch(() => undefined);
  const click = page.getByTestId("provider-action").click({ noWaitAfter: true });
  void click.catch(() => undefined);
  await completeProvider(page);
  const [, response] = await bounded(
    Promise.all([returned, callback, click]),
    "explicit API consent return",
  );
  expect(response.status()).toBe(303);
  await ready(page);
  expect(f.events.filter((event) => event.kind === "authorize").length).toBe(
    authorizationCount + 1,
  );
  const authorization = f.events.filter((event) => event.kind === "authorize").at(-1);
  const parameters = new URL(authorization!.target).searchParams;
  if (f.provider === "auth0") expect(parameters.get("audience")).toBe(f.env.api!.resource);
  else {
    expect(parameters.has("audience")).toBe(false);
    expect(parameters.has("resource")).toBe(false);
  }
  expect(parameters.get("scope")?.split(" ")).toContain(f.env.api!.scopes[0]);
  expect(owned.actionRequests.length).toBe(actionCount + 1);
  await expect(page.getByTestId("provider-result")).toHaveCount(0);
  // Consent grants the permission; it never resubmits the original action.
  expect(f.events.some((event) => event.target === f.env.api!.url)).toBe(false);
}
for (const provider of ["auth0", "microsoft", "google", "apple"] as const)
  for (const mode of ["ssr", "spa"] as const) {
    test(`${provider} ${mode}: signed native login, exact boot, private retirement and reload`, async ({
      page,
      context,
      browserWire,
    }) => {
      const owned = await start(context, provider, mode, browserWire);
      const { f } = owned;
      try {
        await page.goto(
          `${f.origin}/login?next=${encodeURIComponent("/account/details?view=full#panel")}`,
        );
        await ready(page);
        expect(owned.sessionGets.length).toBe(mode === "spa" ? 1 : 0);
        owned.blockScripts();
        await completeLogin(page, f.origin);
        let heading: ElementHandle<SVGElement | HTMLElement> | null = null;
        if (mode === "ssr") {
          await expect(page.getByRole("heading", { name: "Private account" })).toBeVisible();
          heading = await page.getByRole("heading", { name: "Private account" }).elementHandle();
        } else expect(await page.locator("#app").innerHTML()).toBe("");
        owned.releaseScripts();
        await ready(page);
        if (provider === "google")
          expect(
            new URL(f.events.find((event) => event.kind === "authorize")!.target).searchParams
              .get("scope")
              ?.split(" "),
          ).not.toContain(f.env.api!.scopes[0]);
        if (heading)
          expect(await heading.evaluate((node) => node === document.querySelector("h1"))).toBe(
            true,
          );
        expect(page.url()).toContain("/account/details?view=full#panel");
        expect(owned.sessionGets.length).toBe(mode === "spa" ? 2 : 0);
        await expect(page.getByTestId("private-query")).toContainText("Private query belongs");
        const before = owned.sessionGets.length;
        await page.getByRole("link", { name: "Account overview", exact: true }).click();
        await ready(page);
        expect(owned.sessionGets.length).toBe(before);
        if (provider === "auth0" || provider === "google") await completeApiConsent(page, owned);
        const actionCount = owned.actionRequests.length;
        await page.getByTestId("provider-action").click();
        await expect(page.getByTestId("provider-result")).toBeVisible();
        expect(owned.actionRequests.length).toBe(actionCount + 1);
        if (provider !== "apple")
          expect(f.events.filter((event) => event.target === f.env.api!.url)).toHaveLength(1);
        const privateBody = await page.locator("body").innerText();
        expect(privateBody).not.toMatch(/MOCK_.*PRIVATE_CANARY/u);
        for (const secret of f.secrets()) expect(privateBody).not.toContain(secret);
        if (provider === "apple") {
          const callback = f.events.find((event) => event.kind === "authorization_code");
          expect(callback).toBeTruthy();
          const browserCookie = await context.cookies(f.origin);
          expect(
            browserCookie.some(
              (cookie) =>
                cookie.name === "__Host-askr-session" &&
                cookie.secure &&
                cookie.httpOnly &&
                cookie.sameSite === "Lax",
            ),
          ).toBe(true);
        }
        // A new private query is held before HTTP. Local logout must retire DOM without waiting for it.
        const hold = owned.holdPrivate();
        const refresh = page.getByTestId("reload-private").click();
        void refresh.catch(() => undefined);
        try {
          await bounded(hold.entered, "private request barrier");
          hold.expectCancellation();
          await page.getByTestId("logout").click();
          await expect(page.getByTestId("private-owner")).toHaveCount(0);
          await bounded(hold.cancelled, "exact held request cancellation");
        } finally {
          hold.release();
          await bounded(refresh, "refresh click drain");
        }
        await expect(page).toHaveURL(/\/login\?next=/u);
        await page.reload();
        await ready(page);
        await expect(page.getByTestId("private-owner")).toHaveCount(0);
        const direct = await f.request("/auth/session", {
          headers: {
            cookie: (await context.cookies(f.origin))
              .map((cookie) => `${cookie.name}=${cookie.value}`)
              .join("; "),
          },
        });
        expect((await direct.json()).authenticated).toBe(false);
      } finally {
        owned.releaseScripts();
        await owned.close();
      }
    });
    test(`${provider} ${mode}: copied callback, safe errors, expiry and provider consent`, async ({
      page,
      context,
      browserWire,
    }) => {
      const owned = await start(context, provider, mode, browserWire);
      const { f } = owned;
      try {
        const callbackRequest = page.waitForRequest(
          (request) => new URL(request.url()).pathname === `/auth/callback/${provider}`,
        );
        void callbackRequest.catch(() => undefined);
        await page.goto(`${f.origin}/login?next=${encodeURIComponent("//foreign.example.test")}`);
        await ready(page);
        await completeLogin(page, f.origin);
        await ready(page);
        if (provider === "google")
          expect(
            new URL(f.events.find((event) => event.kind === "authorize")!.target).searchParams
              .get("scope")
              ?.split(" "),
          ).not.toContain(f.env.api!.scopes[0]);
        expect(new URL(page.url()).pathname).toBe("/account");
        const actual = await bounded(callbackRequest, "actual callback request");
        // The HTTPS owner records the headers actually received on the wire.
        // WebKit omits cross-site Cookie from its automation request metadata.
        const callback = f.callbackRequests.at(-1)!;
        expect(callback).toBeTruthy();
        expect(callback.url).toBe(actual.url());
        expect(callback.method).toBe(actual.method());
        expect(Buffer.from(callback.body ?? [])).toEqual(
          actual.postDataBuffer() ?? Buffer.alloc(0),
        );
        if (provider === "apple") {
          expect(callback.method).toBe("POST");
          expect(callback.headers.cookie ?? "").toContain("__Host-askr-txn-apple=");
          expect(callback.headers.cookie ?? "").not.toContain("__Host-askr-session=");
        }
        const exchanges = f.exchanges;
        const replay = await f.request(callback.url, {
          method: callback.method,
          headers: callback.headers,
          body: callback.body,
        });
        expect(replay.status).toBe(400);
        expect(f.exchanges).toBe(exchanges);
        if (provider !== "apple") {
          if (provider === "auth0" || provider === "google") await completeApiConsent(page, owned);
          f.advance(2000);
          f.refreshFailure("consent_required");
          const authorizations = f.events.filter((event) => event.kind === "authorize").length;
          const navigation = page.waitForEvent("framenavigated", {
            predicate: (frame) =>
              frame === page.mainFrame() && new URL(frame.url()).origin === f.origin,
          });
          void navigation.catch(() => undefined);
          await page.getByTestId("provider-action").click({ noWaitAfter: true });
          await completeProvider(page);
          await expect
            .poll(() => f.events.filter((event) => event.kind === "authorize").length)
            .toBeGreaterThan(authorizations);
          await navigation;
          await ready(page);
          f.refreshFailure(undefined);
          const authorization = f.events.filter((event) => event.kind === "authorize").at(-1);
          expect(authorization).toBeTruthy();
          const consent = new URL(authorization!.target);
          expect(consent.searchParams.get("scope")).toContain(
            provider === "microsoft"
              ? "https://graph.microsoft.com/User.Read"
              : provider === "google"
                ? "calendar.calendarlist.readonly"
                : "read:summary",
          );
          expect(f.refreshes).toBe(1); // There is no automatic refresh retry.
        }
        f.advance(8 * 60 * 60 * 1000);
        await page.getByTestId("reload-private").click();
        await expect(page.getByTestId("private-owner")).toHaveCount(0);
        await expect(page).toHaveURL(/\/login\?next=/u);
        expect(new URL(page.url()).searchParams.get("next")).toBe("/account");
        await page.reload();
        await ready(page);
        await expect(page.getByTestId("private-owner")).toHaveCount(0);
        await expect(page).toHaveURL(/\/login\?next=/u);
      } finally {
        await owned.close();
      }
    });
  }

for (const mode of ["ssr", "spa"] as const)
  test(`invalid ${mode} boot configuration clears the still-unowned private root`, async ({
    page,
    context,
    browserWire,
  }) => {
    const owned = await start(context, "google", mode, browserWire, true);
    try {
      const signed = await owned.f.login();
      const cookies = signed.cookie.split("; ").map((value) => {
        const index = value.indexOf("=");
        return {
          name: value.slice(0, index),
          value: value.slice(index + 1),
          url: owned.f.origin,
          secure: true,
          httpOnly: true,
          sameSite: "Lax" as const,
        };
      });
      await context.addCookies(cookies);
      await page.goto(`${owned.f.origin}/account`);
      await expect.poll(() => owned.browserErrors.length).toBe(1);
      await expect(page.locator("#app")).toBeEmpty();
      expect(owned.sessionGets).toEqual([]);
    } finally {
      await owned.close();
    }
  });
