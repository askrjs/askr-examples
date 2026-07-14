import { schema, type ApiDefinition, type Schema } from '@askrjs/server/openapi';
import type { AppDependencies } from '../boot/dependencies.js';

export function registerUserRoutes(
  api: ApiDefinition<AppDependencies>,
  User: Schema,
): void {
  api.get('/api/users/{id}', async (ctx, { users }) => {
    const user = await users.find(ctx.params.id);
    return user ? ctx.ok(user) : ctx.notFound('User not found');
  }).operationId('getUser').summary('Get a user')
    .pathParam('id', schema.string()).ok(User).notFound();
}
