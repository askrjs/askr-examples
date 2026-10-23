import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, createConnection } from "node:net";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

export function args(argv = process.argv.slice(2)) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    assert.match(argv[i], /^--[a-z][a-z-]*$/);
    const name = argv[i].slice(2);
    result[name] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
  }
  return result;
}
export function required(options, name) {
  assert.equal(typeof options[name], "string", `--${name} is required`);
  return resolve(options[name]);
}
export async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
export async function save(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n");
}
export function cleanEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.NODE_PATH;
  delete env.NODE_OPTIONS;
  for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key];
  return env;
}
export function timeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
export const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
export async function availablePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const port = server.address().port;
  await new Promise((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
  return port;
}
export async function waitTcp(port, child, ms = 10000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    assert.equal(child.exited, false, "server exited before becoming ready");
    if (
      await new Promise((done) => {
        const socket = createConnection({ host: "127.0.0.1", port });
        socket.setTimeout(100);
        socket.once("connect", () => {
          socket.destroy();
          done(true);
        });
        socket.once("error", () => {
          socket.destroy();
          done(false);
        });
        socket.once("timeout", () => {
          socket.destroy();
          done(false);
        });
      })
    )
      return;
    await delay(40);
  }
  throw Error(`port ${port} did not become ready`);
}
export async function childProcess(command, commandArgs, { cwd, out, label, env = {} }) {
  await mkdir(out, { recursive: true });
  const stdoutPath = join(out, `${label}.stdout.log`);
  const stderrPath = join(out, `${label}.stderr.log`);
  await writeFile(stdoutPath, "");
  await writeFile(stderrPath, "");
  const child = spawn(command, commandArgs, {
    cwd,
    env: cleanEnv(env),
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
  });
  const result = {
    command: [command, ...commandArgs],
    cwd,
    exited: false,
    stdout: "",
    stderr: "",
    child,
  };
  result.closed = new Promise((done, reject) => {
    child.once("error", (error) => {
      result.exited = true;
      reject(error);
    });
    child.once("close", (code, signal) => {
      result.exited = true;
      result.code = code;
      result.signal = signal;
      done({ code, signal });
    });
  });
  // Keep rejection observed even when a readiness assertion fails first.
  result.closed.catch(() => {});
  child.stdout.on("data", (data) => {
    result.stdout += data;
    appendFileSync(stdoutPath, data);
  });
  child.stderr.on("data", (data) => {
    result.stderr += data;
    appendFileSync(stderrPath, data);
  });
  result.stop = async (stdinEof = false) => {
    if (!result.exited) {
      if (stdinEof) child.stdin.end();
      else child.kill("SIGTERM");
    }
    try {
      const exit = await timeout(result.closed, 6000, `${label} graceful shutdown`);
      assert.equal(exit.code, 0, `${label} did not exit cleanly: ${JSON.stringify(exit)}`);
      return exit;
    } catch (error) {
      if (!result.exited) child.kill("SIGKILL");
      await result.closed.catch(() => {});
      throw error;
    }
  };
  return result;
}
export async function run(command, commandArgs, options) {
  const child = await childProcess(command, commandArgs, options);
  child.child.stdin.end();
  let exit;
  try {
    exit = await timeout(child.closed, options.timeoutMs ?? 120000, options.label);
  } catch (error) {
    if (!child.exited) child.child.kill("SIGKILL");
    await child.closed.catch(() => {});
    throw error;
  }
  assert.ok(
    (options.allowedExitCodes ?? [0]).includes(exit.code),
    `${options.label} exited ${exit.code}; see ${options.out}/${options.label}.stderr.log`,
  );
  return { command: child.command, code: exit.code, stdout: child.stdout, stderr: child.stderr };
}
export async function entryIdentity(stage, entry) {
  const path = join(stage, entry);
  const bytes = await readFile(path);
  return {
    stage,
    entry: path,
    sha256: sha256(bytes),
    node: process.version,
    package: await json(join(stage, "package.json")),
  };
}
export async function fetchRecorded(url, init = {}) {
  const response = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(8000) });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, headers: Object.fromEntries(response.headers), body };
}
export async function guard(out, file, action) {
  await mkdir(out, { recursive: true });
  const started = new Date().toISOString();
  try {
    const evidence = await action();
    await save(join(out, file), {
      status: "passed",
      started,
      finished: new Date().toISOString(),
      ...evidence,
    });
  } catch (error) {
    await save(join(out, file), {
      status: "failed",
      started,
      finished: new Date().toISOString(),
      error: error.stack ?? String(error),
    });
    throw error;
  }
}
