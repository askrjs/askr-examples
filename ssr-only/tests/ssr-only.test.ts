import { describe, expect, it } from 'vitest';
import app from '../src/server/entry-server.js';

describe('ssr-only example', () => {
  it('renders the route app for the index.html document', async () => {
    const response = await app.fetch(new Request('http://example.test/'));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('Rendered on the server');
  });

  it('renders the fallback route for an unknown URL', async () => {
    const response = await app.fetch(new Request('http://example.test/missing'));
    expect(await response.text()).toContain('Page not found');
  });
});
