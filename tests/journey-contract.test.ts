import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { renderRouteRequestToString } from "@askrjs/askr/ssr";
import { pageRegistry as spaRegistry } from "../spa/src/application/routes.js";
import { pageRegistry as ssrRegistry } from "../ssr-only/src/application/routes.js";
import { pageRegistry as platformRegistry } from "../api-ssr/src/application/routes.js";
import ssrApp from "../ssr-only/src/server/entry-server.js";
import platformApp from "../api-ssr/src/server/entry-server.js";
import basicApi from "../api-only/src/api.js";

const basePaths = ["/", "/activity", "/*"];

describe("progressive example journey contract", () => {
  it("should keep browser features behind public function-first package surfaces", async () => {
    const root = new URL("../api-ssr/src/features/", import.meta.url);
    const files = (await readdir(root, { recursive: true })).filter((file) =>
      /\.(?:ts|tsx)$/.test(file),
    );
    for (const file of files) {
      const source = await readFile(new URL(file, root), "utf8");
      expect(source, file).not.toMatch(/@askrjs\/server|(?:^|\/)server(?:\/|['"])/m);
      expect(source, file).not.toMatch(/@askrjs\/askr\/src|__askr_/);
      expect(source, file).not.toMatch(/\buse[A-Z]\w*\b|\b[A-Z]\w*Provider\b/);
      expect(source, file).not.toMatch(/\b(?:defineContext|readContext)\b|<Await\b/);
    }
  });

  it("should retain base route paths and application vocabulary at every primary stage", async () => {
    for (const registry of [spaRegistry, ssrRegistry, platformRegistry]) {
      const paths = registry.manifest.records.map((record) => record.path);
      for (const path of basePaths) expect(paths).toContain(path);
    }

    const spa = await renderRouteRequestToString({
      url: "http://example.test/",
      registry: spaRegistry,
    });
    expect(spa.kind).toBe("render");
    if (spa.kind !== "render") throw new Error("SPA registry did not render.");
    expect(spa.html).toContain("Northstar Operations");
    expect(spa.html).toContain("Everything is running smoothly.");

    const final = await platformApp.fetch(new Request("http://example.test/"));
    expect(await final.text()).toContain("Everything is running smoothly.");
  });

  it("should carry public application modules forward without a rewrite", async () => {
    for (const file of ["data.ts", "layout.tsx", "pages.tsx", "routes.tsx"]) {
      const [spa, ssr] = await Promise.all([
        readFile(new URL(`../spa/src/application/${file}`, import.meta.url), "utf8"),
        readFile(new URL(`../ssr-only/src/application/${file}`, import.meta.url), "utf8"),
      ]);
      expect(ssr).toBe(spa);
    }
    const [spaStyles, ssrStyles] = await Promise.all([
      readFile(new URL("../spa/src/styles.css", import.meta.url), "utf8"),
      readFile(new URL("../ssr-only/src/styles.css", import.meta.url), "utf8"),
    ]);
    expect(ssrStyles).toBe(spaStyles);

    for (const file of ["data.ts", "layout.tsx", "pages.tsx"]) {
      const [ssr, platform] = await Promise.all([
        readFile(new URL(`../ssr-only/src/application/${file}`, import.meta.url), "utf8"),
        readFile(new URL(`../api-ssr/src/application/${file}`, import.meta.url), "utf8"),
      ]);
      expect(platform).toBe(ssr);
    }
    const platformStyles = await readFile(
      new URL("../api-ssr/src/styles.css", import.meta.url),
      "utf8",
    );
    expect(platformStyles).toBe(ssrStyles);
  });

  it("should render the same base SPA content through SSR before hydration", async () => {
    const spa = await renderRouteRequestToString({
      url: "http://example.test/",
      registry: spaRegistry,
    });
    if (spa.kind !== "render") throw new Error("SPA registry did not render.");
    const response = await ssrApp.fetch(new Request("http://example.test/"));
    expect(await response.text()).toBe(spa.html);
  });

  it("should keep API-only routes as a subset of the final platform API", () => {
    const basicPaths = Object.keys(basicApi.toOpenApiDocument().paths);
    const finalPaths = Object.keys(platformApp.toOpenApiDocument().paths);
    expect(basicPaths.every((path) => finalPaths.includes(path))).toBe(true);
    expect(finalPaths).toContain("/api/session");
    expect(finalPaths).toContain("/api/dashboard");
    expect(finalPaths).toContain("/api/policies/{id}");
    expect(finalPaths).not.toContain("/api/*");
  });

  it("should keep common-path server entries on the application composer", async () => {
    for (const file of [
      "../ssr-only/src/app.ts",
      "../api-ssr/src/app.ts",
    ]) {
      const source = await readFile(new URL(file, import.meta.url), "utf8");
      expect(source, file).toContain("createAskrApp");
      expect(source, file).not.toMatch(/createServerApp|createAskrPageHandler/);
    }
  });
});
