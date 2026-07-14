import { createQuery, defineQuery } from '@askrjs/askr/data';
import type { AuthContext } from '@askrjs/auth';
import type { ActivityEvent } from './activity/repository.js';
import type { Dashboard } from './dashboard/repository.js';
import type { Policy } from './policies/repository.js';
import type { User } from './users/repository.js';

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, credentials: 'same-origin' });
  if (!response.ok) throw new Error(`${response.status} while loading ${path}`);
  return response.json() as Promise<T>;
}

export const sessionQuery = defineQuery<Record<string, never>, AuthContext>({
  key: () => 'session',
  fetch: ({ signal }) => getJson('/api/session', signal),
});

export const dashboardQuery = defineQuery<Record<string, never>, Dashboard>({
  key: () => 'dashboard',
  fetch: ({ signal }) => getJson('/api/dashboard', signal),
});

export const activityQuery = defineQuery<Record<string, never>, readonly ActivityEvent[]>({
  key: () => 'activity',
  fetch: ({ signal }) => getJson('/api/activity', signal),
});

export const usersQuery = defineQuery<Record<string, never>, readonly User[]>({
  key: () => 'users',
  fetch: ({ signal }) => getJson('/api/users', signal),
});

export const userQuery = defineQuery<{ id: string }, User>({
  key: ({ id }) => `users:${id}`,
  fetch: ({ id, signal }) => getJson(`/api/users/${encodeURIComponent(id)}`, signal),
});

export const policyQuery = defineQuery<{ id: string }, Policy>({
  key: ({ id }) => `policies:${id}`,
  fetch: ({ id, signal }) => getJson(`/api/policies/${encodeURIComponent(id)}`, signal),
});

export const useDashboard = () => createQuery(dashboardQuery, {});
export const useActivity = () => createQuery(activityQuery, {});
export const useUsers = () => createQuery(usersQuery, {});
export const useUser = (id: string) => createQuery(userQuery, { id });
export const usePolicy = (id: string) => createQuery(policyQuery, { id });
