import {
  createRouteRegistry,
  createSessionAuth,
  currentAuth,
  currentRoute,
  Link,
  route,
} from "@askrjs/askr/router";
import { createQuery } from "@askrjs/askr/data";
import { action } from "@askrjs/askr/actions";
import { state } from "@askrjs/askr";
import { requireUser } from "@askrjs/auth";
import { readProviderAction, actionCsrf, actionProblem, type ProviderSummary } from "./actions.js";
import { privateQuery } from "./private-query.js";
import { safeReturnTo } from "./redirect.js";
import type { PublicConfig } from "./public-config.js";

export function createExampleRegistry(config: PublicConfig) {
  const sessionAuth = createSessionAuth({ loginPath: "/login" });
  function Home() {
    return (
      <main>
        <h1>Northstar provider sessions</h1>
        <p>One server authority, four explicit providers.</p>
        <Link href="/account">Open private account</Link>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }
  function Login() {
    const location = currentRoute();
    const next = safeReturnTo(location.query.get("next"), "https://askr.invalid");
    // Google and Auth0 request API consent only after a server-owned action needs it.
    const href = sessionAuth.loginHref(config.provider, {
      returnTo: next,
      ...(config.provider === "microsoft" && config.api
        ? { resource: config.api.resource, scopes: config.api.scopes }
        : {}),
    });
    return (
      <main>
        <h1>Sign in to Northstar</h1>
        <p>
          Provider: <span data-testid="provider">{config.provider}</span>
        </p>
        <a data-testid="sign-in" href={href}>
          Continue with {config.provider}
        </a>
        <Link href="/">Home</Link>
      </main>
    );
  }
  function Account() {
    const query = createQuery(privateQuery, {});
    const operation = action<Record<string, never>, ProviderSummary>(readProviderAction, {
      csrfToken: actionCsrf,
    });
    const status = state("");
    const auth = currentAuth();
    const submit = async (event: Event) => {
      event.preventDefault();
      try {
        await operation.submit({});
      } catch (error) {
        if (!sessionAuth.handleAuthFailure(actionProblem(error)))
          status.set("The provider operation could not be completed.");
      }
    };
    const refresh = async () => {
      try {
        await query.refresh();
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError"))
          status.set("Private query refresh failed.");
      }
    };
    const logout = async () => {
      try {
        await sessionAuth.logout();
      } catch {
        status.set("Sign out could not be confirmed. Reload before retrying.");
      }
    };
    return (
      <main data-testid="private-owner">
        <h1>Private account</h1>
        <p data-testid="subject">{auth.principal?.subject ?? "Signed-in identity"}</p>
        <p data-testid="private-query">
          {query.loading
            ? "Loading private query…"
            : (query.data?.message ?? "Private query is unavailable")}
        </p>
        <Link href="/account/details">Account details</Link>
        <Link href="/account">Account overview</Link>
        <button data-testid="reload-private" onClick={refresh}>
          Reload private query
        </button>
        <form onSubmit={submit}>
          <button data-testid="provider-action" type="submit" disabled={operation.state().pending}>
            Run server operation
          </button>
        </form>
        {operation.state().result ? (
          <p role="status" data-testid="provider-result">
            {operation.state().result?.message}
          </p>
        ) : null}
        <button data-testid="logout" onClick={logout}>
          Sign out locally
        </button>
        <p role="alert">{status()}</p>
      </main>
    );
  }
  const registry = createRouteRegistry(
    () => {
      route("/", Home);
      route("/login", Login);
      for (const path of ["/account", "/account/details"])
        route(path, Account, {
          auth: requireUser(),
          actions: [readProviderAction],
          preload: ({ data }) => data.prefetch(privateQuery, {}),
        });
      route("/*", () => (
        <main>
          <h1>Page not found</h1>
          <Link href="/">Home</Link>
        </main>
      ));
    },
    { auth: sessionAuth },
  );
  return Object.freeze({ registry, sessionAuth });
}
