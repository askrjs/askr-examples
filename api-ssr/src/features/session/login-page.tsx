import { createMutation } from '@askrjs/askr/data';
import type { AuthContext } from '@askrjs/auth';
import { Button, Card, CardContent, CardHeader, CardTitle, Stack } from '@askrjs/themes/components';
import { OperationsLayout } from '../../application/layout.js';
import { responseJson } from '../shared/transport.js';

export function LoginPage() {
  const login = createMutation<Record<string, never>, AuthContext>({
    action: async (_input, { signal }) => responseJson(await fetch('/api/session', {
      method: 'POST',
      signal,
      credentials: 'same-origin',
    })),
  });

  const submit = async (event: Event) => {
    event.preventDefault();
    await login.execute({});
    const next = typeof window === 'undefined'
      ? '/workspace'
      : new URLSearchParams(window.location.search).get('next') ?? '/workspace';
    window.location.assign(next.startsWith('/') ? next : '/workspace');
  };

  return (
    <OperationsLayout>
      <Card>
        <CardHeader><CardTitle>Enter the operations workspace</CardTitle></CardHeader>
        <CardContent>
          <Stack gap="4">
            <p>No identity provider is required. The server creates a deterministic local session cookie.</p>
            <form method="post" action="/api/session?next=/workspace" onSubmit={submit}>
              <Button type="submit" variant="primary" disabled={login.pending}>
                {login.pending ? 'Signing in…' : 'Sign in as Demo Operator'}
              </Button>
            </form>
            {login.error ? <p role="alert">Demo sign-in failed. Try again.</p> : null}
          </Stack>
        </CardContent>
      </Card>
    </OperationsLayout>
  );
}
