import { createServerQueryRegistry } from '@askrjs/askr/data';
import {
  activityQuery,
  dashboardQuery,
  policyQuery,
  userQuery,
  usersQuery,
} from '../domains/queries.js';
import type { AppDependencies } from './dependencies.js';

export function createQueryRegistry(deps: AppDependencies) {
  return createServerQueryRegistry()
    .register(dashboardQuery, ({ signal }) => deps.dashboard.get(signal))
    .register(activityQuery, ({ signal }) => deps.activity.list(signal))
    .register(usersQuery, ({ signal }) => deps.users.list(signal))
    .register(userQuery, async ({ input, signal }) => {
      const user = await deps.users.find(input.id, signal);
      if (!user) throw new Error(`User ${input.id} was not found.`);
      return user;
    })
    .register(policyQuery, async ({ input, signal }) => {
      const policy = await deps.policies.find(input.id, signal);
      if (!policy) throw new Error(`Policy ${input.id} was not found.`);
      return policy;
    });
}
