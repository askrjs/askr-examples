import type { DocumentRenderer } from '@askrjs/askr/ssg';

export const renderDocument: DocumentRenderer = ({ appHtml, context }) => {
  const title = context.pathname === '/'
    ? 'Northstar Runbooks'
    : `Northstar Runbook · ${context.params.slug ?? 'Operations'}`;
  // Every expanded route uses this complete document boundary.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Public Northstar operations runbook" />
    <meta name="generator" content="Askr SSG" />
    <title>${title}</title>
    <link rel="stylesheet" href="/assets/client.css" />
  </head>
  <body>
    <div id="app">${appHtml}</div>
    <script type="module" src="/assets/client.js"></script>
  </body>
</html>`;
};
