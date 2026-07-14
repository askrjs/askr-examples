import { describe, expect, it } from 'vitest';
import app from '../src/server/entry.js';
import api from '../src/api.js';

describe('api-only example', () => {
  it('serves health and request-scoped middleware state', async () => {
    const response = await app.fetch(new Request('http://example.test/api/health'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(await response.json()).toMatchObject({ ok: true });
  });

  it('matches parameters and echoes JSON bodies', async () => {
    const greeting = await app.fetch(new Request('http://example.test/api/greetings/Askr'));
    expect(await greeting.json()).toEqual({ message: 'Hello, Askr!' });

    const echo = await app.fetch(new Request('http://example.test/api/echo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hello: 'world' }),
    }));
    expect(echo.status).toBe(201);
    expect(await echo.json()).toEqual({ hello: 'world' });
  });

  it('uses explicitly injected route dependencies', async () => {
    const response = await app.fetch(new Request('http://example.test/api/users/1'));
    expect(await response.json()).toEqual({ id: '1', name: 'Ada Lovelace' });

    const missing = await app.fetch(new Request('http://example.test/api/users/404'));
    expect(missing.status).toBe(404);
  });

  it('exposes the same routes in its OpenAPI document', () => {
    const document = api.toOpenApiDocument() as Record<string, unknown>;
    expect(document.openapi).toBe('3.1.2');
    expect(document.paths).toMatchObject({
      '/api/health': { get: { operationId: 'getHealth' } },
      '/api/users/{id}': { get: { operationId: 'getUser' } },
    });
  });
});
