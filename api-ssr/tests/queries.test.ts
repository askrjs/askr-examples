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

  it("should cancel an in-flight request when the context signal aborts", async () => {
    let started!: () => void;
    const inFlight = new Promise<void>((resolve) => (started = resolve));
    vi.stubGlobal("fetch", (_url: string, init?: RequestInit) => {
      started();
      // Never settles on its own: only an abort on the forwarded signal ends it.
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
          once: true,
        });
      });
    });
    const controller = new AbortController();
    const reason = new Error("navigated away");

    const pending = userQuery.fetch({ id: "1" }, { signal: controller.signal });
    await inFlight;
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
  });
});
