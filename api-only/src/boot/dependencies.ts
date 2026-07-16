import { createInMemoryUserRepository, type UserRepository } from "../domains/users/repository.js";

export interface ApplicationLogger {
  write(entry: { method: string; path: string; status: number; requestId?: string }): void;
}

export interface AppDependencies {
  users: UserRepository;
  logger: ApplicationLogger;
}

export function createDependencies(): AppDependencies {
  // Compose production adapters here; tests call this for fresh isolated state.
  return {
    users: createInMemoryUserRepository(),
    logger: { write: () => undefined },
  };
}
