import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createDependencies } from "../src/boot/dependencies.js";
import api from "../src/api.js";

function freshApp() {
  return createApp(createDependencies());
}

describe("API-only reference", () => {
  it("should apply request IDs, security headers, logging, and probes", async () => {
    const entries: Array<{ status: number; requestId?: string }> = [];
    const deps = createDependencies();
    deps.logger.write = (entry) => entries.push(entry);
    const app = createApp(deps);

    const response = await app.fetch(new Request("http://example.test/api/health"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ status: 200 });

    for (const path of ["/livez", "/readyz", "/startupz"]) {
      const probe = await app.fetch(new Request(`http://example.test${path}`));
      expect(probe.status).toBe(200);
      expect(probe.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("should list and find seeded users", async () => {
    const app = freshApp();
    const list = await app.fetch(new Request("http://example.test/api/users"));
    expect(await list.json()).toHaveLength(2);

    const user = await app.fetch(new Request("http://example.test/api/users/1"));
    expect(user.headers.get("etag")).toBe('"1"');
    expect(await user.json()).toMatchObject({ id: "1", name: "Ada Lovelace", version: 1 });

    const missing = await app.fetch(new Request("http://example.test/api/users/404"));
    expect(missing.status).toBe(404);
    expect(missing.headers.get("content-type")).toContain("application/problem+json");
  });

  it("should preserve bind precedence and read If-Match explicitly", async () => {
    const app = freshApp();
    const response = await app.fetch(
      new Request("http://example.test/api/users/1?id=query&name=Query%20Wins", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "if-match": '"1"',
          id: "header-must-not-bind",
        },
        body: JSON.stringify({ id: "body", name: "Body Name" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('"2"');
    expect(await response.json()).toMatchObject({ id: "1", name: "Query Wins", version: 2 });

    const stale = await app.fetch(
      new Request("http://example.test/api/users/1", {
        method: "PATCH",
        headers: { "content-type": "application/json", "if-match": '"1"' },
        body: JSON.stringify({ name: "Stale Writer" }),
      }),
    );
    expect(stale.status).toBe(409);

    const missingHeader = await freshApp().fetch(
      new Request("http://example.test/api/users/1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "No Version" }),
      }),
    );
    expect(missingHeader.status).toBe(428);
  });

  it("should isolate mutable dependencies between app instances", async () => {
    const first = freshApp();
    const second = freshApp();
    await first.fetch(
      new Request("http://example.test/api/users/1", {
        method: "PATCH",
        headers: { "content-type": "application/json", "if-match": "1" },
        body: JSON.stringify({ name: "Changed Once" }),
      }),
    );

    const untouched = await second.fetch(new Request("http://example.test/api/users/1"));
    expect(await untouched.json()).toMatchObject({ name: "Ada Lovelace", version: 1 });
  });

  it("should expose the basic contract through native OpenApiDocument traversal", () => {
    const document = api.toOpenApiDocument();
    expect(document.openapi).toBe("3.1.2");
    expect(Object.keys(document.paths).sort()).toEqual([
      "/api/health",
      "/api/users",
      "/api/users/{id}",
    ]);
    expect(document.paths["/api/users/{id}"]?.patch?.operationId).toBe("updateUser");
  });
});
