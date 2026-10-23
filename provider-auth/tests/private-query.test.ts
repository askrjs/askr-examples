import { afterEach, expect, it, vi } from "vite-plus/test";
import { createPrivateQuery, privateValue } from "../src/private-query.js";

afterEach(() => vi.unstubAllGlobals());

it.each([401, 403, 500])("recovers only an unauthorized private query (%s)", async (status) => {
  vi.stubGlobal("fetch", async () => new Response(null, { status }));
  const recover = vi.fn();
  const query = createPrivateQuery(recover);
  await expect(query.fetch({}, { signal: new AbortController().signal })).rejects.toThrow(
    "Private query is unavailable",
  );
  expect(recover).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
});

it("does not recover from a retired request whose transport ignores cancellation", async () => {
  let respond!: (response: Response) => void;
  vi.stubGlobal("fetch", () => new Promise<Response>((resolve) => (respond = resolve)));
  const recover = vi.fn();
  const query = createPrivateQuery(recover);
  const controller = new AbortController();
  const pending = query.fetch({}, { signal: controller.signal });
  controller.abort();
  respond(new Response(null, { status: 401 }));
  await expect(pending).rejects.toThrow("Private query is unavailable");
  expect(recover).not.toHaveBeenCalled();
});

it("returns private data without a login recovery when the request succeeds", async () => {
  vi.stubGlobal("fetch", async () => Response.json(privateValue));
  const recover = vi.fn();
  expect(
    await createPrivateQuery(recover).fetch({}, { signal: new AbortController().signal }),
  ).toEqual(privateValue);
  expect(recover).not.toHaveBeenCalled();
});
