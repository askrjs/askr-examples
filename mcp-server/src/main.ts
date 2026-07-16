import { connectMcpStdio } from "@askrjs/node/mcp";
import { listen } from "@askrjs/node";
import { createServerApp } from "@askrjs/server";
import { registerMcpRoutes } from "@askrjs/server/mcp";
import { createRouter } from "@askrjs/server/router";
import { mcp } from "./server.js";
import { conformanceMcp } from "./conformance.js";

const selectedMcp = process.argv.includes("--conformance") ? conformanceMcp : mcp;

if (process.argv.includes("--stdio")) {
  const connection = connectMcpStdio(selectedMcp, { dependencies: undefined });
  const shutdown = () => void connection.close();
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  await connection.closed;
} else {
  const port = Number(process.env.PORT ?? 3000);
  const router = createRouter();
  registerMcpRoutes(router, "/mcp", selectedMcp, {
    dependencies: undefined,
    stateful: process.argv.includes("--stateful"),
    allowedHosts: [process.env.HOST_HEADER ?? `127.0.0.1:${port}`],
    resource: process.env.MCP_RESOURCE ?? "http://127.0.0.1:3000/mcp",
  });
  const server = await listen(createServerApp(router), { port, host: "127.0.0.1" });
  const shutdown = () => server.close();
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
