import { requireAnonymous, requirePermission, requireUser } from "@askrjs/auth";
import { createRouteRegistry, defer, group, route } from "@askrjs/askr/router";
import type { QueryPrefetchContext } from "@askrjs/askr/data";
import { dashboardQuery, policyQuery, userQuery, usersQuery } from "../domains/queries.js";
import { updateUserNameAction } from "../domains/users/actions.js";
import { ActivityPage, NotFoundPage, OverviewPage } from "./pages.js";
import { resolveBrowserAuth } from "./client-auth.js";
import {
  DashboardPage,
  DeferredFailurePage,
  DeferredPage,
  LocalePage,
  LoginPage,
  PolicyPage,
  UserPage,
  UsersPage,
  WorkspaceLayout,
} from "./workspace-pages.js";

export const baseRoutePaths = ["/", "/activity", "/*"] as const;

const overviewMeta = {
  title: "Northstar Operations",
  description: "Operational health and recent activity.",
  html: { lang: "en", dir: "ltr" as const },
};
const activityMeta = {
  title: "Activity · Northstar Operations",
  description: "Recent deployment, access, and policy events.",
  html: { lang: "en", dir: "ltr" as const },
};

const preloadDashboard = ({ data }: { data: QueryPrefetchContext }) =>
  data.prefetch(dashboardQuery, {});
const preloadUsers = ({ data }: { data: QueryPrefetchContext }) => data.prefetch(usersQuery, {});
const preloadUser = ({ params, data }: { params: { id: string }; data: QueryPrefetchContext }) =>
  data.prefetch(userQuery, { id: params.id });
const preloadPolicy = ({ params, data }: { params: { id: string }; data: QueryPrefetchContext }) =>
  data.prefetch(policyQuery, { id: params.id });
function delayedMessage(signal: AbortSignal, fail = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const abort = (): void => {
      clearTimeout(timer);
      reject(new DOMException("Deferred route was aborted.", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      if (fail) reject(new Error("demo rejection"));
      else resolve("Deferred workspace data is ready.");
    }, 250);
    signal.addEventListener("abort", abort, { once: true });
  });
}
const deferredSuccess = ({ signal }: { signal: AbortSignal }) => ({
  message: defer(delayedMessage(signal)),
});
const deferredFailure = ({ signal }: { signal: AbortSignal }) => ({
  message: defer(delayedMessage(signal, true)),
});

export const pageRegistry = createRouteRegistry(
  () => {
    // These public routes carry forward from the SSR stage; add full-stack routes between them and the fallback.
    route("/", OverviewPage, { meta: overviewMeta });
    route("/activity", ActivityPage, { meta: activityMeta });
    route("/login", LoginPage, { auth: requireAnonymous() });
    group({ layout: WorkspaceLayout, auth: requireUser() }, () => {
      // Register additional protected workspace routes here.
      route("/workspace", DashboardPage, { preload: preloadDashboard });
      route("/workspace/users", UsersPage, { preload: preloadUsers });
      route("/workspace/locale", LocalePage, {
        meta: {
          title: "Language · Northstar Operations",
          html: { lang: "en", dir: "ltr" },
        },
      });
      route("/workspace/deferred", DeferredPage, { loader: deferredSuccess });
      route("/workspace/deferred-failure", DeferredFailurePage, { loader: deferredFailure });
      route("/workspace/users/{id}", UserPage, {
        preload: preloadUser,
        auth: requirePermission("users:write"),
        actions: [updateUserNameAction],
      });
      route("/workspace/policies/{id}", PolicyPage, { preload: preloadPolicy });
    });
    route("/*", NotFoundPage);
  },
  {
    auth: {
      resolve: resolveBrowserAuth,
      loginPath: "/login",
      authenticatedRedirectTo: "/workspace",
    },
  },
);
