import { defineConfig } from "vite-plus";
import { askr } from "@askrjs/vite";
import { askrServer } from "@askrjs/vite/server";

export default defineConfig({
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
  },
  resolve: { preserveSymlinks: true },
  plugins: [askr(), askrServer({ entry: "./src/server/entry-server.ts" })],
  build: {
    manifest: true,
  },
});
