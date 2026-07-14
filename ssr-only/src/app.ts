import { createServerApp } from '@askrjs/server';
import { createAskrPageHandler } from '@askrjs/server/askr';
import { pageRegistry } from './routes/index.js';

export function createApp() {
  return createServerApp({ fallback: createAskrPageHandler({ registry: pageRegistry }) });
}
