import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("candidate qualification rejects a wrong archive SHA256 before invoking npm install", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "askr-archive-preflight-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bytes = Buffer.from("owned candidate archive bytes");
  const server = createServer((_request, response) => response.end(bytes));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const source = join(directory, "source");
  await mkdir(join(source, "api-only"), { recursive: true });
  await writeFile(
    join(source, "api-only/package.json"),
    JSON.stringify({
      packageManager: "npm@12.0.1",
      dependencies: { "@askrjs/askr": ">=0.5.0 <0.6.0" },
    }),
  );
  const packages = Object.fromEntries(
    [
      "askr",
      "auth",
      "charts",
      "cli",
      "fetch",
      "i18n",
      "logos",
      "lucide",
      "monaco",
      "node",
      "orm",
      "otel",
      "schema",
      "server",
      "testing",
      "themes",
      "ui",
      "vite",
    ].map((name) => [
      `@askrjs/${name}`,
      {
        version: "0.5.0",
        sourceCommit: "e".repeat(40),
        integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
        tarballSha256: createHash("sha256").update(bytes).digest("hex"),
      },
    ]),
  );
  packages["@askrjs/askr"].tarballSha256 = "0".repeat(64);
  const inventory = join(directory, "inventory.json");
  await writeFile(inventory, JSON.stringify({ schemaVersion: 1, version: "0.5.0", packages }));
  const installMarker = join(directory, "install-was-invoked");
  const npmCli = join(directory, "npm.mjs");
  await writeFile(
    npmCli,
    `import { writeFileSync } from "node:fs";\nif (process.argv[2] === "--version") console.log("12.0.1");\nelse { writeFileSync(${JSON.stringify(installMarker)}, "invoked"); process.exitCode = 1; }\n`,
  );
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(new URL("../../scripts/qualification/independent-stages.mjs", import.meta.url)),
      "--source",
      source,
      "--out",
      join(directory, "out"),
      "--inventory",
      inventory,
      "--registry",
      `http://127.0.0.1:${server.address().port}/`,
      "--npm-cli",
      npmCli,
      "--stages",
      "api-only",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  const timer = setTimeout(() => child.kill("SIGKILL"), 10_000);
  t.after(() => clearTimeout(timer));
  t.after(() => child.kill());
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdout.resume();
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  assert.equal(code, 1);
  assert.match(stderr, /archive SHA256 mismatch: @askrjs\/askr/);
  await assert.rejects(readFile(installMarker), { code: "ENOENT" });
  const receipt = JSON.parse(await readFile(join(directory, "out/independent-stages.json")));
  assert.equal(receipt.status, "failed");
  assert.match(receipt.error, /archive SHA256 mismatch/);
});
