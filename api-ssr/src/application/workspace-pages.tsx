import { createMutation, type Query } from '@askrjs/askr/data';
import { ErrorBoundary } from '@askrjs/askr/components';
import { For, state } from '@askrjs/askr';
import { navigate } from '@askrjs/askr/router';
import { LineChart } from '@askrjs/charts/components';
import {
  FileCodeIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  RefreshCwIcon,
  SaveIcon,
  UsersIcon,
} from '@askrjs/lucide';
import { MonacoEditor } from '@askrjs/monaco';
import {
  Button,
  Alert,
  Aside,
  Block,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Grid,
  Input,
  Inline,
  Label,
  NavLink,
  PageHeader,
  Stack,
  Stat,
  StatLabel,
  StatValue,
} from '@askrjs/themes/components';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@askrjs/ui';
import type { AuthContext } from '@askrjs/auth';
import type { Dashboard } from '../domains/dashboard/repository.js';
import type { Policy } from '../domains/policies/repository.js';
import type { User } from '../domains/users/repository.js';
import { useDashboard, usePolicy, useUser, useUsers } from '../domains/queries.js';
import { OperationsLayout } from './layout.js';

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const problem = await response.json().catch(() => ({ detail: response.statusText })) as { detail?: string };
    throw new Error(problem.detail ?? `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function QueryError<T extends {}>({ query }: { query: Query<T> }) {
  return (
    <Alert role="alert">
      <p>We could not load this workspace data.</p>
      <Button variant="outline" onPress={() => void query.refresh()}>
        <RefreshCwIcon aria-hidden="true" /> Retry
      </Button>
    </Alert>
  );
}

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
            <form onSubmit={submit}>
              <Button type="submit" variant="primary" disabled={login.pending}>
                {login.pending ? 'Signing in…' : 'Sign in as Demo Operator'}
              </Button>
            </form>
            {login.error ? <Alert role="alert">Demo sign-in failed. Try again.</Alert> : null}
          </Stack>
        </CardContent>
      </Card>
    </OperationsLayout>
  );
}

export function WorkspaceLayout({ children }: { children?: unknown }) {
  const logout = createMutation<Record<string, never>, boolean>({
    action: async (_input, { signal }) => {
      const response = await fetch('/api/session', { method: 'DELETE', signal, credentials: 'same-origin' });
      if (!response.ok) throw new Error('Logout failed');
      return true;
    },
  });
  return (
    <OperationsLayout>
      <Grid columns={{ base: 1, md: '14rem minmax(0, 1fr)' }} gap="2xl">
        <Aside aria-label="Workspace navigation">
          <Stack gap="4">
          <h2>Operator tools</h2>
          <Stack as="nav" gap="2">
            <NavLink href="/workspace" match="exact"><LayoutDashboardIcon aria-hidden="true" /> Dashboard</NavLink>
            <NavLink href="/workspace/users"><UsersIcon aria-hidden="true" /> Users</NavLink>
            <NavLink href="/workspace/policies/support-escalation"><FileCodeIcon aria-hidden="true" /> Policies</NavLink>
          </Stack>
          <Button
            variant="ghost"
            disabled={logout.pending}
            onPress={() => void logout.execute({}).then(() => navigate('/login', { replace: true }))}
          >
            <LogOutIcon aria-hidden="true" /> Sign out
          </Button>
          </Stack>
        </Aside>
        <Block as="section">
          <ErrorBoundary fallback={(error, reset) => (
            <Alert role="alert">
              <p>Workspace rendering failed: {String(error)}</p>
              <Button onPress={reset}>Try rendering again</Button>
            </Alert>
          )}>
            <>{children}</>
          </ErrorBoundary>
        </Block>
      </Grid>
    </OperationsLayout>
  );
}

export function DashboardPage() {
  const dashboard = useDashboard();
  if (dashboard.loading) return <EmptyState title="Loading dashboard…" aria-busy="true" />;
  if (dashboard.error) return <QueryError query={dashboard} />;
  if (!dashboard.data) return <EmptyState title="Dashboard data is empty" />;
  return <DashboardContent dashboard={dashboard.data} />;
}

function DashboardContent({ dashboard }: { dashboard: Dashboard }) {
  return (
    <>
      <PageHeader title="Operations dashboard" description="This data was prefetched into the server-rendered query cache." />
      <Grid columns={{ base: 1, md: 3 }} gap="md">
        <Stat><StatLabel>Healthy services</StatLabel><StatValue>{dashboard.healthyServices}</StatValue></Stat>
        <Stat><StatLabel>Open incidents</StatLabel><StatValue>{dashboard.openIncidents}</StatValue></Stat>
        <Stat><StatLabel>Active users</StatLabel><StatValue>{dashboard.activeUsers}</StatValue></Stat>
      </Grid>
      <Card>
        <CardHeader><CardTitle>Active users this week</CardTitle></CardHeader>
        <CardContent>
          <LineChart label="Active users this week" data={dashboard.trend} showGrid />
        </CardContent>
      </Card>
    </>
  );
}

export function UsersPage() {
  const users = useUsers();
  if (users.loading) return <EmptyState title="Loading users…" aria-busy="true" />;
  if (users.error) return <QueryError query={users} />;
  if (!users.data?.length) return <EmptyState title="No workspace users" />;
  return (
    <>
      <PageHeader title="Workspace users" description="The authenticated operator directory." />
      <Stack as="ul" gap="3" p="0">
        <For each={[...users.data]} by={(user) => user.id}>
          {(user) => (
            <Block as="li">
              <Card><CardContent><Block rowFrom="sm" justify="between" align="center" gap="md">
                <Stack gap="1"><strong>{user.name}</strong><span>{user.email}</span></Stack>
                <NavLink href={`/workspace/users/${user.id}`}>View user</NavLink>
              </Block></CardContent></Card>
            </Block>
          )}
        </For>
      </Stack>
    </>
  );
}

export function UserPage({ id }: { id: string }) {
  const user = useUser(id);
  if (user.loading) return <EmptyState title="Loading user…" aria-busy="true" />;
  if (user.error) return <QueryError query={user} />;
  if (!user.data) return <EmptyState title="This user does not exist" />;
  return <UserEditor user={user.data} />;
}

function UserEditor({ user }: { user: User }) {
  const [name, setName] = state(user.name);
  const [dialogOpen, setDialogOpen] = state(false);
  const update = createMutation<{ name: string; version: number }, User>({
    action: async (input, { signal }) => responseJson(await fetch(`/api/users/${encodeURIComponent(user.id)}`, {
      method: 'PATCH',
      credentials: 'same-origin',
      signal,
      headers: { 'content-type': 'application/json', 'if-match': `"${input.version}"` },
      body: JSON.stringify({ name: input.name }),
    })),
    affects: () => ['users'],
    afterSuccess: 'invalidate',
  });
  return (
    <>
      <PageHeader title={user.name} description={`${user.email} · User ${user.id}`} />
      <Dialog open={dialogOpen()} onOpenChange={setDialogOpen}>
        <Button
          variant="outline"
          aria-haspopup="dialog"
          aria-expanded={dialogOpen() ? 'true' : 'false'}
          onPress={() => setDialogOpen(true)}
        >
          Edit user
        </Button>
        <DialogPortal>
          <DialogOverlay />
          <DialogContent style={{ width: 'min(32rem, calc(100vw - 2rem))' }}>
            <DialogTitle>Edit workspace user</DialogTitle>
            <DialogDescription>Changes use optimistic version matching and invalidate active user queries.</DialogDescription>
            <form onSubmit={(event: Event) => {
              event.preventDefault();
              void update.execute({ name: name(), version: user.version });
            }}>
              <Label for="user-name">Display name</Label>
              <Input id="user-name" value={name()} onInput={(event: Event) => setName((event.target as HTMLInputElement).value)} />
              <Inline justify="end" gap="2">
                <DialogClose>Cancel</DialogClose>
                <Button type="submit" variant="primary" disabled={update.pending}>Save user</Button>
              </Inline>
            </form>
            {update.error ? <p role="alert">The user could not be saved.</p> : null}
            {update.status === 'success' ? <p role="status">User saved.</p> : null}
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
}

export function PolicyPage({ id }: { id: string }) {
  const policy = usePolicy(id);
  if (policy.loading) return <EmptyState title="Loading policy…" aria-busy="true" />;
  if (policy.error) return <QueryError query={policy} />;
  if (!policy.data) return <EmptyState title="This policy does not exist" />;
  return <PolicyEditor policy={policy.data} />;
}

function PolicyEditor({ policy }: { policy: Policy }) {
  const [source, setSource] = state(policy.source);
  const save = createMutation<{ source: string; version: number }, Policy>({
    action: async (input, { signal }) => responseJson(await fetch(`/api/policies/${encodeURIComponent(policy.id)}`, {
      method: 'PUT',
      credentials: 'same-origin',
      signal,
      headers: { 'content-type': 'application/json', 'if-match': `"${input.version}"` },
      body: JSON.stringify({ source: input.source }),
    })),
    affects: () => [`policies:${policy.id}`],
    afterSuccess: 'invalidate',
  });
  return (
    <>
      <PageHeader title={policy.name} description="Edit and persist this JSON policy with Monaco." />
      <Card>
        <CardContent style={{ height: '28rem' }}>
          <MonacoEditor
          aria-label="Policy source"
          style={{ width: '100%', height: '100%' }}
          language={policy.language}
          path={`file:///policies/${policy.id}.json`}
          value={source()}
          options={{ automaticLayout: true, minimap: { enabled: false } }}
          onMount={(editor) => { editor.onDidChangeModelContent(() => setSource(editor.getValue())); }}
          />
        </CardContent>
      </Card>
      <Button variant="primary" disabled={save.pending} onPress={() => void save.execute({ source: source(), version: policy.version })}>
        <SaveIcon aria-hidden="true" /> {save.pending ? 'Saving…' : 'Save policy'}
      </Button>
      {save.error ? <p role="alert">The policy could not be saved.</p> : null}
      {save.status === 'success' ? <p role="status">Policy saved.</p> : null}
    </>
  );
}
