import { schema } from "@askrjs/schema";
import { createMcpServer } from "@askrjs/server/mcp";

export const mcp = createMcpServer({
  name: "askr-example",
  version: "0.0.1",
  title: "Askr MCP Example",
  instructions: "Demonstrates one server definition over HTTP and stdio.",
})
  .tool(
    "greet",
    {
      description: "Create a greeting.",
      input: schema.object({ name: schema.string({ description: "Name to greet" }) }),
      output: schema.object({ greeting: schema.string() }),
    },
    (_context, { name }) => ({
      content: [{ type: "text", text: `Hello, ${name}!` }],
      structuredContent: { greeting: `Hello, ${name}!` },
    }),
  )
  .resource(
    "askr://guide",
    { name: "Askr guide", description: "A small static resource", mimeType: "text/plain" },
    () => ({
      type: "text",
      uri: "askr://guide",
      mimeType: "text/plain",
      text: "Build MCP servers with Askr.",
    }),
  )
  .resourceTemplate(
    "askr://users/{name}",
    {
      name: "User greeting",
      complete: (_argument, value) =>
        ["Ada", "Grace"].filter((name) => name.toLowerCase().startsWith(value.toLowerCase())),
    },
    (_context, uri, { name }) => ({ type: "text", uri: uri.href, text: `Profile for ${name}` }),
  )
  .prompt(
    "welcome",
    {
      description: "Create a welcome prompt",
      arguments: schema.object({ name: schema.string({ description: "Guest name" }) }),
    },
    (_context, { name }) => ({
      messages: [{ role: "user", content: { type: "text", text: `Welcome ${name} to Askr.` } }],
    }),
  );
