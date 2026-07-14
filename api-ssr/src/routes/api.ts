import { requireAnonymous, requirePermission, requireUser } from '@askrjs/auth';
import { schema, security, type ApiDefinition, type Schema } from '@askrjs/server/openapi';
import type { AppDependencies } from '../boot/dependencies.js';
import { SESSION_COOKIE } from '../domains/sessions/repository.js';
import type { UserUpdate } from '../domains/users/repository.js';

function parseVersion(value: string | null): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(?:W\/)?"?(\d+)"?$/);
  return match ? Number(match[1]) : Number.NaN;
}

function editableUser(input: Record<string, unknown>): UserUpdate | null {
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
  return Object.keys(update).length ? update : null;
}

export interface ApiSchemas {
  Activity: Schema;
  AuthContext: Schema;
  Dashboard: Schema;
  Policy: Schema;
  User: Schema;
}

export function registerApiRoutes(api: ApiDefinition<AppDependencies>, schemas: ApiSchemas): void {
  api.get('/api/health', (ctx) => ctx.ok({
    ok: true,
    requestId: typeof ctx.state.requestId === 'string' ? ctx.state.requestId : undefined,
  })).operationId('getHealth').summary('Get API health').tags('System')
    .ok(schema.object({ ok: schema.boolean(), requestId: schema.optional(schema.uuid()) }));

  api.get('/api/session', (ctx) => ctx.ok(ctx.auth))
    .operationId('getSession').summary('Get the current demo session').tags('Session')
    .ok(schemas.AuthContext);

  api.post('/api/session', async (ctx, { sessions }) => {
    const session = await sessions.create();
    return ctx.setCookie(ctx.created({ authenticated: true }), SESSION_COOKIE, session.id, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
    });
  }).operationId('createSession').summary('Create the deterministic demo session').tags('Session')
    .access(requireAnonymous(), security.none())
    .created(schema.object({ authenticated: schema.boolean() })).forbidden();

  api.delete('/api/session', async (ctx, { sessions }) => {
    if (ctx.auth.session) await sessions.delete(ctx.auth.session.id);
    return ctx.clearCookie(ctx.noContent(), SESSION_COOKIE, { path: '/', sameSite: 'lax', httpOnly: true });
  }).operationId('deleteSession').summary('Delete the current demo session').tags('Session')
    .access(requireUser(), security.require('cookieSession')).noContent();

  api.get('/api/dashboard', async (ctx, { dashboard }) => ctx.ok(await dashboard.get(ctx.signal)))
    .operationId('getDashboard').summary('Get workspace dashboard data').tags('Workspace')
    .access(requirePermission('dashboard:read'), security.require('cookieSession')).ok(schemas.Dashboard);

  api.get('/api/activity', async (ctx, { activity }) => ctx.ok(await activity.list(ctx.signal)))
    .operationId('listActivity').summary('List workspace activity').tags('Workspace')
    .access(requireUser(), security.require('cookieSession')).ok(schema.array(schemas.Activity));

  api.get('/api/users', async (ctx, { users }) => ctx.ok(await users.list(ctx.signal)))
    .operationId('listUsers').summary('List users').tags('Users')
    .access(requirePermission('users:read'), security.require('cookieSession')).ok(schema.array(schemas.User));

  api.get('/api/users/{id}', async (ctx, { users }) => {
    const user = await users.find(ctx.params.id, ctx.signal);
    return user
      ? ctx.ok(user, { headers: { etag: `"${user.version}"` } })
      : ctx.notFound('User not found');
  }).operationId('getUser').summary('Get a user').tags('Users')
    .access(requirePermission('users:read'), security.require('cookieSession'))
    .pathParam('id', schema.string()).ok(schemas.User).notFound();

  api.patch('/api/users/{id}', async (ctx, { users }) => {
    const bound = await ctx.bind<Record<string, unknown> & { id: string }>();
    const update = editableUser(bound);
    if (!update) return ctx.badRequest('name, email, or role must contain a valid editable value');
    const expectedVersion = parseVersion(ctx.headers.get('if-match'));
    if (expectedVersion === null) return ctx.problem(428, 'If-Match is required');
    if (!Number.isInteger(expectedVersion)) return ctx.badRequest('If-Match must contain a numeric version');
    const result = await users.update(bound.id, update, expectedVersion);
    if (result.kind === 'missing') return ctx.notFound('User not found');
    if (result.kind === 'conflict') return ctx.conflict(`User version ${result.current.version} is current`);
    return ctx.ok(result.user, { headers: { etag: `"${result.user.version}"` } });
  }).operationId('updateUser').summary('Update a user').tags('Users')
    .access(requirePermission('users:write'), security.require('cookieSession'))
    .pathParam('id', schema.string())
    .headerParam('If-Match', schema.string(), { required: true })
    .jsonBody(schema.object({
      name: schema.optional(schema.string({ minLength: 2 })),
      email: schema.optional(schema.email()),
      role: schema.optional(schema.enum(['operator', 'viewer'])),
    }), { required: true })
    .ok(schemas.User).badRequest().notFound().conflict()
    .response(428, schema.ref('Problem'), { mediaType: 'application/problem+json', description: 'Precondition Required' });

  api.get('/api/policies/{id}', async (ctx, { policies }) => {
    const policy = await policies.find(ctx.params.id, ctx.signal);
    return policy
      ? ctx.ok(policy, { headers: { etag: `"${policy.version}"` } })
      : ctx.notFound('Policy not found');
  }).operationId('getPolicy').summary('Get a policy').tags('Policies')
    .access(requirePermission('policies:read'), security.require('cookieSession'))
    .pathParam('id', schema.string()).ok(schemas.Policy).notFound();

  api.put('/api/policies/{id}', async (ctx, { policies }) => {
    const bound = await ctx.bind<Record<string, unknown> & { id: string }>();
    if (typeof bound.source !== 'string' || !bound.source.trim()) return ctx.badRequest('source is required');
    try { JSON.parse(bound.source); } catch { return ctx.badRequest('source must contain valid JSON'); }
    const expectedVersion = parseVersion(ctx.headers.get('if-match'));
    if (expectedVersion === null) return ctx.problem(428, 'If-Match is required');
    if (!Number.isInteger(expectedVersion)) return ctx.badRequest('If-Match must contain a numeric version');
    const result = await policies.update(bound.id, bound.source, expectedVersion);
    if (result.kind === 'missing') return ctx.notFound('Policy not found');
    if (result.kind === 'conflict') return ctx.conflict(`Policy version ${result.current.version} is current`);
    return ctx.ok(result.policy, { headers: { etag: `"${result.policy.version}"` } });
  }).operationId('updatePolicy').summary('Update a policy').tags('Policies')
    .access(requirePermission('policies:write'), security.require('cookieSession'))
    .pathParam('id', schema.string()).headerParam('If-Match', schema.string(), { required: true })
    .jsonBody(schema.object({ source: schema.string() }), { required: true })
    .ok(schemas.Policy).badRequest().notFound().conflict()
    .response(428, schema.ref('Problem'), { mediaType: 'application/problem+json', description: 'Precondition Required' });
}
