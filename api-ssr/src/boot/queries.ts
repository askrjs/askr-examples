import { defineServerQueries, serveQuery } from "@askrjs/askr/data";
import {
  activityQuery,
  dashboardQuery,
  policyQuery,
  userQuery,
  usersQuery,
} from "../domains/queries.js";
import type { AppDependencies } from "./dependencies.js";

export function createQueryRegistry(deps: AppDependencies) {
  return defineServerQueries(
    serveQuery(dashboardQuery, ({ signal }) => deps.dashboard.get(signal)),
    serveQuery(activityQuery, ({ signal }) => deps.activity.list(signal)),
    serveQuery(usersQuery, ({ signal }) => deps.users.list(signal)),
    serveQuery(userQuery, async ({ input, signal }) => {
      const user = await deps.users.find(input.id, signal);
      if (!user) throw new Error(`User ${input.id} was not found.`);
      return user;
    }),
    serveQuery(policyQuery, async ({ input, signal }) => {
      const policy = await deps.policies.find(input.id, signal);
      if (!policy) throw new Error(`Policy ${input.id} was not found.`);
      return policy;
    }),
  );
}
