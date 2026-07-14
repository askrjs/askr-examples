import { describe, expect, it } from 'vitest';
import app from '../src/server/entry-server.js';

describe('SSR-only operations workspace', () => {
  it('should render the same overview vocabulary before hydration', async () => {
    const response = await app.fetch(new Request('http://example.test/'));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('Northstar Operations');
    expect(html).toContain('Everything is running smoothly.');
    expect(html).toContain('Review recent activity');
  });

  it('should render activity and fallback routes deterministically', async () => {
    const first = await app.fetch(new Request('http://example.test/activity'));
    const second = await app.fetch(new Request('http://example.test/activity'));
    expect(await first.text()).toBe(await second.text());

    const missing = await app.fetch(new Request('http://example.test/missing'));
    expect(await missing.text()).toContain('Workspace page not found');
  });
});
