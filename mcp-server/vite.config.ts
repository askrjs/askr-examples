import { resolve } from "node:path";
import { defineConfig } from "vite-plus";

export default defineConfig({
  resolve: {
    alias: {
      "@askrjs/schema": resolve(import.meta.dirname, "../../askr-schema/src/index.ts"),
      "@askrjs/node/mcp": resolve(import.meta.dirname, "../../askr-node/src/mcp.ts"),
      "@askrjs/server/mcp": resolve(import.meta.dirname, "../../askr-server/src/mcp/index.ts"),
    },
  },
});
