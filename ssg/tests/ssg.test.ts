import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createStaticGen } from "@askrjs/askr/ssg";
import { pageRegistry } from "../src/routes.js";
import { renderDocument } from "../src/document.js";

const outputs: string[] = [];
afterEach(async () =>
  Promise.all(outputs.splice(0).map((path) => rm(path, { recursive: true, force: true }))),
);

describe("SSG runbook reference", () => {
  it("should expand entries and atomically emit complete documents with metadata", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "askr-ssg-example-"));
    outputs.push(outputDir);
    const result = await createStaticGen({
      registry: pageRegistry,
      outputDir,
      seed: 20260714,
      document: renderDocument,
      concurrency: 1,
    }).generate();

    expect(result.failed).toBe(0);
    expect(result.routes.map((route) => route.path).sort()).toEqual([
      "/",
      "/runbooks/api-recovery",
      "/runbooks/policy-rollback",
    ]);
    const html = await readFile(join(outputDir, "runbooks/api-recovery/index.html"), "utf8");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("API recovery");
    expect(html).toContain("Acknowledge this runbook");
    expect(html).toContain('<meta name="generator" content="Askr SSG" />');
    const metadata = JSON.parse(await readFile(join(outputDir, "metadata.json"), "utf8")) as {
      totalRoutes: number;
      successful: number;
    };
    expect(metadata).toMatchObject({ totalRoutes: 3, successful: 3 });
  });
});
