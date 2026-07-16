import type { Query } from '@askrjs/askr/data';
import { Alert, Button } from '@askrjs/themes/components';
import { RefreshCwIcon } from '@askrjs/lucide';

export function QueryError<T extends object>({ query }: { query: Query<T> }) {
  return (
    <Alert role="alert">
      <p>We could not load this workspace data.</p>
      <Button variant="outline" onPress={() => void query.refresh()}>
        <RefreshCwIcon aria-hidden="true" /> Retry
      </Button>
    </Alert>
  );
}
