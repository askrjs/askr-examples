import { createServer } from "node:https";
import { readFile, readdir, lstat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createNodeHandler } from "@askrjs/node";
import type { AskrApp } from "@askrjs/server/askr";
import type { ProviderEnvironment } from "./environment.js";

const mime: Readonly<Record<string, string>> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff2": "font/woff2",
};
export async function publicAssets(directory: string) {
  const entries = new Map<string, { body: Uint8Array<ArrayBuffer>; type: string }>();
  let total = 0;
  async function visit(path: string, parts: string[]) {
    const info = await lstat(path);
    if (info.isSymbolicLink()) throw new Error("Public assets must not contain symlinks");
    if (info.isDirectory()) {
      for (const name of await readdir(path)) await visit(join(path, name), [...parts, name]);
      return;
    }
    if (!info.isFile()) throw new Error("Public assets must be regular files");
    if (parts.at(-1)?.endsWith(".map")) return;
    const extension = /\.[^.]+$/u.exec(parts.at(-1) ?? "")?.[0];
    if (!extension || !mime[extension]) throw new Error("Unsupported public asset type");
    total += info.size;
    if (entries.size >= 512 || total > 32 * 1024 * 1024)
      throw new Error("The example public asset map is too large");
    entries.set(`/assets/${parts.map(encodeURIComponent).join("/")}`, {
      body: new Uint8Array(await readFile(path)),
      type: mime[extension],
    });
  }
  await visit(directory, []);
  return entries;
}
export async function startHttps(
  app: AskrApp,
  env: Pick<ProviderEnvironment, "origin" | "listenPort" | "tls">,
  assetsDirectory = fileURLToPath(new URL("../assets/", import.meta.url)),
) {
  let server: ReturnType<typeof createServer> | undefined;
  try {
    const assets = await publicAssets(assetsDirectory);
    const controllers = new Set<AbortController>();
    const active = new Set<Promise<Response>>();
    let closing = false;
    const combined = {
      fetch(request: Request) {
        if (closing) return Promise.resolve(new Response("Server is closing", { status: 503 }));
        const controller = new AbortController();
        controllers.add(controller);
        const owned = new Request(request, {
          signal: AbortSignal.any([request.signal, controller.signal]),
        });
        const work = (async () => {
          const path = new URL(owned.url).pathname;
          if (path.startsWith("/assets/")) {
            if (!["GET", "HEAD"].includes(owned.method))
              return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
            const entry = assets.get(path);
            return entry
              ? new Response(owned.method === "HEAD" ? null : entry.body.slice(), {
                  headers: { "content-type": entry.type, "x-content-type-options": "nosniff" },
                })
              : new Response(null, { status: 404 });
          }
          return app.fetch(owned);
        })();
        active.add(work);
        void work
          .finally(() => {
            controllers.delete(controller);
            active.delete(work);
          })
          .catch(() => undefined);
        return work;
      },
    };
    const listening = createServer(
      { cert: await readFile(env.tls.certPath), key: await readFile(env.tls.keyPath) },
      createNodeHandler(combined, {
        baseUrl: env.origin,
        allowedHosts: [new URL(env.origin).host],
      }),
    );
    server = listening;
    await new Promise<void>((resolve, reject) => {
      listening.once("error", reject);
      listening.listen(env.listenPort, "127.0.0.1", () => {
        listening.off("error", reject);
        resolve();
      });
    });
    let shutdown: Promise<void> | undefined;
    return {
      server: listening,
      close() {
        return (shutdown ??= (async () => {
          closing = true;
          for (const controller of controllers) controller.abort();
          const errors: unknown[] = [];
          const listener = new Promise<void>((resolve, reject) =>
            listening.close((error) => (error ? reject(error) : resolve())),
          );
          // Start sole engine cleanup even if listener drain stalls. Every promise gets an immediate rejection observer.
          const engine = Promise.resolve().then(() => app.close());
          const drain = Promise.allSettled([...active, listener, engine]);
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            const completed = await Promise.race([
              drain,
              new Promise<undefined>((resolve) => {
                timer = setTimeout(() => resolve(undefined), 2000);
              }),
            ]);
            if (completed === undefined) {
              listening.closeAllConnections();
              errors.push(new Error("HTTPS shutdown exceeded its owned drain bound"));
            } else
              for (const result of completed)
                if (result.status === "rejected") errors.push(result.reason);
          } finally {
            if (timer) clearTimeout(timer);
            listening.closeAllConnections();
          }
          if (errors.length)
            throw new AggregateError(errors, "Provider application shutdown failed");
        })());
      },
    };
  } catch (startupError) {
    // Ownership begins at entry: assets, TLS or listen failure must also close the sole app.
    const engine = Promise.resolve().then(() => app.close());
    const listener = server;
    listener?.closeAllConnections();
    const closed = listener
      ? new Promise<void>((resolve) => listener.close(() => resolve()))
      : Promise.resolve();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        Promise.allSettled([engine, closed]),
        new Promise<undefined>((resolve) => {
          timer = setTimeout(() => resolve(undefined), 2000);
        }),
      ]);
      const failures =
        result === undefined
          ? [new Error("HTTPS startup cleanup exceeded its owned drain bound")]
          : result
              .filter((value): value is PromiseRejectedResult => value.status === "rejected")
              .map((value) => value.reason);
      if (failures.length)
        throw new AggregateError(
          [startupError, ...failures],
          "Provider application startup failed",
        );
    } finally {
      if (timer) clearTimeout(timer);
      listener?.closeAllConnections();
    }
    throw startupError;
  }
}
