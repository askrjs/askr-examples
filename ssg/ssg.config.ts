import { pageRegistry } from './src/routes.js';
import { renderDocument } from './src/document.js';

export const outputDir = './dist/static';
export const seed = 20260714;
export const staticConfig = {
  registry: pageRegistry,
  outputDir,
  seed,
  document: renderDocument,
  concurrency: 1,
  assets: [
    {
      from: './.askr/client/assets',
      to: 'assets',
    },
  ],
} as const;
