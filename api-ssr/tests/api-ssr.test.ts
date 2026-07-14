import { describe, expect, it } from 'vitest';
import app from '../src/server/entry-server.js';

describe('api-ssr example', () => {
  it('serves API routes from the same app as SSR pages', async () => {
    const api = await app.fetch(new Request('http://example.test/api/health'));
    expect(await api.json()).toEqual({ ok: true });

    const page = await app.fetch(new Request('http://example.test/users/1'));
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(await page.text()).toContain('This page received the route parameter: 1');
  });

  it('keeps API and page fallback behavior distinct', async () => {
    const api = await app.fetch(new Request('http://example.test/api/missing'));
    expect(api.status).toBe(404);

    const page = await app.fetch(new Request('http://example.test/missing'));
    expect(await page.text()).toContain('Page not found');
  });
});
