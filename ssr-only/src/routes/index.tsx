import { createRouteRegistry, route } from '@askrjs/askr/router';

function Shell({ children }: { children?: unknown }) {
  return (
    <main>
      <header>
        <a href="/">Askr SSR</a>
        <nav aria-label="Primary navigation">
          <a href="/">Home</a>
          <a href="/about">About</a>
        </nav>
      </header>
      {children}
    </main>
  );
}

function HomePage() {
  return (
    <Shell>
      <h1>Rendered on the server</h1>
      <p>This page arrived as HTML before the browser runtime loaded.</p>
    </Shell>
  );
}

function AboutPage() {
  return (
    <Shell>
      <h1>About this example</h1>
      <p>The same route table is used for SSR and browser hydration.</p>
    </Shell>
  );
}

function NotFoundPage() {
  return (
    <Shell>
      <h1>Page not found</h1>
      <p>The SSR fallback route handled this request.</p>
    </Shell>
  );
}

export const pageRegistry = createRouteRegistry(() => {
  route('/', HomePage);
  route('/about', AboutPage);
  route('/*', NotFoundPage);
});
