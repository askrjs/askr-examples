import { describe, expect, it } from "vitest";
import { conformanceMcp } from "../src/conformance.js";

const messages: unknown[] = [];
const environment = {
  dependencies: undefined,
  auth: { authenticated: false, principal: null, session: null, tenant: null },
  transport: "stdio" as const,
  send: (message: unknown) => {
    messages.push(message);
  },
};
const call = (id: number, method: string, params?: unknown) =>
  conformanceMcp.handle(
    { jsonrpc: "2.0", id, method, ...(params ? { params } : {}) },
    environment,
  ) as Promise<any>;

describe("official conformance fixtures", () => {
  it("should expose every supported fixture primitive with valid schemas", async () => {
    const tools = (await call(1, "tools/list")).result.tools;
    expect(tools).toHaveLength(8);
    expect(tools.every((tool: any) => tool.inputSchema && tool.inputSchema.type === "object")).toBe(
      true,
    );
    expect((await call(2, "resources/list")).result.resources).toHaveLength(2);
    expect((await call(3, "resources/templates/list")).result.resourceTemplates).toHaveLength(1);
    expect((await call(4, "prompts/list")).result.prompts).toHaveLength(4);
  });

  it("should return exact text, binary, template, and prompt fixtures", async () => {
    expect(
      (await call(1, "tools/call", { name: "test_simple_text", arguments: {} })).result.content[0]
        .text,
    ).toBe("This is a simple text response for testing.");
    expect(
      (await call(2, "resources/read", { uri: "test://static-binary" })).result.contents[0],
    ).toMatchObject({ uri: "test://static-binary", mimeType: "image/png" });
    expect(
      (await call(3, "resources/read", { uri: "test://template/123/data" })).result.contents[0]
        .text,
    ).toBe(JSON.stringify({ id: "123", templateTest: true, data: "Data for ID: 123" }));
    expect(
      (
        await call(4, "prompts/get", {
          name: "test_prompt_with_arguments",
          arguments: { arg1: "hello", arg2: "world" },
        })
      ).result.messages[0].content.text,
    ).toBe("Prompt with arguments: arg1='hello', arg2='world'");
  });

  it("should separate tool errors and deliver all progress notifications", async () => {
    messages.length = 0;
    const failed = await call(1, "tools/call", { name: "test_error_handling", arguments: {} });
    expect(failed.result).toMatchObject({
      isError: true,
      content: [{ text: "This tool intentionally returns an error for testing" }],
    });
    await conformanceMcp.handle(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "test_tool_with_progress",
          arguments: {},
          _meta: { progressToken: "test" },
        },
      },
      environment,
    );
    expect(messages).toMatchObject([
      { method: "notifications/progress", params: { progress: 0, total: 100 } },
      { method: "notifications/progress", params: { progress: 50, total: 100 } },
      { method: "notifications/progress", params: { progress: 100, total: 100 } },
    ]);
  });
});
