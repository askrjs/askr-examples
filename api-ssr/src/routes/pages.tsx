import { createRouteRegistry, route } from '@askrjs/askr/router';
import type { QueryPrefetchContext } from '@askrjs/askr/data';
import { useUser, userQuery } from '../domains/users/queries.js';

function Shell({ children }: { children?: unknown }) {
  return (
    <main>
      <header>
        <a href="/">Askr API + SSR</a>
        <nav aria-label="Primary navigation">
          <a href="/">Home</a>
          <a href="/users/1">User</a>
          <a href="/api/health">API health</a>
        </nav>
      </header>
      {children}
    </main>
  );
}

function HomePage() {
  return (
    <Shell>
      <h1>One app, two surfaces</h1>
      <p>This page is server-rendered and hydrated by Askr.</p>
      <p>The API lives alongside it at <code>/api/health</code>.</p>
    </Shell>
  );
}

function UserPage({ id }: { id: string }) {
  const user = useUser(id);
  return (
    <Shell>
      <h1>User route</h1>
      <p>This page received the route parameter: {id}</p>
      {user.loading ? <p>Loading user…</p> : <p>User: {user.data?.name}</p>}
    </Shell>
  );
}

function NotFoundPage() {
  return (
    <Shell>
      <h1>Page not found</h1>
    </Shell>
  );
}

export const userPreload = ({ params, data }: { params: Record<string, string>; data: QueryPrefetchContext }) =>
  data.prefetch(userQuery, { id: params.id });

export const pageRegistry = createRouteRegistry(() => {
  route('/', HomePage);
  route('/users/{id}', UserPage, { preload: userPreload });
  route('/*', NotFoundPage);
});
export const pageRoutes = pageRegistry.routes;
