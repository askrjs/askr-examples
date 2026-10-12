import { describe, expect, it, vi } from "vite-plus/test";
import type { AskrApp } from "@askrjs/server/askr";
const owners = vi.hoisted(() => ({
  fetch: vi.fn(async () => new Response(null, { status: 204 })),
  close: vi.fn(async () => {}),
  schema: vi.fn((): ReturnType<AskrApp["toOpenApiDocument"]> => ({
    openapi: "3.1.2",
    info: { title: "owner", version: "1" },
    paths: {},
    components: { schemas: {} },
  })),
}));
vi.mock("../src/server/entry-server.js", () => {
  const app = {
    fetch: vi.fn(),
    close: owners.close,
    toOpenApiDocument: owners.schema,
  } satisfies AskrApp;
  return { app, default: app, environment: { provider: "google", mode: "ssr" } };
});
vi.mock("virtual:askr-server", () => {
  const app = { fetch: owners.fetch };
  return { app, default: app };
});
describe("production document singleton import boundary", () => {
  it("uses the composed fetch and exact raw entry cleanup without creating another engine", async () => {
    const source = await import("../src/server/entry-server.js");
    const production = await import("../src/server/production.js");
    expect(production.environment).toBe(source.environment);
    const request = new Request("https://app.example.test/auth/session");
    expect((await production.app.fetch(request)).status).toBe(204);
    expect(owners.fetch).toHaveBeenCalledWith(request);
    expect(source.app.fetch).not.toHaveBeenCalled();
    await production.app.close();
    expect(source.app.close).toHaveBeenCalledOnce();
    expect(owners.close).toHaveBeenCalledOnce();
    production.app.toOpenApiDocument();
    expect(owners.schema).toHaveBeenCalledOnce();
  });
});
