import { describe, expect, it } from 'vitest';
import {
  createDataRuntime,
  createMutation,
  createQuery,
  createQueryPrefetchContext,
  dehydrateDataRuntime,
  hydrateDataRuntime,
} from '@askrjs/askr/data';
import { createApp } from '../src/app.js';
import { createDependencies } from '../src/boot/dependencies.js';
import { createQueryRegistry } from '../src/boot/queries.js';
import { dashboardQuery } from '../src/domains/queries.js';
import api from '../src/api.js';

function cookieFrom(response: Response): string {
  return response.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
}

async function signIn(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await app.fetch(new Request('http://example.test/api/session', { method: 'POST' }));
  expect(response.status).toBe(201);
  return cookieFrom(response);
}

function withCookie(path: string, cookie: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set('cookie', cookie);
  return new Request(`http://example.test${path}`, { ...init, headers });
}

describe('API and SSR culmination', () => {
  it('should keep protected pages and APIs separate from public routes', async () => {
    const app = createApp(createDependencies());
    const page = await app.fetch(new Request('http://example.test/workspace'));
    expect(page.status).toBe(302);
    expect(page.headers.get('location')).toContain('/login?next=');

    const apiResponse = await app.fetch(new Request('http://example.test/api/dashboard'));
    expect(apiResponse.status).toBe(401);
    expect(apiResponse.headers.get('www-authenticate')).toContain('Bearer');

    const missingApi = await app.fetch(new Request('http://example.test/api/missing'));
    expect(missingApi.status).toBe(404);
    expect(missingApi.headers.get('content-type')).toContain('application/problem+json');

    const missingPage = await app.fetch(new Request('http://example.test/missing'));
    expect(await missingPage.text()).toContain('Workspace page not found');
  });

  it('should create, resolve, and explicitly clear the demo session cookie', async () => {
    const app = createApp(createDependencies());
    const cookie = await signIn(app);
    expect(cookie).toBe('northstar-session=northstar-demo-session');

    const session = await app.fetch(withCookie('/api/session', cookie));
    expect(await session.json()).toMatchObject({
      authenticated: true,
      principal: { id: 'demo-operator' },
      session: { id: 'northstar-demo-session' },
    });

    const logout = await app.fetch(withCookie('/api/session', cookie, { method: 'DELETE' }));
    expect(logout.status).toBe(204);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');

    const after = await app.fetch(withCookie('/api/session', cookie));
    expect(await after.json()).toMatchObject({ authenticated: false });
  });

  it('should SSR prefetch dashboard data into hydration state without a loading branch', async () => {
    const app = createApp(createDependencies());
    const cookie = await signIn(app);
    const response = await app.fetch(withCookie('/workspace', cookie));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('Operations dashboard');
    expect(html).toContain('Healthy services');
    expect(html).not.toContain('Loading dashboard');
    expect(html).toContain('data-askr-render-data');
    expect(html).toContain('__askr_query_cache');
  });

  it('should update users with bind precedence, permissions, and query-visible persistence', async () => {
    const app = createApp(createDependencies());
    const cookie = await signIn(app);
    const update = await app.fetch(withCookie('/api/users/1?name=Katherine%20Johnson', cookie, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'if-match': '"1"' },
      body: JSON.stringify({ id: 'body-id', name: 'Body Name' }),
    }));
    expect(update.status).toBe(200);
    expect(await update.json()).toMatchObject({ id: '1', name: 'Katherine Johnson', version: 2 });

    const page = await app.fetch(withCookie('/workspace/users/1', cookie));
    expect(await page.text()).toContain('Katherine Johnson');

    const deniedDeps = createDependencies();
    deniedDeps.principals.get = async () => ({
      id: 'demo-operator',
      subject: 'demo-operator',
      permissions: ['users:read'],
    });
    const deniedApp = createApp(deniedDeps);
    const deniedCookie = await signIn(deniedApp);
    const denied = await deniedApp.fetch(withCookie('/api/users/1', deniedCookie, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'if-match': '1' },
      body: JSON.stringify({ name: 'Forbidden Writer' }),
    }));
    expect(denied.status).toBe(403);
  });

  it('should persist valid policies and reject stale or invalid writes', async () => {
    const app = createApp(createDependencies());
    const cookie = await signIn(app);
    const source = JSON.stringify({ allow: ['support:write'], escalateAfterMinutes: 10 }, null, 2);
    const saved = await app.fetch(withCookie('/api/policies/support-escalation', cookie, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'if-match': '1' },
      body: JSON.stringify({ source }),
    }));
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ source, version: 2 });

    const stale = await app.fetch(withCookie('/api/policies/support-escalation', cookie, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'if-match': '1' },
      body: JSON.stringify({ source }),
    }));
    expect(stale.status).toBe(409);

    const invalid = await app.fetch(withCookie('/api/policies/support-escalation', cookie, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'if-match': '2' },
      body: JSON.stringify({ source: '{' }),
    }));
    expect(invalid.status).toBe(400);
  });

  it('should expose probes and middleware headers on the composed app', async () => {
    const app = createApp(createDependencies());
    for (const path of ['/livez', '/readyz', '/startupz']) {
      const response = await app.fetch(new Request(`http://example.test${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('should dehydrate prefetched data and let a client runtime adopt it', async () => {
    const deps = createDependencies();
    const serverRuntime = createDataRuntime();
    const prefetch = createQueryPrefetchContext({
      runtime: serverRuntime,
      registry: createQueryRegistry(deps),
      mode: 'ssr',
    });
    await prefetch.prefetch(dashboardQuery, {});
    const dehydrated = dehydrateDataRuntime(serverRuntime);

    const clientRuntime = createDataRuntime();
    hydrateDataRuntime(clientRuntime, dehydrated);
    expect(clientRuntime.queryData.get('dashboard')).toMatchObject({ healthyServices: 12 });
  });

  it('should mark affected queries pending when a mutation succeeds', async () => {
    const runtime = createDataRuntime();
    const query = createQuery({
      key: 'users:1',
      runtime,
      initialData: { name: 'Ada' },
      fetch: () => new Promise<{ name: string }>(() => undefined),
    });
    const mutation = createMutation<{ name: string }, { name: string }>({
      runtime,
      action: async (input) => input,
      affects: () => ['users'],
      afterSuccess: 'invalidate',
    });

    await mutation.execute({ name: 'Grace' });
    expect(query.consistency).toBe('refreshing');
  });

  it('should isolate mutable repositories across createApp calls', async () => {
    const first = createApp(createDependencies());
    const second = createApp(createDependencies());
    const firstCookie = await signIn(first);
    const secondCookie = await signIn(second);
    await first.fetch(withCookie('/api/users/1', firstCookie, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'if-match': '1' },
      body: JSON.stringify({ name: 'First App Only' }),
    }));
    const untouched = await second.fetch(withCookie('/api/users/1', secondCookie));
    expect(await untouched.json()).toMatchObject({ name: 'Ada Lovelace', version: 1 });
  });

  it('should document every strict API route while excluding the wildcard fallback', () => {
    const paths = api.toOpenApiDocument().paths;
    expect(paths['/api/users/{id}']?.patch?.operationId).toBe('updateUser');
    expect(paths['/api/policies/{id}']?.put?.operationId).toBe('updatePolicy');
    expect(paths['/api/*']).toBeUndefined();
  });
});
