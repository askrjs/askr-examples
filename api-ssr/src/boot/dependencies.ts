import {
  createInMemoryActivityRepository,
  type ActivityRepository,
} from "../domains/activity/repository.js";
import {
  createInMemoryDashboardRepository,
  type DashboardRepository,
} from "../domains/dashboard/repository.js";
import {
  createInMemoryPolicyRepository,
  type PolicyRepository,
} from "../domains/policies/repository.js";
import {
  createInMemoryPrincipalRepository,
  createInMemorySessionRepository,
  type PrincipalRepository,
  type SessionRepository,
} from "../domains/sessions/repository.js";
import { createInMemoryUserRepository, type UserRepository } from "../domains/users/repository.js";

export interface ApplicationLogger {
  write(entry: { method: string; path: string; status: number; requestId?: string }): void;
}

export interface AppDependencies {
  activity: ActivityRepository;
  dashboard: DashboardRepository;
  policies: PolicyRepository;
  principals: PrincipalRepository;
  sessions: SessionRepository;
  users: UserRepository;
  logger: ApplicationLogger;
}

export function createDependencies(): AppDependencies {
  // Compose production adapters here; tests call this for fresh isolated state.
  return {
    activity: createInMemoryActivityRepository(),
    dashboard: createInMemoryDashboardRepository(),
    policies: createInMemoryPolicyRepository(),
    principals: createInMemoryPrincipalRepository(),
    sessions: createInMemorySessionRepository(),
    users: createInMemoryUserRepository(),
    logger: { write: () => undefined },
  };
}
