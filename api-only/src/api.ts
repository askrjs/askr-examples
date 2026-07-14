import { createApi, schema, security } from '@askrjs/server/openapi';
import { requireAnonymous } from '@askrjs/auth';
import { requestId } from '@askrjs/server/middleware';
import type { AppDependencies } from './boot/dependencies.js';
import { registerRoutes } from './routes/index.js';

const api = createApi<AppDependencies>({
  info: {
    title: 'Askr API-only example',
    version: '1.0.0',
    description: 'The HTTP contract for the API-only Askr example.',
    license: { name: 'Apache 2.0', identifier: 'Apache-2.0' },
  },
  servers: [{ url: 'http://127.0.0.1:3000', description: 'Local development' }],
});

api.use(requestId()).access(requireAnonymous(), security.none());

export const User = api.schema('User', schema.object({
  id: schema.string({ description: 'User identifier' }),
  name: schema.string({ description: 'Display name' }),
}));

registerRoutes(api, User);

export default api;
