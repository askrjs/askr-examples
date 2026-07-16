import { For, state } from '@askrjs/askr';
import { action, ActionForm, type ActionValidationError } from '@askrjs/askr/actions';
import type { InferSchema } from '@askrjs/schema';
import {
  Block,
  Button,
  Card,
  CardContent,
  EmptyState,
  Inline,
  Input,
  Label,
  NavLink,
  PageHeader,
  Stack,
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
import { userData, usersData } from '../../domains/queries.js';
import { updateUserNameAction } from '../../domains/users/actions.js';
import type { User } from '../../domains/users/repository.js';
import { QueryError } from '../shared/query-error.js';

export function UsersPage() {
  const users = usersData();
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
  const user = userData(id);
  if (user.loading) return <EmptyState title="Loading user…" aria-busy="true" />;
  if (user.error) return <QueryError query={user} />;
  if (!user.data) return <EmptyState title="This user does not exist" />;
  return <UserEditor user={user.data} />;
}

function UserEditor({ user }: { user: User }) {
  const update = action<InferSchema<typeof updateUserNameAction.input>, User>(
    updateUserNameAction,
  );
  const initialError = update.state().error as ActionValidationError | undefined;
  const submittedName = initialError?.kind === 'invalid'
    && typeof initialError.values.name === 'string'
    ? initialError.values.name
    : user.name;
  const [name, setName] = state(submittedName);
  const [dialogOpen, setDialogOpen] = state(initialError?.kind === 'invalid');
  return (
    <>
      <PageHeader title={user.name} description={`${user.email} · User ${user.id}`} />
      <noscript>
        <ActionForm action={updateUserNameAction}>
          <Label for="native-user-name">Display name</Label>
          <Input id="native-user-name" name="name" value={name()} />
          <Button type="submit" variant="primary">Save user</Button>
        </ActionForm>
        {initialError?.fieldErrors.name?.[0]
          ? <p role="alert">{initialError.fieldErrors.name[0]}</p>
          : null}
      </noscript>
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
            <ActionForm action={updateUserNameAction} onSubmit={(event: Event) => {
              event.preventDefault();
              void update.submit({ name: name() });
            }}>
              <Label for="user-name">Display name</Label>
              <Input id="user-name" name="name" value={name()} onInput={(event: Event) => setName((event.target as HTMLInputElement).value)} />
              <Inline justify="end" gap="2">
                <DialogClose>Cancel</DialogClose>
                <Button type="submit" variant="primary" disabled={update.state().pending}>Save user</Button>
              </Inline>
            </ActionForm>
            {update.state().error ? (
              <p role="alert">
                {(update.state().error as ActionValidationError).fieldErrors?.name?.[0]
                  ?? 'The user could not be saved.'}
              </p>
            ) : null}
            {update.state().result ? <p role="status">User saved.</p> : null}
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
}
