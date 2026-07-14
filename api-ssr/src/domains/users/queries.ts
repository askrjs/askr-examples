import { createQuery, defineQuery } from '@askrjs/askr/data';

export const userQuery = defineQuery<{ id: string }, { id: string; name: string }>({
  key: ({ id }) => `users:${id}`,
  fetch: async ({ id, signal }) => {
    const response = await fetch(`/api/users/${encodeURIComponent(id)}`, { signal });
    if (!response.ok) throw new Error(`Failed to load user ${id}`);
    return response.json();
  },
});

export function useUser(id: string) {
  return createQuery(userQuery, { id });
}
