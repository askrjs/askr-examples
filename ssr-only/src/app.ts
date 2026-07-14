import { createServerApp } from '@askrjs/server';
import { createAskrPageHandler } from '@askrjs/server/askr';
import { pageRegistry } from './application/routes.js';

export function createApp() {
  // Vite owns the document; the page handler renders only the application fragment.
  return createServerApp({ fallback: createAskrPageHandler({ registry: pageRegistry }) });
}
