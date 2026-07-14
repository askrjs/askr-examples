export interface User {
  id: string;
  name: string;
  email: string;
  role: 'operator' | 'viewer';
  version: number;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  role?: User['role'];
}

export type UserUpdateResult =
  | { kind: 'updated'; user: User }
  | { kind: 'missing' }
  | { kind: 'conflict'; current: User };

export interface UserRepository {
  list(): Promise<readonly User[]>;
  find(id: string): Promise<User | null>;
  update(id: string, input: UserUpdate, expectedVersion: number): Promise<UserUpdateResult>;
  ready(): Promise<boolean>;
}

const seedUsers: readonly User[] = [
  {
    id: '1',
    name: 'Ada Lovelace',
    email: 'ada@northstar.example',
    role: 'operator',
    version: 1,
  },
  {
    id: '2',
    name: 'Grace Hopper',
    email: 'grace@northstar.example',
    role: 'viewer',
    version: 1,
  },
];

export function createInMemoryUserRepository(): UserRepository {
  const users = new Map(seedUsers.map((user) => [user.id, { ...user }]));

  return {
    async list() {
      return [...users.values()].map((user) => ({ ...user }));
    },
    async find(id) {
      const user = users.get(id);
      return user ? { ...user } : null;
    },
    async update(id, input, expectedVersion) {
      const current = users.get(id);
      if (!current) return { kind: 'missing' };
      if (current.version !== expectedVersion) {
        return { kind: 'conflict', current: { ...current } };
      }
      const user = { ...current, ...input, id, version: current.version + 1 };
      users.set(id, user);
      return { kind: 'updated', user: { ...user } };
    },
    async ready() {
      return true;
    },
  };
}
