import type { Router } from '@askrjs/server/router';
import type { AppDependencies } from '../boot/dependencies.js';

export function registerApiRoutes(router: Router, deps: AppDependencies): void {
  router.get('/api/health', (ctx) => ctx.json({ ok: true }));
  router.get('/api/users/{id}', async (ctx) => {
    const user = await deps.users.find(ctx.params.id);
    return user ? ctx.ok(user) : ctx.notFound('User not found');
  });
  router.post('/api/echo', async (ctx) => {
    const input = await ctx.bind<{ message: string }>();
    if (!input.message) return ctx.badRequest('message is required');
    return ctx.created({ message: input.message });
  });
  // Keep unknown API paths from falling through to the page fallback.
  router.get('/api/*', (ctx) => ctx.notFound('API route not found'));
}
