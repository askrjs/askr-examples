import { createServerApp } from '@askrjs/server';
import type { AppDependencies } from './boot/dependencies.js';
import api from './api.js';

export function createApp(deps: AppDependencies) {
  return createServerApp(api.createRouter(deps));
}
