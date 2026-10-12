import { createServer, connect, type Socket } from "node:net";
import { describe, expect, it } from "vite-plus/test";
import { createLoopbackProxy } from "./browser/loopback-proxy.js";
import { bounded } from "./signed-provider.js";

async function exchange(proxyUrl: string, request: string, complete: string) {
  const target = new URL(proxyUrl);
  let socket: Socket | undefined;
  try {
    return await bounded(
      new Promise<string>((resolve, reject) => {
        socket = connect({ host: target.hostname, port: Number(target.port) });
        let received = "";
        socket.once("error", reject);
        socket.once("connect", () => socket!.write(request));
        socket.on("data", (data) => {
          received += data.toString();
          if (received.includes(complete)) resolve(received);
        });
        socket.once("end", () => resolve(received));
      }),
      "test CONNECT exchange",
    );
  } finally {
    socket?.destroy();
  }
}

describe("owned browser CONNECT transport", () => {
  it("forwards the exact allowed authority and buffered bytes to its loopback listener", async () => {
    const listener = createServer((socket) =>
      socket.once("data", (data) => {
        expect(data.toString()).toBe("probe");
        socket.end("owned response");
      }),
    );
    await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", resolve));
    const address = listener.address();
    if (!address || typeof address !== "object") throw new Error("Missing test listener");
    const proxy = await createLoopbackProxy();
    proxy.bind(new Map([["provider.example-provider.test:443", address.port]]));
    try {
      expect(
        await exchange(
          proxy.url,
          "CONNECT provider.example-provider.test:443 HTTP/1.1\r\nHost: provider.example-provider.test:443\r\n\r\nprobe",
          "owned response",
        ),
      ).toBe("HTTP/1.1 200 Connection Established\r\n\r\nowned response");
    } finally {
      await proxy.close();
      await bounded(
        new Promise<void>((resolve) => listener.close(() => resolve())),
        "test listener shutdown",
      );
    }
  });

  it("rejects canonical provider authorities without a DNS or external fallback", async () => {
    const proxy = await createLoopbackProxy();
    proxy.bind(new Map());
    try {
      expect(
        await exchange(
          proxy.url,
          "CONNECT appleid.apple.com:443 HTTP/1.1\r\nHost: appleid.apple.com:443\r\n\r\n",
          "403 Forbidden",
        ),
      ).toContain("403 Forbidden");
    } finally {
      await expect(proxy.close()).rejects.toThrow(
        "Unknown CONNECT destination: appleid.apple.com:443",
      );
    }
  });

  it("rejects ordinary HTTP traffic and reports it at cleanup", async () => {
    const proxy = await createLoopbackProxy();
    proxy.bind(new Map());
    try {
      const response = await fetch(proxy.url);
      expect(response.status).toBe(403);
      await response.arrayBuffer();
    } finally {
      await expect(proxy.close()).rejects.toThrow("Unexpected non-CONNECT request: /");
    }
  });
});
