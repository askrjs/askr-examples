import { defineConfig } from "vite-plus";

export default defineConfig({
  resolve: { preserveSymlinks: true },
  test: { environment: "jsdom", include: ["tests/**/*.test.ts"] },
});
