import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activityQuery,
  dashboardQuery,
  policyQuery,
  sessionQuery,
  userQuery,
  usersQuery,
} from "../src/domains/queries.js";

type FetchCall = { url: string; init: RequestInit | undefined };

function stubFetch(body: unknown = {}): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  return calls;
}

describe("defineQuery fetchers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const collectionCases = [
    ["sessionQuery", sessionQuery, "/api/session"],
    ["dashboardQuery", dashboardQuery, "/api/dashboard"],
    ["activityQuery", activityQuery, "/api/activity"],
    ["usersQuery", usersQuery, "/api/users"],
  ] as const;

  it.each(collectionCases)(
    "%s should forward the context signal to fetch",
    async (_name, query, path) => {
      const calls = stubFetch();
      const controller = new AbortController();

      await query.fetch({}, { signal: controller.signal });

      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toBe(path);
      expect(calls[0]?.init?.signal).toBe(controller.signal);
    },
  );

  const detailCases = [
    ["userQuery", userQuery, "/api/users/a%2Fb"],
    ["policyQuery", policyQuery, "/api/policies/a%2Fb"],
  ] as const;

  it.each(detailCases)(
    "%s should read the id from input and forward the context signal",
    async (_name, query, path) => {
      const calls = stubFetch();
      const controller = new AbortController();

      await query.fetch({ id: "a/b" }, { signal: controller.signal });

      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toBe(path);
      expect(calls[0]?.init?.signal).toBe(controller.signal);
    },
  );

  it("should reject when the forwarded signal is aborted", async () => {
    vi.stubGlobal("fetch", (_url: string, init?: RequestInit) => {
      const signal = init?.signal;
      if (signal?.aborted) return Promise.reject(signal.reason);
      return Promise.resolve(new Response("{}"));
    });
    const controller = new AbortController();
    const reason = new Error("navigated away");
    controller.abort(reason);

    await expect(userQuery.fetch({ id: "1" }, { signal: controller.signal })).rejects.toBe(reason);
  });
});
