import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const root = new URL('./dist/static/', import.meta.url);
const port = Number(process.env.PORT ?? 3003);
const types = { '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  const relative = pathname === '/' ? 'index.html' : pathname.includes('.') ? pathname.slice(1) : join(pathname.slice(1), 'index.html');
  try {
    const body = await readFile(new URL(relative, root));
    response.writeHead(200, { 'content-type': types[extname(relative)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});
server.listen(port, process.env.HOST ?? '127.0.0.1');
const shutdown = () => server.close();
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
