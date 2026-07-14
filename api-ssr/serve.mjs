import { listen } from '@askrjs/node';
import app from './dist/server/production.js';

const port = Number(process.env.PORT ?? 3002);
const server = await listen(app, {
  host: process.env.HOST ?? '127.0.0.1',
  port,
});

const shutdown = () => server.close();
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
