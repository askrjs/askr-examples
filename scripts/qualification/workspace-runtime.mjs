import { mkdtemp } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { args, required, run, save } from "./common.mjs";

const options = args();
const source = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = options.out
  ? required(options, "out")
  : await mkdtemp(join(tmpdir(), "askr-examples-runtime-"));
const browserModule = createRequire(join(source, "package.json")).resolve("playwright");
const results = [];
console.log(`Compiled application runtime evidence: ${out}`);
for (const [stage, fixture] of [
  ["api-only", "api-only-wire.mjs"],
  ["mcp-server", "mcp-wire.mjs"],
  ["ssg", "ssg-runtime.mjs"],
]) {
  const commandArgs = [
    join(source, "scripts/qualification", fixture),
    "--stage",
    join(source, stage),
    "--out",
    join(out, stage),
  ];
  if (stage === "ssg") commandArgs.push("--playwright-module", browserModule);
  const result = await run(process.execPath, commandArgs, {
    cwd: source,
    out,
    label: stage,
    timeoutMs: 120000,
  });
  results.push({ stage, command: result.command, exit: result.code });
  console.log(`${stage}: passed`);
}
await save(join(out, "workspace-runtime.json"), { node: process.version, source, results });
