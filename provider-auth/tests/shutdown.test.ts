import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { AskrApp } from "@askrjs/server/askr";
const transport = vi.hoisted(() => ({
  stall: false,
  fail: false,
  connections: vi.fn(),
  close: vi.fn(),
}));
vi.mock("node:https", async () => {
  const { EventEmitter: Emitter } = await import("node:events");
  return {
    createServer() {
      const server = new Emitter();
      return Object.assign(server, {
        listen(_port: number, _host: string, done: () => void) {
          queueMicrotask(() =>
            transport.fail ? server.emit("error", new Error("owned listen failure")) : done(),
          );
        },
        close(done: (error?: Error) => void) {
          transport.close();
          if (!transport.stall) queueMicrotask(() => done());
        },
        closeAllConnections() {
          transport.connections();
        },
      });
    },
  };
});
import { startHttps } from "../src/server/https.js";
const directories: string[] = [];
afterEach(async () => {
  vi.useRealTimers();
  transport.stall = false;
  transport.fail = false;
  vi.clearAllMocks();
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function setup() {
  const path = await mkdtemp(join(tmpdir(), "askr-shutdown-"));
  directories.push(path);
  await writeFile(join(path, "owned.js"), "export {};");
  const close = vi.fn(async () => {});
  const app = {
    fetch: async () => new Response("owned"),
    close,
    toOpenApiDocument: () => ({
      openapi: "3.1.2",
      info: { title: "owned", version: "1" },
      paths: {},
      components: { schemas: {} },
    }),
  } satisfies AskrApp;
  return {
    app,
    close,
    path,
    env: {
      origin: "https://app.example.test",
      listenPort: 3443,
      tls: { certPath: join(path, "owned.js"), keyPath: join(path, "owned.js") },
    },
  };
}
describe("HTTPS sole-owner cleanup", () => {
  it("closes the engine on asset, TLS and listener startup failure", async () => {
    const first = await setup();
    await expect(startHttps(first.app, first.env, join(first.path, "missing"))).rejects.toThrow();
    expect(first.close).toHaveBeenCalledOnce();
    const second = await setup();
    await expect(
      startHttps(
        second.app,
        { ...second.env, tls: { certPath: "missing-owned-cert", keyPath: "missing-owned-key" } },
        second.path,
      ),
    ).rejects.toThrow();
    expect(second.close).toHaveBeenCalledOnce();
    const third = await setup();
    transport.fail = true;
    await expect(startHttps(third.app, third.env, third.path)).rejects.toThrow(
      "owned listen failure",
    );
    expect(third.close).toHaveBeenCalledOnce();
  });
  it("memoizes shutdown and starts engine cleanup despite a stalled listener", async () => {
    const f = await setup();
    const owner = await startHttps(f.app, f.env, f.path);
    transport.stall = true;
    vi.useFakeTimers();
    const first = owner.close();
    const observed = first.then(
      () => undefined,
      (error) => error,
    );
    expect(owner.close()).toBe(first);
    await Promise.resolve();
    expect(f.close).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await observed).toBeInstanceOf(AggregateError);
    expect(transport.connections).toHaveBeenCalled();
    expect(f.close).toHaveBeenCalledOnce();
  });
  it("still closes the listener when engine cleanup rejects", async () => {
    const f = await setup();
    f.close.mockRejectedValueOnce(new Error("owned engine close failure"));
    const owner = await startHttps(f.app, f.env, f.path);
    await expect(owner.close()).rejects.toThrow("shutdown failed");
    expect(transport.close).toHaveBeenCalledOnce();
    expect(transport.connections).toHaveBeenCalled();
  });
});
