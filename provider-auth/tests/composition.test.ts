import { describe, expect, it, vi } from "vite-plus/test";
import { withApplicationLifecycle } from "../src/server/compose.js";
import { providerMarker, modeMarker } from "../src/public-config.js";
import { createExampleRegistry } from "../src/registry.js";
import type { AskrApp } from "@askrjs/server/askr";
const document = `<!doctype html><head>${providerMarker}${modeMarker}</head><div id="app">private</div>`;
function rawOwner() {
  const close = vi.fn(async () => {});
  const raw = {
    fetch: vi.fn(async () => new Response("raw")),
    close,
    toOpenApiDocument: vi.fn((): ReturnType<AskrApp["toOpenApiDocument"]> => ({
      openapi: "3.1.2",
      info: { title: "owned", version: "1" },
      paths: {},
      components: { schemas: {} },
    })),
  } satisfies AskrApp;
  return raw;
}
describe("one app document/lifecycle composition", () => {
  it("passes one explicit auth object to the same registry and keeps protected action declarations", () => {
    const { registry, sessionAuth } = createExampleRegistry({ provider: "apple", mode: "ssr" });
    expect(registry.manifest.auth).toBe(sessionAuth);
    expect(registry.manifest.records.map((record) => record.path).sort()).toEqual(
      ["/", "/login", "/account", "/account/details", "/*"].sort(),
    );
    for (const record of registry.manifest.records.filter((record) =>
      record.path.startsWith("/account"),
    )) {
      expect(record.options.auth).toBeTypeOf("function");
      expect(record.options.actions?.map((action) => action.id)).toEqual(["provider.read-summary"]);
    }
  });
  it("forwards composed fetch but the exact raw singleton close/schema methods", async () => {
    const raw = rawOwner();
    const composed = {
      fetch: vi.fn(
        async () =>
          new Response(document, {
            headers: {
              "content-type": "text/html",
              "content-length": "1",
              etag: '"old"',
              "set-cookie": "owned=value; HttpOnly",
            },
          }),
      ),
    };
    const app = withApplicationLifecycle(composed, raw, { provider: "google", mode: "spa" });
    composed.fetch.mockImplementationOnce(async () => {
      const headers = new Headers({
        "content-type": "text/html",
        "content-length": "1",
        etag: '\"old\"',
      });
      headers.append("set-cookie", "owned=value; HttpOnly");
      headers.append("set-cookie", "transaction=other; HttpOnly");
      return new Response(document, { headers });
    });
    const request = new Request("https://app.example.test/");
    const response = await app.fetch(request);
    expect(composed.fetch).toHaveBeenCalledWith(request);
    expect(raw.fetch).not.toHaveBeenCalled();
    expect(await response.text()).toContain('name="askr-example-provider" content="google"');
    expect(response.headers.getSetCookie()).toEqual([
      "owned=value; HttpOnly",
      "transaction=other; HttpOnly",
    ]);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.has("etag")).toBe(false);
    expect(response.headers.has("content-length")).toBe(false);
    app.toOpenApiDocument();
    await app.close();
    expect(raw.toOpenApiDocument).toHaveBeenCalledOnce();
    expect(raw.close).toHaveBeenCalledOnce();
  });
  it.each(["", `${document}${providerMarker}`])(
    "rejects missing/ambiguous public markers",
    async (body) => {
      const app = withApplicationLifecycle(
        { fetch: async () => new Response(body, { headers: { "content-type": "text/html" } }) },
        rawOwner(),
        { provider: "apple", mode: "ssr" },
      );
      await expect(app.fetch(new Request("https://app.example.test/"))).rejects.toThrow(
        "exactly once",
      );
    },
  );
  it("returns auth/API/redirect responses unchanged and preserves HEAD headers without a body", async () => {
    const response = new Response(null, {
      status: 303,
      headers: { location: "/login", "set-cookie": "owned=value" },
    });
    const app = withApplicationLifecycle({ fetch: async () => response }, rawOwner(), {
      provider: "auth0",
      mode: "ssr",
    });
    expect(await app.fetch(new Request("https://app.example.test/auth/login/auth0"))).toBe(
      response,
    );
    const head = withApplicationLifecycle(
      {
        fetch: async () =>
          new Response(null, {
            headers: { "content-type": "text/html", "set-cookie": "owned=value" },
          }),
      },
      rawOwner(),
      { provider: "auth0", mode: "ssr" },
    );
    const result = await head.fetch(new Request("https://app.example.test/", { method: "HEAD" }));
    expect(await result.text()).toBe("");
    expect(result.headers.get("set-cookie")).toBe("owned=value");
  });
});
