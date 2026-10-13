import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    alias: {
      "virtual:askr-server": fileURLToPath(new URL("./tests/virtual-server.ts", import.meta.url)),
    },
  },
});
