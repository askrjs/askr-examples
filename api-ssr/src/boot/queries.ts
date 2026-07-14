import { createServerQueryRegistry } from '@askrjs/askr/data';
import { userQuery } from '../domains/users/queries.js';
import type { AppDependencies } from './dependencies.js';

export function createQueryRegistry(deps: AppDependencies) {
  return createServerQueryRegistry().register(userQuery, async ({ input, signal }) => {
    const user = await deps.users.find(input.id, signal);
    if (!user) throw new Error(`User ${input.id} was not found.`);
    return user;
  });
}
