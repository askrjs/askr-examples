import { Resolve, routeData, type Deferred } from '@askrjs/askr/router';
import { Alert, PageHeader } from '@askrjs/themes/components';

type DeferredPageData = { message: Deferred<string> };

export function DeferredPage() {
  const data = routeData<DeferredPageData>();
  return (
    <>
      <PageHeader title="Deferred workspace data" />
      <Resolve
        value={data.message}
        pending={<p role="status">Loading deferred result…</p>}
        rejected={(error) => <Alert role="alert">Deferred data failed: {String(error)}</Alert>}
      >
        {(message) => <p role="status">{message}</p>}
      </Resolve>
    </>
  );
}

export function DeferredFailurePage() {
  const data = routeData<DeferredPageData>();
  return (
    <>
      <PageHeader title="Deferred failure handling" />
      <Resolve
        value={data.message}
        pending={<p role="status">Loading rejected result…</p>}
        rejected={(error) => <Alert role="alert">Deferred data failed: {String(error)}</Alert>}
      >
        {(message) => <p role="status">{message}</p>}
      </Resolve>
    </>
  );
}
