import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  args,
  required,
  json,
  sha256,
  childProcess,
  availablePort,
  waitTcp,
  fetchRecorded,
  run,
  guard,
  save,
} from "./common.mjs";

const routes = [
  { path: "/", file: "index.html", title: "Public operations runbooks" },
  {
    path: "/runbooks/api-recovery",
    file: "runbooks/api-recovery/index.html",
    title: "API recovery",
  },
  {
    path: "/runbooks/policy-rollback",
    file: "runbooks/policy-rollback/index.html",
    title: "Policy rollback",
  },
];
const options = args();
if (options.help) {
  console.log(
    "node ssg-runtime.mjs --stage /external/isolated/ssg --out /external/evidence/ssg --playwright-module /external/browser-toolchain/node_modules/playwright/index.mjs [--engine chromium|firefox|webkit]",
  );
} else {
  const stage = required(options, "stage");
  const out = required(options, "out");
  const playwrightPath = required(options, "playwright-module");
  const engine = options.engine ?? "chromium";
  assert.ok(["chromium", "firefox", "webkit"].includes(engine));
  await guard(out, `ssg-runtime-${engine}.json`, async () => {
    const generated = join(stage, "dist/static");
    const before = {};
    for (const route of routes) {
      const html = await readFile(join(generated, route.file), "utf8");
      assert.match(html, /<!doctype html>/i);
      assert.ok(html.includes(route.title));
      assert.match(html, /data-askr-style-registry="true"/);
      assert.match(html, /<script type="module" src="\/assets\/client\.js"/);
      before[route.path] = sha256(html);
    }
    const metadataBefore = await json(join(generated, "metadata.json"));
    assert.equal(metadataBefore.totalRoutes, 3);
    assert.equal(metadataBefore.successful, 3);
    assert.equal(metadataBefore.failed, 0);
    assert.deepEqual(
      metadataBefore.routes.map((route) => route.path).sort(),
      routes.map((route) => route.path).sort(),
    );
    const assetHashes = {};
    for (const name of ["client.js", "client.css"])
      assetHashes[name] = sha256(await readFile(join(generated, "assets", name)));
    const port = await availablePort();
    const origin = `http://127.0.0.1:${port}`;
    const server = await childProcess(process.execPath, ["serve.mjs"], {
      cwd: stage,
      out,
      label: "ssg-static-server",
      env: { PORT: String(port), HOST: "127.0.0.1" },
    });
    const wire = [];
    let browser;
    let shutdown;
    let browserEvidence;
    try {
      await waitTcp(port, server);
      for (const route of routes) {
        const response = await fetchRecorded(origin + route.path);
        assert.equal(response.status, 200);
        assert.match(response.headers["content-type"], /text\/html/);
        assert.equal(sha256(response.body), before[route.path]);
        wire.push({ path: route.path, status: response.status, sha256: sha256(response.body) });
      }
      for (const [name, expected] of Object.entries(assetHashes)) {
        const response = await fetchRecorded(`${origin}/assets/${name}`);
        assert.equal(response.status, 200);
        assert.equal(sha256(response.body), expected);
        assert.match(
          response.headers["content-type"],
          name.endsWith(".css") ? /text\/css/ : /(?:text|application)\/javascript/,
        );
        wire.push({ path: `/assets/${name}`, status: response.status, sha256: expected });
      }
      assert.equal((await fetchRecorded(origin + "/not-a-runbook")).status, 404);
      const playwrightModule = await import(pathToFileURL(playwrightPath).href);
      const playwright = playwrightModule.default ?? playwrightModule;
      browser = await playwright[engine].launch({ headless: true });
      const page = await browser.newPage();
      const pageErrors = [];
      const consoleErrors = [];
      const requestFailures = [];
      const badResponses = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("requestfailed", (request) =>
        requestFailures.push({ url: request.url(), error: request.failure()?.errorText }),
      );
      page.on("response", (response) => {
        if (response.status() >= 400 && new URL(response.url()).pathname !== "/favicon.ico")
          badResponses.push({ url: response.url(), status: response.status() });
      });
      const capture = `<script>window.__askrQualificationNodes = {
        heading: document.querySelector('#app h1'),
        step: Array.from(document.querySelectorAll('#app li')).find(n => n.textContent === 'Confirm the readiness probe is failing.'),
        button: document.querySelector('#app button[aria-pressed]'),
        readyAtCapture: document.querySelector('#app').dataset.askrReady
      };</script>`;
      await page.route(origin + "/runbooks/api-recovery", async (route) => {
        const response = await route.fetch();
        const html = await response.text();
        assert.ok(html.includes("</body>"));
        await route.fulfill({ response, body: html.replace("</body>", capture + "</body>") });
      });
      await page.goto(origin + "/runbooks/api-recovery", { waitUntil: "load" });
      // This is the app's explicit completion marker, never a fabricated Core hydration global.
      await page.locator('#app[data-askr-ready="true"]').waitFor({ timeout: 10000 });
      const identity = await page.evaluate(() => {
        const saved = window.__askrQualificationNodes;
        return {
          captured: Boolean(saved.heading && saved.step && saved.button),
          readyAtCapture: saved.readyAtCapture ?? null,
          heading: saved.heading === document.querySelector("#app h1"),
          step:
            saved.step ===
            Array.from(document.querySelectorAll("#app li")).find(
              (n) => n.textContent === "Confirm the readiness probe is failing.",
            ),
          button: saved.button === document.querySelector("#app button[aria-pressed]"),
        };
      });
      assert.deepEqual(identity, {
        captured: true,
        readyAtCapture: null,
        heading: true,
        step: true,
        button: true,
      });
      const button = page.getByRole("button", { name: "Acknowledge this runbook", exact: true });
      assert.equal(await button.getAttribute("aria-pressed"), "false");
      await button.click();
      const acknowledged = page.getByRole("button", { name: "Runbook acknowledged", exact: true });
      await acknowledged.waitFor({ timeout: 10000 });
      assert.equal(await acknowledged.getAttribute("aria-pressed"), "true");
      assert.equal(await page.getByRole("status").textContent(), "Interactive control hydrated");
      assert.equal(
        await page.evaluate(
          () =>
            window.__askrQualificationNodes.button ===
            document.querySelector("#app button[aria-pressed]"),
        ),
        true,
      );
      // One click on a fresh, unacknowledged SSR button must produce the acknowledged state.
      assert.deepEqual(pageErrors, []);
      assert.deepEqual(consoleErrors, []);
      assert.deepEqual(requestFailures, []);
      assert.deepEqual(badResponses, []);
      browserEvidence = {
        engine,
        browserVersion: browser.version(),
        playwrightModule: playwrightPath,
        identity,
        clicks: 1,
        ariaPressed: "true",
        status: "Interactive control hydrated",
        pageErrors,
        consoleErrors,
        requestFailures,
        badResponses,
      };
    } finally {
      await browser?.close();
      shutdown = await server.stop();
    }
    await save(join(out, `ssg-browser-${engine}.json`), {
      browser: browserEvidence,
      wire,
      shutdown,
    });
    // Keyless routes rerender; Core reports written:false and published HTML bytes remain identical.
    // CLI atomic publication may replace physical files without changing those bytes.
    const cliRoot = resolve(
      createRequire(join(stage, "package.json")).resolve("@askrjs/cli/package.json"),
      "..",
    );
    const cliManifest = await json(join(cliRoot, "package.json"));
    const bin = typeof cliManifest.bin === "string" ? cliManifest.bin : cliManifest.bin.askr;
    const cliEntry = resolve(cliRoot, bin);
    assert.ok(cliEntry.startsWith(cliRoot + sep));
    const incremental = await run(
      process.execPath,
      [
        cliEntry,
        "ssg",
        "--config",
        "./ssg.config.ts",
        "--output",
        "./dist/static",
        "--incremental",
      ],
      {
        cwd: stage,
        out,
        label: "ssg-installed-cli-incremental",
        timeoutMs: 120000,
      },
    );
    assert.match(incremental.stdout, /Mode:\s+incremental/);
    assert.match(incremental.stdout, /Rebuilt:\s+3 routes/);
    assert.match(incremental.stdout, /Skipped:\s+0 routes/);
    assert.match(incremental.stdout, /CacheHit:\s+3 routes/);
    const metadataAfter = await json(join(generated, "metadata.json"));
    assert.equal(metadataAfter.rebuilt, 3);
    assert.equal(metadataAfter.skipped, 0);
    assert.equal(metadataAfter.cacheHits, 3);
    assert.equal(metadataAfter.failed, 0);
    assert.equal(metadataAfter.routes.length, 3);
    for (const route of metadataAfter.routes) {
      assert.equal(route.reason, "no-keys");
      assert.equal(route.written, false);
    }
    for (const route of routes)
      assert.equal(sha256(await readFile(join(generated, route.file))), before[route.path]);
    return {
      node: process.version,
      stage,
      generatedHtml: before,
      assetHashes,
      metadataBefore,
      wire,
      browser: browserEvidence,
      shutdown,
      installedCli: {
        version: cliManifest.version,
        entry: cliEntry,
        sha256: sha256(await readFile(cliEntry)),
      },
      incremental: { command: incremental.command, metadata: metadataAfter },
    };
  });
}
