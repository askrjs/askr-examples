import type { Router } from '@askrjs/server/router';
import type { UserRepository } from '../domains/users/repository.js';

export function registerUserRoutes(
  router: Router,
  deps: { users: UserRepository },
): void {
  router.get('/api/users/{id}', async (ctx) => {
    const user = await deps.users.find(ctx.params.id);
    return user ? ctx.ok(user) : ctx.notFound('User not found');
  });
}
