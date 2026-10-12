import { readFile, readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
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
  const owners = imported as FixtureOwners;
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
  );
  try {
    for (const secret of f.secrets()) expect(client).not.toContain(secret);
    const sessionGets: string[] = [];
    const actionRequests: string[] = [];
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
    context.on("requestfailed", (request) => {
      if (privateHold?.request === request && privateHold.expectedCancellation)
        privateHold.cancel();
      else browserErrors.push(`Unexpected browser request failure: ${request.url()}`);
    });
    function observe(page: Page) {
      page.on("pageerror", (error) => browserErrors.push(error.message));
      page.on("console", (message) => consoleMessages.push(message.text()));
    }
    context.on("page", observe);
    for (const page of context.pages()) observe(page);
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.protocol === "data:" || url.protocol === "about:") return route.continue();
      if (url.origin === f.origin && url.pathname === "/auth/session" && request.method() === "GET")
        sessionGets.push(request.url());
      if (
        url.origin === f.origin &&
        request.method() === "POST" &&
        request.headers()["x-askr-action"] === "provider.read-summary"
      )
        actionRequests.push(request.url());
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
        const response = await f.browserResponse(request.url(), {
          method: request.method(),
          headers: await request.allHeaders(),
          body: request.postDataBuffer() ?? undefined,
        });
        const headers = Object.fromEntries(response.headers);
        const cookies = response.headers.getSetCookie();
        if (cookies.length) headers["set-cookie"] = cookies.join("\n");
        delete headers["transfer-encoding"];
        delete headers.connection;
        delete headers["content-length"];
        let body = Buffer.from(await response.arrayBuffer());
        if (
          invalidBoot &&
          url.origin === f.origin &&
          headers["content-type"]?.startsWith("text/html")
        )
          body = Buffer.from(
            body
              .toString()
              .replace(
                'name="askr-example-provider" content="google"',
                'name="askr-example-provider" content="foreign"',
              ),
          );
        await route.fulfill({ status: response.status, headers, body });
      } catch (error) {
        if (held?.expectedCancellation && held.request === request) {
          await route.abort("aborted").catch(() => undefined);
        } else {
          browserErrors.push(error instanceof Error ? error.message : String(error));
          await route.abort("failed").catch(() => undefined);
        }
      }
    });
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
          await f.close();
        } catch (error) {
          cleanupFailures.push(error);
        }
        if (cleanupFailures.length)
          throw new AggregateError(cleanupFailures, "Browser fixture cleanup failed");
        for (const canary of [...canaries, ...f.secrets()])
          expect(consoleMessages.join("\n")).not.toContain(canary);
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
async function completeLogin(page: Page, provider: ProviderName, origin: string) {
  const target = page.waitForURL(
    (url) => url.origin === origin && url.pathname.startsWith("/account"),
    { waitUntil: "commit" },
  );
  void target.catch(() => undefined);
  const click = page.getByTestId("sign-in").click({ noWaitAfter: true });
  void click.catch(() => undefined);
  if (provider === "apple") {
    await page.waitForURL((url) => url.origin === "https://appleid.apple.com", {
      waitUntil: "domcontentloaded",
    });
    await page.locator("#continue").click({ noWaitAfter: true });
  }
  await target;
  await click;
}
async function completeAuth0Consent(page: Page, owned: Awaited<ReturnType<typeof start>>) {
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
      new URL(response.url()).pathname === "/auth/callback/auth0" &&
      response.request().isNavigationRequest(),
  );
  void returned.catch(() => undefined);
  void callback.catch(() => undefined);
  const click = page.getByTestId("provider-action").click({ noWaitAfter: true });
  void click.catch(() => undefined);
  const [, response] = await bounded(
    Promise.all([returned, callback, click]),
    "Auth0 explicit consent return",
  );
  expect(response.status()).toBe(303);
  await ready(page);
  expect(f.events.filter((event) => event.kind === "authorize").length).toBe(
    authorizationCount + 1,
  );
  const authorization = f.events.filter((event) => event.kind === "authorize").at(-1);
  expect(new URL(authorization!.target).searchParams.get("audience")).toBe(f.env.api!.resource);
  expect(new URL(authorization!.target).searchParams.get("scope")?.split(" ")).toContain(
    "read:summary",
  );
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
    }) => {
      const owned = await start(context, provider, mode);
      const { f } = owned;
      try {
        await page.goto(
          `${f.origin}/login?next=${encodeURIComponent("/account/details?view=full#panel")}`,
        );
        await ready(page);
        expect(owned.sessionGets.length).toBe(mode === "spa" ? 1 : 0);
        owned.blockScripts();
        await completeLogin(page, provider, f.origin);
        let heading: ElementHandle<SVGElement | HTMLElement> | null = null;
        if (mode === "ssr") {
          await expect(page.getByRole("heading", { name: "Private account" })).toBeVisible();
          heading = await page.getByRole("heading", { name: "Private account" }).elementHandle();
        } else expect(await page.locator("#app").innerHTML()).toBe("");
        owned.releaseScripts();
        await ready(page);
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
        if (provider === "auth0") await completeAuth0Consent(page, owned);
        const actionCount = owned.actionRequests.length;
        await page.getByTestId("provider-action").click();
        await expect(page.getByTestId("provider-result")).toBeVisible();
        expect(owned.actionRequests.length).toBe(actionCount + 1);
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
    }) => {
      const owned = await start(context, provider, mode);
      const { f } = owned;
      try {
        const callbackRequest = page.waitForRequest(
          (request) => new URL(request.url()).pathname === `/auth/callback/${provider}`,
        );
        void callbackRequest.catch(() => undefined);
        await page.goto(`${f.origin}/login?next=${encodeURIComponent("//foreign.example.test")}`);
        await ready(page);
        await completeLogin(page, provider, f.origin);
        await ready(page);
        expect(new URL(page.url()).pathname).toBe("/account");
        const actual = await bounded(callbackRequest, "actual callback request");
        const callback = {
          url: actual.url(),
          method: actual.method(),
          headers: await actual.allHeaders(),
          body: actual.postDataBuffer() ?? undefined,
        };
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
          if (provider === "auth0") await completeAuth0Consent(page, owned);
          f.advance(2000);
          f.refreshFailure("consent_required");
          const authorizations = f.events.filter((event) => event.kind === "authorize").length;
          const navigation = page.waitForEvent("framenavigated", {
            predicate: (frame) =>
              frame === page.mainFrame() && new URL(frame.url()).origin === f.origin,
          });
          void navigation.catch(() => undefined);
          await page.getByTestId("provider-action").click({ noWaitAfter: true });
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
  }) => {
    const owned = await start(context, "google", mode, true);
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
