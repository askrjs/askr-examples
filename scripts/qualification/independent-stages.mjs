import assert from "node:assert/strict";
import { cp, lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { args, required, json, sha256, save, run, guard } from "./common.mjs";

const BASELINE_STAGES = ["spa", "ssr-only", "api-ssr", "api-only", "ssg", "mcp-server"];
const ALL_STAGES = [...BASELINE_STAGES, "provider-auth"];
const ALL_PACKAGES = [
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
].map((name) => `@askrjs/${name}`);
const excluded = new Set([
  ".git",
  ".DS_Store",
  "node_modules",
  "dist",
  ".askr",
  "coverage",
  "playwright-report",
  "test-results",
]);
const helperRoot = dirname(fileURLToPath(import.meta.url));

async function copyStage(source, destination) {
  await cp(source, destination, {
    recursive: true,
    errorOnExist: true,
    force: false,
    filter: (path) => !excluded.has(basename(path)),
  });
}
function declaredAskr(manifest) {
  const result = [];
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    for (const [name, spec] of Object.entries(manifest[field] ?? {}))
      if (name.startsWith("@askrjs/")) result.push({ field, name, spec });
  }
  return result;
}
async function verifyInstall(root, inventory, baseline) {
  const lockPath = join(root, "package-lock.json");
  const lockBytes = await readFile(lockPath);
  const lock = JSON.parse(lockBytes);
  assert.equal(lock.lockfileVersion, 3);
  const installed = [];
  const rootReal = await realpath(root);
  for (const [location, record] of Object.entries(lock.packages)) {
    const match = location.match(/(?:^|\/)node_modules\/(@askrjs\/[^/]+)$/);
    if (!match) continue;
    const name = match[1];
    const candidate = inventory?.packages[name];
    if (baseline) {
      assert.match(record.version, /^0\.4\./, `baseline must use published 0.4 packages: ${name}`);
      assert.match(record.integrity, /^sha512-[A-Za-z0-9+/]+=*$/);
    } else {
      assert.ok(candidate, `unexpected Askr package ${name}`);
      assert.equal(record.version, candidate.version, `wrong candidate version at ${location}`);
      assert.equal(record.integrity, candidate.integrity, `archive SRI mismatch at ${location}`);
    }
    assert.equal(
      record.link,
      undefined,
      `linked package is not a normal installed consumer: ${location}`,
    );
    const resolvedUrl = new URL(record.resolved);
    assert.equal(resolvedUrl.protocol, "https:");
    assert.equal(
      resolvedUrl.hostname,
      "registry.npmjs.org",
      "final locks must preserve canonical public registry URLs",
    );
    const path = join(root, location);
    assert.equal((await lstat(path)).isSymbolicLink(), false, `source symlink at ${location}`);
    const actualPath = await realpath(path);
    assert.ok(
      actualPath.startsWith(rootReal + sep),
      `dependency resolves outside isolated consumer: ${actualPath}`,
    );
    const manifest = await json(join(path, "package.json"));
    assert.equal(manifest.name, name);
    assert.equal(manifest.version, record.version);
    installed.push({
      name,
      location,
      version: record.version,
      integrity: record.integrity,
      resolved: record.resolved,
      realpath: actualPath,
    });
  }
  assert.ok(installed.length > 0);
  for (const declaration of declaredAskr(await json(join(root, "package.json")))) {
    if (declaration.field !== "peerDependencies" && declaration.field !== "optionalDependencies") {
      assert.ok(
        installed.some((item) => item.name === declaration.name),
        `missing declared package ${declaration.name}`,
      );
    }
  }
  return { lockSha256: sha256(lockBytes), installed };
}

const options = args();
if (options.help) {
  console.log(
    "npm run test:stages -- --out /new/external/run --baseline --playwright-module /browser-toolchain/node_modules/playwright/index.mjs [--stages api-only,mcp-server,ssg]\nFinal candidate: replace --baseline with --inventory /frozen/graph.json --registry http://127.0.0.1:4873/ after migrating stage ranges.",
  );
} else {
  const source = required(options, "source");
  const out = required(options, "out");
  const baseline = options.baseline === true;
  const inventoryPath = baseline ? undefined : required(options, "inventory");
  const npmCli = options["npm-cli"] ? required(options, "npm-cli") : process.env.npm_execpath;
  assert.ok(npmCli, "run through npm run test:stages, or supply --npm-cli");
  assert.ok(
    out !== source && !out.startsWith(source + sep),
    "qualification output must be outside its source tree",
  );
  const registry = new URL(options.registry ?? (baseline ? "https://registry.npmjs.org/" : ""));
  if (baseline) {
    assert.equal(registry.href, "https://registry.npmjs.org/");
  } else {
    assert.ok(
      ["127.0.0.1", "localhost", "[::1]"].includes(registry.hostname),
      "candidate registry must be loopback",
    );
    assert.equal(registry.protocol, "http:");
  }
  assert.equal(
    registry.username + registry.password,
    "",
    "candidate registry must not embed credentials",
  );
  const selected = options.stages
    ? options.stages.split(",")
    : baseline
      ? BASELINE_STAGES
      : ALL_STAGES;
  assert.equal(new Set(selected).size, selected.length);
  assert.ok(
    selected.length > 0 &&
      selected.every((stage) => (baseline ? BASELINE_STAGES : ALL_STAGES).includes(stage)),
  );
  const browserModule = selected.includes("ssg")
    ? required(options, "playwright-module")
    : undefined;
  const inventoryBytes = baseline ? undefined : await readFile(inventoryPath);
  const inventory = baseline ? undefined : JSON.parse(inventoryBytes);
  if (!baseline) {
    assert.equal(inventory.schemaVersion, 1);
    assert.equal(inventory.version, "0.5.0");
    assert.deepEqual(Object.keys(inventory.packages).sort(), ALL_PACKAGES.sort());
    for (const [name, candidate] of Object.entries(inventory.packages)) {
      assert.equal(
        candidate.version,
        inventory.version,
        `${name} is not the coordinated candidate`,
      );
      assert.match(candidate.integrity, /^sha512-[A-Za-z0-9+/]+=*$/);
      assert.match(candidate.tarballSha256, /^[a-f0-9]{64}$/);
      assert.match(candidate.sourceCommit, /^[a-f0-9]{40}$/);
    }
  }
  const preflight = [];
  // Neither mode rewrites application ranges or adds dependencies. Final candidate mode rejects 0.4 manifests.
  for (const stage of selected) {
    const manifest = await json(join(source, stage, "package.json"));
    assert.equal(manifest.packageManager, "npm@12.0.1");
    const declarations = declaredAskr(manifest);
    assert.ok(declarations.length > 0);
    for (const declaration of declarations) {
      if (baseline) {
        assert.equal(
          declaration.spec,
          ">=0.4.0 <0.5.0",
          `baseline declaration changed: ${stage} ${declaration.name}`,
        );
      } else {
        assert.ok(inventory.packages[declaration.name]);
        assert.ok(
          [">=0.5.0 <0.6.0", "^0.5.0", "0.5.0"].includes(declaration.spec),
          `unmigrated/nonregistry ${stage} ${declaration.name}: ${declaration.spec}`,
        );
      }
    }
    preflight.push({
      stage,
      manifestSha256: sha256(await readFile(join(source, stage, "package.json"))),
      declarations,
    });
  }
  await mkdir(out, { recursive: false });
  await guard(out, "independent-stages.json", async () => {
    const tool = join(out, "toolchain");
    await mkdir(join(tool, "bin"), { recursive: true });
    const quote = (value) => "'" + value.replaceAll("'", "'\"'\"'") + "'";
    await writeFile(
      join(tool, "bin/npm"),
      `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(npmCli)} "$@"\n`,
      { mode: 0o755 },
    );
    const userConfig = join(tool, "empty-user.npmrc");
    const globalConfig = join(tool, "empty-global.npmrc");
    await writeFile(userConfig, "");
    await writeFile(globalConfig, "");
    const env = Object.fromEntries(
      Object.keys(process.env)
        .filter((key) => /^npm_config_/i.test(key))
        .map((key) => [key, undefined]),
    );
    Object.assign(env, {
      PATH: join(tool, "bin") + ":" + process.env.PATH,
      NPM_CONFIG_USERCONFIG: userConfig,
      NPM_CONFIG_GLOBALCONFIG: globalConfig,
      NPM_CONFIG_REGISTRY: registry.href,
    });
    const version = await run(process.execPath, [npmCli, "--version"], {
      cwd: out,
      out,
      label: "npm-version",
      env,
    });
    assert.match(version.stdout.trim(), /^\d+\.\d+\.\d+$/);
    assert.ok(Number(process.versions.node.split(".")[0]) >= 24);
    const results = [];
    for (const { stage } of preflight) {
      const first = join(out, "install", stage);
      const replay = join(out, "ci", stage);
      const evidence = join(out, "evidence", stage);
      await mkdir(dirname(first), { recursive: true });
      await copyStage(join(source, stage), first);
      await mkdir(evidence, { recursive: true });
      const npm = (root, command, label, extra = [], runOptions = {}) =>
        run(process.execPath, [npmCli, command, ...extra], {
          cwd: root,
          out: evidence,
          label,
          env,
          timeoutMs: 600000,
          ...runOptions,
        });
      const ordinary = ["--registry", registry.href, "--audit=false", "--fund=false"];
      await npm(first, "install", "normal-install", [
        ...ordinary,
        "--cache",
        join(out, "cache-install", stage),
      ]);
      const initial = await verifyInstall(first, inventory, baseline);
      await mkdir(dirname(replay), { recursive: true });
      await copyStage(first, replay);
      await npm(replay, "ci", "fresh-cache-ci", [
        ...ordinary,
        "--cache",
        join(out, "cache-ci", stage),
      ]);
      const clean = await verifyInstall(replay, inventory, baseline);
      assert.equal(clean.lockSha256, initial.lockSha256, "ci must replay the exact generated lock");
      const peerTree = await npm(replay, "ls", "normal-peer-tree", ["--all", "--json"], {
        allowedExitCodes: [0, 1],
      });
      const peers = JSON.parse(peerTree.stdout);
      let developmentPeerLimitation = null;
      if (peerTree.code !== 0) {
        assert.equal(peers.error?.code, "ELSPROBLEMS");
        assert.ok(peers.problems?.length > 0);
        for (const problem of peers.problems) {
          assert.match(problem, /^invalid: vite@npm:@voidzero-dev\/vite-plus-core@0\.3\.3 /);
        }
        const mocker = await json(join(replay, "node_modules/@vitest/mocker/package.json"));
        assert.equal(mocker.version, "4.1.11");
        assert.equal(mocker.peerDependencies.vite, "^6.0.0 || ^7.0.0 || ^8.0.0");
        developmentPeerLimitation = {
          reason:
            "Upstream Vitest mocker peer metadata excludes the supported Vite+ alias; ordinary npm install/ci and app gates are qualified separately.",
          problems: peers.problems,
        };
      }
      // Candidate archives are GET-only; the public registry owns advisory POSTs.
      const advisoryRegistry = ["--registry", "https://registry.npmjs.org/"];
      await npm(replay, "audit", "audit-all", [...advisoryRegistry, "--json"]);
      await npm(replay, "audit", "audit-production", [
        ...advisoryRegistry,
        "--omit=dev",
        "--json",
      ]);
      const manifest = await json(join(replay, "package.json"));
      const gates = manifest.scripts.check
        ? ["check", "build"]
        : ["lint", "typecheck", "test", "build"];
      if (stage === "provider-auth") gates.push("test:types6", "test:types7", "test:browser");
      for (const script of gates) await npm(replay, "run", `stage-${script}`, [script]);
      const fixture =
        stage === "api-only"
          ? "api-only-wire.mjs"
          : stage === "mcp-server"
            ? "mcp-wire.mjs"
            : stage === "ssg"
              ? "ssg-runtime.mjs"
              : null;
      if (fixture) {
        const fixtureArgs = [join(helperRoot, fixture), "--stage", replay, "--out", evidence];
        if (stage === "ssg")
          fixtureArgs.push(
            "--playwright-module",
            browserModule,
            "--engine",
            options.engine ?? "chromium",
          );
        await run(process.execPath, fixtureArgs, {
          cwd: out,
          out: evidence,
          label: "runtime-fixture",
          env,
          timeoutMs: 600000,
        });
      }
      assert.equal(
        sha256(await readFile(join(replay, "package.json"))),
        preflight.find((item) => item.stage === stage).manifestSha256,
        "stage gates must not rewrite its declared dependencies",
      );
      results.push({
        stage,
        source: join(source, stage),
        install: first,
        ci: replay,
        declaredManifestSha256: preflight.find((item) => item.stage === stage).manifestSha256,
        initial,
        clean,
        gates,
        peerTree: { exit: peerTree.code, developmentPeerLimitation },
        fixture,
        evidence,
      });
      await save(join(out, "completed-stages.json"), { status: "partial", results });
    }
    return {
      node: process.version,
      npm: version.stdout.trim(),
      registry: registry.href,
      mode: baseline ? "published-0.4-baseline" : "frozen-0.5-candidate",
      inventory: baseline
        ? null
        : { path: inventoryPath, sha256: sha256(inventoryBytes), version: inventory.version },
      source,
      selected,
      preflight,
      results,
      scope:
        "Normal independent stage installations, stage checks/builds, compiled API/MCP and built SSG runtime fixtures. The provider-auth stage also runs its own strict TS6/TS7 and all-three-engine signed HTTPS acceptance. Existing root browser acceptance and all producer contracts remain separate gates.",
    };
  });
}
