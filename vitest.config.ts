import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: { include: ['api-only/tests/**/*.test.ts'] },
});
