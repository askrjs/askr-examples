import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { actionCsrf, actionProblem } from "../src/actions.js";
afterEach(() => vi.unstubAllGlobals());
describe("fresh action CSRF transport", () => {
  it("uses a fresh same-origin no-store request and the supplied cancellation signal for every submit", async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ csrfToken: "first" }))
      .mockResolvedValueOnce(Response.json({ csrfToken: "second" }))
      .mockResolvedValueOnce(Response.json({}));
    vi.stubGlobal("fetch", transport);
    const signal = new AbortController().signal;
    expect(await actionCsrf(signal)).toBe("first");
    expect(await actionCsrf(signal)).toBe("second");
    expect(await actionCsrf(signal)).toBeUndefined();
    expect(transport).toHaveBeenCalledTimes(3);
    for (const call of transport.mock.calls)
      expect(call).toEqual([
        "/api/action-csrf",
        { signal, credentials: "same-origin", cache: "no-store", redirect: "error" },
      ]);
  });
  it.each([null, [], { session: "private" }, { csrfToken: "" }, { csrfToken: "bad token" }])(
    "rejects malformed responses without a fallback token",
    async (body) => {
      vi.stubGlobal("fetch", async () => Response.json(body));
      await expect(actionCsrf(new AbortController().signal)).rejects.toThrow(
        "Invalid action CSRF response",
      );
    },
  );
  it("passes only the decoded action cause to explicit recovery", () => {
    const cause = { code: "interaction-required", reason: "consent" };
    expect(actionProblem(new Error("Action failed", { cause }))).toBe(cause);
    expect(actionProblem(cause)).toBeUndefined();
  });
});
