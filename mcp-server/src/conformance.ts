import { schema } from "@askrjs/schema";
import { createMcpServer } from "@askrjs/server/mcp";

const empty = schema.object({});
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=";
const wav = "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
const pause = () => new Promise((resolve) => setTimeout(resolve, 50));

export const conformanceMcp = createMcpServer({ name: "askr-conformance", version: "0.0.1" })
  .tool("test_simple_text", { description: "Return text", input: empty }, () => ({
    content: [{ type: "text", text: "This is a simple text response for testing." }],
  }))
  .tool("test_image_content", { description: "Return an image", input: empty }, () => ({
    content: [{ type: "image", data: png, mimeType: "image/png" }],
  }))
  .tool("test_audio_content", { description: "Return audio", input: empty }, () => ({
    content: [{ type: "audio", data: wav, mimeType: "audio/wav" }],
  }))
  .tool(
    "test_embedded_resource",
    { description: "Return an embedded resource", input: empty },
    () => ({
      content: [
        {
          type: "resource",
          resource: {
            uri: "test://embedded-resource",
            mimeType: "text/plain",
            text: "This is an embedded resource content.",
          },
        },
      ],
    }),
  )
  .tool(
    "test_multiple_content_types",
    { description: "Return mixed content", input: empty },
    () => ({
      content: [
        { type: "text", text: "Multiple content types test:" },
        { type: "image", data: png, mimeType: "image/png" },
        {
          type: "resource",
          resource: {
            uri: "test://mixed-content-resource",
            mimeType: "application/json",
            text: JSON.stringify({ test: "data", value: 123 }),
          },
        },
      ],
    }),
  )
  .tool("test_tool_with_logging", { description: "Emit logs", input: empty }, async (context) => {
    await context.log("info", "Tool execution started");
    await pause();
    await context.log("info", "Tool processing data");
    await pause();
    await context.log("info", "Tool execution completed");
    return { content: [{ type: "text", text: "Tool execution completed with logging." }] };
  })
  .tool("test_error_handling", { description: "Return an error", input: empty }, () => {
    throw new Error("This tool intentionally returns an error for testing");
  })
  .tool(
    "test_tool_with_progress",
    { description: "Emit progress", input: empty },
    async (context) => {
      await pause();
      await context.progress(0, 100);
      await pause();
      await context.progress(50, 100);
      await pause();
      await context.progress(100, 100);
      await pause();
      return { content: [{ type: "text", text: "Tool execution completed with progress." }] };
    },
  )
  .resource("test://static-text", { name: "Static text", mimeType: "text/plain" }, () => ({
    type: "text",
    uri: "test://static-text",
    mimeType: "text/plain",
    text: "This is the content of the static text resource.",
  }))
  .resource("test://static-binary", { name: "Static binary", mimeType: "image/png" }, () => ({
    type: "blob",
    uri: "test://static-binary",
    mimeType: "image/png",
    blob: png,
  }))
  .resourceTemplate(
    "test://template/{id}/data",
    { name: "Template data", mimeType: "application/json" },
    (_context, uri, { id }) => ({
      type: "text",
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify({ id, templateTest: true, data: `Data for ID: ${id}` }),
    }),
  )
  .prompt("test_simple_prompt", { description: "Simple prompt", arguments: empty }, () => ({
    messages: [
      { role: "user", content: { type: "text", text: "This is a simple prompt for testing." } },
    ],
  }))
  .prompt(
    "test_prompt_with_arguments",
    {
      description: "Prompt arguments",
      arguments: schema.object({
        arg1: schema.string({ description: "First test argument" }),
        arg2: schema.string({ description: "Second test argument" }),
      }),
    },
    (_context, { arg1, arg2 }) => ({
      messages: [
        {
          role: "user",
          content: { type: "text", text: `Prompt with arguments: arg1='${arg1}', arg2='${arg2}'` },
        },
      ],
    }),
  )
  .prompt(
    "test_prompt_with_embedded_resource",
    {
      description: "Embedded resource prompt",
      arguments: schema.object({
        resourceUri: schema.string({ description: "URI of the resource to embed" }),
      }),
    },
    (_context, { resourceUri }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "resource",
            resource: {
              uri: resourceUri,
              mimeType: "text/plain",
              text: "Embedded resource content for testing.",
            },
          },
        },
        {
          role: "user",
          content: { type: "text", text: "Please process the embedded resource above." },
        },
      ],
    }),
  )
  .prompt("test_prompt_with_image", { description: "Image prompt", arguments: empty }, () => ({
    messages: [
      { role: "user", content: { type: "image", data: png, mimeType: "image/png" } },
      { role: "user", content: { type: "text", text: "Please analyze the image above." } },
    ],
  }));
