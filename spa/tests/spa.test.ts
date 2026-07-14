import { describe, expect, it } from 'vitest';
import { anonymous, pageRegistry } from '../src/routes.js';

describe('SPA auth requirements', () => {
  it('uses the shared auth decision contract without server packages', async () => {
    const account = pageRegistry.manifest.records.find((record) => record.path === '/account');
    await expect(Promise.resolve(account?.options.auth?.(anonymous))).resolves.toEqual({
      allowed: false,
      reason: 'unauthenticated',
    });
  });
});
