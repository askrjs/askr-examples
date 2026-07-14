import { schema, type ApiDefinition, type Schema } from '@askrjs/server/openapi';
import type { AppDependencies } from '../boot/dependencies.js';
import type { UserUpdate } from '../domains/users/repository.js';

function parseVersion(value: string | null): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(?:W\/)?"?(\d+)"?$/);
  return match ? Number(match[1]) : Number.NaN;
}

function editableInput(input: Record<string, unknown>): UserUpdate | null {
  const update: UserUpdate = {};
  if (input.name !== undefined) {
    if (typeof input.name !== 'string' || input.name.trim().length < 2) return null;
    update.name = input.name.trim();
  }
  if (input.email !== undefined) {
    if (typeof input.email !== 'string' || !input.email.includes('@')) return null;
    update.email = input.email.trim();
  }
  if (input.role !== undefined) {
    if (input.role !== 'operator' && input.role !== 'viewer') return null;
    update.role = input.role;
  }
  return Object.keys(update).length > 0 ? update : null;
}

export function registerUserRoutes(
  api: ApiDefinition<AppDependencies>,
  User: Schema,
): void {
  api.get('/api/users', async (ctx, { users }) => ctx.ok(await users.list()))
    .operationId('listUsers').summary('List users').tags('Users')
    .ok(schema.array(User));

  api.get('/api/users/{id}', async (ctx, { users }) => {
    const user = await users.find(ctx.params.id);
    return user
      ? ctx.ok(user, { headers: { etag: `"${user.version}"` } })
      : ctx.notFound('User not found');
  }).operationId('getUser').summary('Get a user').tags('Users')
    .pathParam('id', schema.string()).ok(User, {
      headers: { ETag: { description: 'Current user version', schema: { type: 'string' } } },
    }).notFound();

  api.patch('/api/users/{id}', async (ctx, { users }) => {
    const bound = await ctx.bind<Record<string, unknown> & { id: string }>();
    const update = editableInput(bound);
    if (!update) return ctx.badRequest('name, email, or role must contain a valid editable value');

    const expectedVersion = parseVersion(ctx.headers.get('if-match'));
    if (expectedVersion === null) return ctx.problem(428, 'If-Match is required');
    if (!Number.isInteger(expectedVersion)) return ctx.badRequest('If-Match must contain a numeric version');

    const result = await users.update(bound.id, update, expectedVersion);
    if (result.kind === 'missing') return ctx.notFound('User not found');
    if (result.kind === 'conflict') {
      return ctx.conflict(`User version ${result.current.version} is current`);
    }
    return ctx.ok(result.user, { headers: { etag: `"${result.user.version}"` } });
  }).operationId('updateUser').summary('Update a user').tags('Users')
    .pathParam('id', schema.string())
    .headerParam('If-Match', schema.string(), { required: true, description: 'Quoted user version' })
    .jsonBody(schema.object({
      name: schema.optional(schema.string({ minLength: 2 })),
      email: schema.optional(schema.email()),
      role: schema.optional(schema.enum(['operator', 'viewer'])),
    }), { required: true })
    .ok(User).badRequest().notFound().conflict()
    .response(428, schema.ref('Problem'), { mediaType: 'application/problem+json', description: 'Precondition Required' });
}
