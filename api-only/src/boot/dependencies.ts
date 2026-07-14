import { createInMemoryUserRepository, type UserRepository } from '../domains/users/repository.js';

export interface AppDependencies {
  users: UserRepository;
}

export function createDependencies(): AppDependencies {
  return {
    users: createInMemoryUserRepository(),
  };
}
