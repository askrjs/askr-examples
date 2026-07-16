import { state } from '@askrjs/askr';
import { createMutation } from '@askrjs/askr/data';
import { SaveIcon } from '@askrjs/lucide';
import { MonacoEditor } from '@askrjs/monaco';
import { Button, Card, CardContent, EmptyState, PageHeader } from '@askrjs/themes/components';
import { policyData } from '../../domains/queries.js';
import type { Policy } from '../../domains/policies/repository.js';
import { QueryError } from '../shared/query-error.js';
import { responseJson } from '../shared/transport.js';

export function PolicyPage({ id }: { id: string }) {
  const policy = policyData(id);
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
