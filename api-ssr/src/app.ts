import { createServerApp } from '@askrjs/server';
import { createAskrPageHandler } from '@askrjs/server/askr';
import type { AppDependencies } from './boot/dependencies.js';
import { pageRegistry } from './routes/index.js';
import api from './api.js';
import { createQueryRegistry } from './boot/queries.js';

export function createApp(deps: AppDependencies) {
  const router = api.createRouter(deps);
  // Keep unknown API paths from falling through to the page fallback.
  router.get('/api/*', (ctx) => ctx.notFound('API route not found'));
  return createServerApp({
    router,
    fallback: createAskrPageHandler({
      registry: pageRegistry,
      queryRegistry: createQueryRegistry(deps),
    }),
  });
}
