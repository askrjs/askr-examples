import assert from "node:assert/strict";
import { createServer } from "node:http";
import { connect, type Socket } from "node:net";
import { bounded } from "../signed-provider.js";

/** Native CONNECT tunnels preserve HTTPS origins, redirects and browser cookie handling.
 * Only fixture-owned loopback listeners are reachable; there is no DNS or external fallback.
 * Provider listeners independently enforce the exact signed-fixture endpoint allowlist.
 */
export async function createLoopbackProxy() {
  let destinations: ReadonlyMap<string, number> | undefined;
  let closing = false;
  let closed: Promise<void> | undefined;
  const sockets = new Set<Socket>();
  const failures: string[] = [];
  const server = createServer((request, response) => {
    failures.push(`Unexpected non-CONNECT request: ${request.url}`);
    response.writeHead(403).end();
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    socket.on("error", () => socket.destroy());
  });
  server.on("connect", (request, client, head) => {
    const destination = request.url && destinations?.get(request.url);
    if (!destination || closing) {
      if (!closing) failures.push(`Unknown CONNECT destination: ${request.url}`);
      client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    const upstream = connect({ host: "127.0.0.1", port: destination });
    sockets.add(upstream);
    upstream.once("close", () => sockets.delete(upstream));
    upstream.on("error", (error) => {
      if (!closing) failures.push(`Owned CONNECT failed: ${error.message}`);
      client.destroy();
    });
    client.once("close", () => upstream.destroy());
    upstream.once("close", () => client.destroy());
    upstream.once("connect", () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      client.pipe(upstream);
      upstream.pipe(client);
    });
  });
  await bounded(
    new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    }),
    "browser proxy listen",
  );
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    url: `http://127.0.0.1:${address.port}`,
    bind(owned: ReadonlyMap<string, number>) {
      assert.equal(destinations, undefined, "A proxy belongs to exactly one signed fixture");
      destinations = new Map(owned);
    },
    close() {
      return (closed ??= (async () => {
        closing = true;
        const stopped = new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
        for (const socket of sockets) socket.destroy();
        await bounded(stopped, "browser proxy shutdown");
        assert.deepEqual(failures, []);
      })());
    },
  };
}
