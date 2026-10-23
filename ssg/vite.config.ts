import { defineConfig } from "vite-plus";
import { askr } from "@askrjs/vite";

export default defineConfig({
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
  },
  plugins: [askr()],
  resolve: { preserveSymlinks: true },
  build: {
    outDir: ".askr/client",
    rollupOptions: {
      input: "./src/client.tsx",
      output: {
        entryFileNames: "assets/client.js",
        assetFileNames: "assets/client[extname]",
      },
    },
  },
});
