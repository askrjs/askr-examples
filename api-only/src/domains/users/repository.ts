export interface User {
  id: string;
  name: string;
}

export interface UserRepository {
  find(id: string): Promise<User | null>;
}

export function createInMemoryUserRepository(): UserRepository {
  const users = new Map<string, User>([
    ['1', { id: '1', name: 'Ada Lovelace' }],
  ]);

  return {
    async find(id) {
      return users.get(id) ?? null;
    },
  };
}
