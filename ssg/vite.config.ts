import { defineConfig } from 'vite-plus';
import { askr } from '@askrjs/vite';

export default defineConfig({
  plugins: [askr()],
  resolve: { preserveSymlinks: true },
  build: {
    outDir: 'dist/static',
    emptyOutDir: false,
    rollupOptions: {
      input: './src/client.tsx',
      output: {
        entryFileNames: 'assets/client.js',
        assetFileNames: 'assets/client[extname]',
      },
    },
  },
});
