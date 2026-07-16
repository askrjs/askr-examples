import { defineAction } from '@askrjs/askr/actions';
import { schema } from '@askrjs/schema';

export const updateUserNameAction = defineAction({
  id: 'users.update-name',
  input: schema.object({
    name: schema.string({ minLength: 2, maxLength: 80 }),
  }),
  invalidates: ['users'],
});

