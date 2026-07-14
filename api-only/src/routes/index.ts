import type { Router } from '@askrjs/server/router';
import type { AppDependencies } from '../boot/dependencies.js';
import { registerUserRoutes } from './users.js';

export function registerRoutes(router: Router, deps: AppDependencies): void {
  router.get('/api/health', (ctx) => ctx.json({ ok: true, requestId: ctx.state.requestId }));
  router.get('/api/greetings/{name}', (ctx) => ctx.json({ message: `Hello, ${ctx.params.name}!` }));
  router.post('/api/echo', async (ctx) => {
    const input = await ctx.bind<{ hello: string }>();
    if (!input.hello) return ctx.badRequest('hello is required');
    return ctx.created({ hello: input.hello });
  });

  registerUserRoutes(router, { users: deps.users });
}
