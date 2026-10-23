import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { publicAssets } from "../src/server/https.js";
describe("finite public asset boundary", () => {
  it("admits only regular public assets and never exposes source maps", async () => {
    const root = await mkdtemp(join(tmpdir(), "askr-assets-"));
    try {
      await mkdir(join(root, "nested"));
      await writeFile(join(root, "nested", "雪 file.js"), "export {};");
      await writeFile(join(root, "private.map"), "PRIVATE_CANARY");
      const assets = await publicAssets(root);
      expect([...assets.keys()]).toEqual(["/assets/nested/%E9%9B%AA%20file.js"]);
      expect(assets.get("/assets/nested/%E9%9B%AA%20file.js")?.type).toBe(
        "text/javascript; charset=utf-8",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("rejects file and directory symlinks at startup", async () => {
    const root = await mkdtemp(join(tmpdir(), "askr-assets-"));
    try {
      await mkdir(join(root, "public"));
      await writeFile(join(root, "outside.js"), "private");
      await symlink(join(root, "outside.js"), join(root, "public", "escape.js"));
      await expect(publicAssets(join(root, "public"))).rejects.toThrow("symlinks");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("refuses server/TLS/unknown file types", async () => {
    const root = await mkdtemp(join(tmpdir(), "askr-assets-"));
    try {
      await writeFile(join(root, "private.pem"), "private");
      await expect(publicAssets(root)).rejects.toThrow("Unsupported");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
