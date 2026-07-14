import { createServerApp } from '@askrjs/server';
import { createRouter } from '@askrjs/server/router';
import { requestId } from '@askrjs/server/middleware';
import type { AppDependencies } from './boot/dependencies.js';
import { registerRoutes } from './routes/index.js';

export function createApp(deps: AppDependencies) {
  const router = createRouter();
  router.use(requestId());
  registerRoutes(router, deps);
  return createServerApp(router);
}
