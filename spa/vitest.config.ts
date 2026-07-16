import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { preserveSymlinks: true },
  test: { environment: "jsdom", include: ["tests/**/*.test.ts"] },
});
