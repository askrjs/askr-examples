export interface User {
  id: string;
  name: string;
}

export interface UserRepository {
  find(id: string, signal?: AbortSignal): Promise<User | null>;
}

export interface AppDependencies {
  users: UserRepository;
}

export function createDependencies(): AppDependencies {
  const users = new Map<string, User>([
    ['1', { id: '1', name: 'Ada Lovelace' }],
  ]);

  return {
    users: {
      async find(id, signal) {
        if (signal?.aborted) throw signal.reason;
        return users.get(id) ?? null;
      },
    },
  };
}
