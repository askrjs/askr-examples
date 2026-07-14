import { schema, type ApiDefinition, type Schema } from '@askrjs/server/openapi';
import type { AppDependencies } from '../boot/dependencies.js';

export function registerApiRoutes(api: ApiDefinition<AppDependencies>, User: Schema): void {
  api.get('/api/health', (ctx) => ctx.json({ ok: true }))
    .operationId('getHealth').summary('Get API health')
    .ok(schema.object({ ok: schema.boolean() }));
  api.get('/api/users/{id}', async (ctx, { users }) => {
    const user = await users.find(ctx.params.id);
    return user ? ctx.ok(user) : ctx.notFound('User not found');
  }).operationId('getUser').summary('Get a user')
    .pathParam('id', schema.string()).ok(User).notFound();
  api.post('/api/echo', async (ctx) => {
    const input = await ctx.bind<{ message: string }>();
    if (!input.message) return ctx.badRequest('message is required');
    return ctx.created({ message: input.message });
  }).operationId('createEcho').summary('Echo a JSON message')
    .jsonBody(schema.object({ message: schema.string() }), { required: true })
    .created(schema.object({ message: schema.string() })).badRequest();
}
