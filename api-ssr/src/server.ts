import { listen } from '@askrjs/node';
import { createApp } from './app.js';
import { createDependencies } from './boot/dependencies.js';

const app = createApp(createDependencies());

const port = Number(process.env.PORT ?? 3002);
const server = await listen(app, { port, host: process.env.HOST ?? '127.0.0.1' });
const address = server.address();
const boundPort = typeof address === 'object' && address ? address.port : port;

console.log(`API + SSR example listening on http://127.0.0.1:${boundPort}`);

const shutdown = () => server.close();
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
