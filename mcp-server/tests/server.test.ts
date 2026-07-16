import { expect, it } from "vitest";
import { mcp } from "../src/server.js";

it("should expose the same definition to either transport", async () => {
  const result = (await mcp.handle(
    { jsonrpc: "2.0", id: 1, method: "tools/list" },
    {
      dependencies: undefined,
      auth: { authenticated: false, principal: null, session: null, tenant: null },
      transport: "stdio",
    },
  )) as { result: { tools: Array<{ name: string }> } };
  expect(result.result.tools.map((tool) => tool.name)).toEqual(["greet"]);
});
