import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { realpath, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createAuth0Provider } from "@askrjs/auth/providers/auth0";
import { createMicrosoftProvider } from "@askrjs/auth/providers/microsoft";
import { createGoogleProvider } from "@askrjs/auth/providers/google";
import { createAppleProvider } from "@askrjs/auth/providers/apple";
import { createProviderSession } from "@askrjs/auth/server";
import { createDocumentApp } from "@askrjs/vite/server";
const require = createRequire(import.meta.url);
const surfaces = [
  ["@askrjs/auth/providers/auth0", "createAuth0Provider", createAuth0Provider],
  ["@askrjs/auth/providers/microsoft", "createMicrosoftProvider", createMicrosoftProvider],
  ["@askrjs/auth/providers/google", "createGoogleProvider", createGoogleProvider],
  ["@askrjs/auth/providers/apple", "createAppleProvider", createAppleProvider],
  ["@askrjs/auth/server", "createProviderSession", createProviderSession],
  ["@askrjs/vite/server", "createDocumentApp", createDocumentApp],
];
const resolved = [];
for (const [specifier, name, value] of surfaces) {
  assert.equal(typeof value, "function");
  const url = import.meta.resolve(specifier);
  const physical = await realpath(fileURLToPath(url));
  assert.match(physical, /node_modules[/\\]@askrjs[/\\]/u);
  assert.equal((await import(url))[name], value, `Native ESM identity: ${specifier}`);
  resolved.push({ specifier, export: name, url, physical });
}
const sdks = [
  "@auth0/auth0-spa-js",
  "@azure/msal-browser",
  "@azure/msal-node",
  "google-auth-library",
  "passport",
  "openid-client",
];
for (const name of sdks) {
  assert.throws(() => require.resolve(name), `No CommonJS SDK resolution: ${name}`);
  assert.throws(() => import.meta.resolve(name), `No ESM SDK resolution: ${name}`);
}
let directory = fileURLToPath(new URL("../", import.meta.url));
let lock;
let lockPath;
while (!lock) {
  lockPath = join(directory, "package-lock.json");
  try {
    lock = await readFile(lockPath);
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT")
      throw error;
    const parent = dirname(directory);
    assert.notEqual(parent, directory, "Native consumer requires its ordinary generated lock");
    directory = parent;
  }
}
const records = JSON.parse(lock).packages;
for (const location of Object.keys(records))
  for (const name of sdks)
    assert.ok(
      !location.endsWith(`node_modules/${name}`),
      `No installed SDK lock record: ${location}`,
    );
const lockSha256 = createHash("sha256").update(lock).digest("hex");
for (const specifier of ["@askrjs/auth/browser", "@askrjs/auth/auth0"])
  assert.throws(() => import.meta.resolve(specifier), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
const manifests = [];
for (const name of ["askr", "auth", "node", "schema", "server", "vite"]) {
  const path = require.resolve(`@askrjs/${name}/package.json`);
  const manifest = JSON.parse(await readFile(path, "utf8"));
  manifests.push({ name: manifest.name, version: manifest.version, path: await realpath(path) });
}
console.log(
  JSON.stringify(
    {
      node: process.version,
      resolved,
      manifests,
      lock: { path: lockPath, sha256: lockSha256 },
      sdkAbsent: true,
      retiredBrowserPathsDenied: true,
    },
    null,
    2,
  ),
);
