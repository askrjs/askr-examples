import { requireAnonymous, requireUser } from '@askrjs/auth';
import { createRouteRegistry, group, route } from '@askrjs/askr/router';
import type { QueryPrefetchContext } from '@askrjs/askr/data';
import { dashboardQuery, policyQuery, userQuery, usersQuery } from '../domains/queries.js';
import { ActivityPage, NotFoundPage, OverviewPage } from './pages.js';
import { resolveBrowserAuth } from './client-auth.js';
import {
  DashboardPage,
  LoginPage,
  PolicyPage,
  UserPage,
  UsersPage,
  WorkspaceLayout,
} from './workspace-pages.js';

export const baseRoutePaths = ['/', '/activity', '/*'] as const;

const preloadDashboard = ({ data }: { data: QueryPrefetchContext }) => data.prefetch(dashboardQuery, {});
const preloadUsers = ({ data }: { data: QueryPrefetchContext }) => data.prefetch(usersQuery, {});
const preloadUser = ({ params, data }: { params: { id: string }; data: QueryPrefetchContext }) => data.prefetch(userQuery, { id: params.id });
const preloadPolicy = ({ params, data }: { params: { id: string }; data: QueryPrefetchContext }) => data.prefetch(policyQuery, { id: params.id });

export const pageRegistry = createRouteRegistry(
  () => {
    // These public routes carry forward from the SSR stage; add full-stack routes between them and the fallback.
    route('/', OverviewPage);
    route('/activity', ActivityPage);
    route('/login', LoginPage, { auth: requireAnonymous() });
    group({ layout: WorkspaceLayout, auth: requireUser() }, () => {
      // Register additional protected workspace routes here.
      route('/workspace', DashboardPage, { preload: preloadDashboard });
      route('/workspace/users', UsersPage, { preload: preloadUsers });
      route('/workspace/users/{id}', UserPage, { preload: preloadUser });
      route('/workspace/policies/{id}', PolicyPage, { preload: preloadPolicy });
    });
    route('/*', NotFoundPage);
  },
  {
    auth: {
      resolve: resolveBrowserAuth,
      loginPath: '/login',
      authenticatedRedirectTo: '/workspace',
    },
  },
);
