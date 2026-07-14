import { requireAnonymous, requireUser, type AuthContext } from '@askrjs/auth';
import { createRouteRegistry, route } from '@askrjs/askr/router';

export const anonymous: AuthContext = {
  authenticated: false,
  principal: null,
  session: null,
  tenant: null,
};

export const pageRegistry = createRouteRegistry(
  () => {
    route('/login', () => <h1>Sign in</h1>, { auth: requireAnonymous() });
    route('/account', () => <h1>Account</h1>, { auth: requireUser() });
  },
  {
    auth: {
      resolve: () => anonymous,
      loginPath: '/login',
      authenticatedRedirectTo: '/account',
    },
  },
);
