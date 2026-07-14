import { defineConfig } from 'vite-plus';

export default defineConfig({
  resolve: { preserveSymlinks: true },
  test: { include: ['tests/**/*.test.ts'] },
});
