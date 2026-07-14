import { schema, type ApiDefinition, type Schema } from '@askrjs/server/openapi';
import type { AppDependencies } from '../boot/dependencies.js';
import { registerUserRoutes } from './users.js';

export function registerRoutes(api: ApiDefinition<AppDependencies>, User: Schema): void {
  api.get('/api/health', (ctx) => ctx.json({ ok: true, requestId: ctx.state.requestId }))
    .operationId('getHealth').summary('Get API health')
    .ok(schema.object({ ok: schema.boolean(), requestId: schema.optional(schema.uuid()) }));
  api.get('/api/greetings/{name}', (ctx) => ctx.json({ message: `Hello, ${ctx.params.name}!` }))
    .operationId('getGreeting').summary('Get a personalized greeting')
    .pathParam('name', schema.string()).ok(schema.object({ message: schema.string() }));
  api.post('/api/echo', async (ctx) => {
    const input = await ctx.bind<{ hello: string }>();
    if (!input.hello) return ctx.badRequest('hello is required');
    return ctx.created({ hello: input.hello });
  }).operationId('createEcho').summary('Echo a JSON greeting')
    .jsonBody(schema.object({ hello: schema.string() }), { required: true })
    .created(schema.object({ hello: schema.string() })).badRequest();

  registerUserRoutes(api, User);
}
