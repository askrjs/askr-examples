import { schema, type ApiDefinition, type Schema } from '@askrjs/server/openapi';
import type { AppDependencies } from '../boot/dependencies.js';
import { registerUserRoutes } from './users.js';

export function registerRoutes(api: ApiDefinition<AppDependencies>, User: Schema): void {
  api.get('/api/health', (ctx) => ctx.ok({
    ok: true,
    requestId: typeof ctx.state.requestId === 'string' ? ctx.state.requestId : undefined,
  })).operationId('getHealth').summary('Get API health').tags('System')
    .ok(schema.object({ ok: schema.boolean(), requestId: schema.optional(schema.uuid()) }));

  registerUserRoutes(api, User);
}
