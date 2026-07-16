import { schema } from '@askrjs/schema';
import { createApi } from '@askrjs/server/openapi';
import type { AppDependencies } from './boot/dependencies.js';
import { registerRoutes } from './routes/index.js';

const api = createApi<AppDependencies>({
  info: {
    title: 'Northstar Operations API',
    version: '1.0.0',
    description: 'The basic API contract reused by the full API and SSR example.',
    license: { name: 'Apache 2.0', identifier: 'Apache-2.0' },
  },
  servers: [{ url: 'http://127.0.0.1:3000', description: 'Local development' }],
});

export const User = api.schema('User', schema.object({
  id: schema.string({ description: 'User identifier' }),
  name: schema.string({ description: 'Display name' }),
  email: schema.email(),
  role: schema.enum(['operator', 'viewer']),
  version: schema.integer({ minimum: 1 }),
}));

// Register additional API route groups beside this one.
registerRoutes(api, User);

export default api;
