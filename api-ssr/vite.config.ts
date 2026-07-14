import { defineConfig } from 'vite-plus';
import { askr } from '@askrjs/vite';
import { askrServer } from '@askrjs/vite/server';

export default defineConfig({
  resolve: { preserveSymlinks: true },
  plugins: [
    askr(),
    askrServer({ entry: './src/server/entry-server.ts' }),
  ],
  build: {
    manifest: true,
  },
});
