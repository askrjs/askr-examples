import { createAuth } from '@askrjs/auth';
import { createServerApp } from '@askrjs/server';
import { createAskrPageHandler } from '@askrjs/server/askr';
import { accessLog, requestId, securityHeaders } from '@askrjs/server/middleware';
import type { AppDependencies } from './boot/dependencies.js';
import { createQueryRegistry } from './boot/queries.js';
import { SESSION_COOKIE } from './domains/sessions/repository.js';
import { pageRegistry } from './application/routes.js';
import api from './api.js';

export function createApp(deps: AppDependencies) {
  const router = api.createRouter(deps);
  // Keep API failures as Problem Details instead of falling through to page SSR.
  router.get('/api/*', (ctx) => ctx.notFound('API route not found'));
  return createServerApp({
    router,
    auth: createAuth({
      sessions: deps.sessions,
      principals: deps.principals,
      sessionCookie: SESSION_COOKIE,
    }),
    middleware: [
      requestId(),
      securityHeaders({ contentSecurityPolicy: "default-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:" }),
      accessLog(({ request, response, requestId }) => deps.logger.write({
        method: request.method,
        path: new URL(request.url).pathname,
        status: response.status,
        requestId,
      })),
    ],
    probes: {
      livez: () => true,
      readyz: () => deps.users.ready(),
      startupz: () => true,
    },
    fallback: createAskrPageHandler({
      registry: pageRegistry,
      queryRegistry: createQueryRegistry(deps),
    }),
    onError: (_error, ctx) => ctx.internalServerError('The request could not be completed'),
  });
}
