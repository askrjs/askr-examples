import { listen } from '@askrjs/node';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import app from './dist/server/production.js';

const assetRoot = new URL('./dist/', import.meta.url);
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.map', 'application/json'],
  ['.svg', 'image/svg+xml'],
  ['.ttf', 'font/ttf'],
]);
const productionApp = {
  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    // Serve Vite's immutable client assets before handing page requests to SSR.
    if (pathname.startsWith('/assets/') && !pathname.includes('..')) {
      try {
        const body = await readFile(new URL(`.${pathname}`, assetRoot));
        return new Response(body, {
          headers: { 'content-type': contentTypes.get(extname(pathname)) ?? 'application/octet-stream' },
        });
      } catch {
        return new Response('Asset not found', { status: 404 });
      }
    }
    return app.fetch(request);
  },
};

const port = Number(process.env.PORT ?? 3001);
const server = await listen(productionApp, {
  host: process.env.HOST ?? '127.0.0.1',
  port,
});

const shutdown = () => server.close();
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
