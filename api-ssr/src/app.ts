import { createServerApp } from '@askrjs/server';
import { createRouter } from '@askrjs/server/router';
import { createAskrPageHandler } from '@askrjs/server/askr';
import type { AppDependencies } from './boot/dependencies.js';
import { registerApiRoutes, pageRegistry } from './routes/index.js';
import { createQueryRegistry } from './boot/queries.js';

export function createApp(deps: AppDependencies) {
  const router = createRouter();
  registerApiRoutes(router, deps);
  return createServerApp({
    router,
    fallback: createAskrPageHandler({
      registry: pageRegistry,
      queryRegistry: createQueryRegistry(deps),
    }),
  });
}
