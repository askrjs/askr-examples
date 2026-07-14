import { createApi, schema, security } from '@askrjs/server/openapi';
import { requireAnonymous } from '@askrjs/auth';
import type { AppDependencies } from './boot/dependencies.js';
import { registerApiRoutes } from './routes/api.js';

const api = createApi<AppDependencies>({
  info: {
    title: 'Askr API and SSR example',
    version: '1.0.0',
    description: 'The documented API routes served alongside Askr SSR pages.',
    license: { name: 'Apache 2.0', identifier: 'Apache-2.0' },
  },
  servers: [{ url: 'http://127.0.0.1:3002', description: 'Local development' }],
});

api.access(requireAnonymous(), security.none());

export const User = api.schema('User', schema.object({
  id: schema.string({ description: 'User identifier' }),
  name: schema.string({ description: 'Display name' }),
}));

registerApiRoutes(api, User);

export default api;
