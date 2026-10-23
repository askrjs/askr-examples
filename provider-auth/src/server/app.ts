import { createAskrApp, handleAction } from "@askrjs/server/askr";
import { createCsrfToken, securityHeaders } from "@askrjs/server/middleware";
import { defineServerQueries, serveQuery } from "@askrjs/askr/data";
import { requireUser } from "@askrjs/auth";
import { security } from "@askrjs/server/openapi";
import { examplePublicConfig } from "../public-config.js";
import { schema } from "@askrjs/schema";
import { createExampleRegistry } from "../registry.js";
import { readProviderAction } from "../actions.js";
import { privateValue } from "../private-query.js";
import { selectedProvider } from "./providers.js";
import { createDisplayProfiles } from "./profile-store.js";
import type { ProviderEnvironment } from "./environment.js";
import type { Middleware } from "@askrjs/server";

/** Application services are explicit server-owned dependencies; production uses native fetch/clock. */
export interface ApplicationServices {
  readonly fetch?: typeof globalThis.fetch;
  readonly clock?: () => number;
}
export async function createExampleApp(
  env: ProviderEnvironment,
  services: ApplicationServices = {},
) {
  const transport = services.fetch ?? globalThis.fetch;
  const clock = services.clock ?? Date.now;
  const provider = await selectedProvider(env);
  const profiles = createDisplayProfiles(clock);
  const publicConfig = examplePublicConfig(env.provider, env.mode);
  const { registry, sessionAuth, privateQuery } = createExampleRegistry(publicConfig);
  const spaDocument: Middleware = async (context, next) => {
    if (
      env.mode === "spa" &&
      ["GET", "HEAD"].includes(context.request.method) &&
      ["/", "/login", "/account", "/account/details"].includes(context.url.pathname)
    )
      return new Response(null, {
        headers: {
          "content-type": "text/html; charset=utf-8; askr-fragment=1",
          "cache-control": "no-store",
        },
      });
    return next();
  };
  const app = createAskrApp({
    name: "Northstar provider sessions",
    version: "1.0.0",
    dependencies: { env, transport, profiles },
    pages: registry,
    auth: {
      origin: env.origin,
      providers: [provider],
      session: { secrets: env.sessionSecrets },
      clock,
      fetch: transport,
      onSignIn({ principal, profileHint }) {
        profiles.remember(principal.id, principal, profileHint);
      },
    },
    queryRegistry: defineServerQueries(serveQuery(privateQuery, () => privateValue)),
    api: {
      securitySchemes: { providerSession: security.apiKey("__Host-askr-session", "cookie") },
      define(api) {
        api
          .get("/action-csrf", async (context) =>
            context.json(
              context.auth.authenticated && context.auth.session
                ? {
                    csrfToken: await createCsrfToken(env.actionCsrfSecret, context.auth.session.id),
                  }
                : {},
              { headers: { "cache-control": "no-store" } },
            ),
          )
          .operationId("actionCsrf")
          .ok(schema.object({ csrfToken: schema.optional(schema.string()) }));
        api
          .get("/private", (context) =>
            context.json(privateValue, { headers: { "cache-control": "no-store" } }),
          )
          .operationId("privateQuery")
          .access(requireUser(), security.require("providerSession"))
          .ok(schema.object({ message: schema.string() }));
      },
    },
    actions: {
      csrf: { secret: env.actionCsrfSecret },
      handlers: [
        handleAction(readProviderAction, async (context) => {
          if (!context.auth.principal) throw new Error("A signed-in identity is required");
          if (!env.api)
            return {
              result: {
                message:
                  profiles.label(context.auth.principal.id) ??
                  "The server confirmed the provider identity.",
              },
            };
          const token = await context.auth.token(env.provider, {
            resource: env.api.resource,
            scopes: env.api.scopes,
            signal: context.signal,
          });
          const response = await transport(env.api.url, {
            headers: { authorization: `Bearer ${token}`, accept: "application/json" },
            redirect: "error",
            signal: context.signal,
          });
          if (!response.ok) throw new Error("The provider API could not be completed");
          // Display an application-owned outcome; neither arbitrary upstream bodies nor bearer tokens cross the boundary.
          await response.body?.cancel();
          return { result: { message: "The provider API accepted the server-owned permission." } };
        }),
      ],
    },
    middleware: [
      securityHeaders({
        contentSecurityPolicy:
          "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'",
      }),
      spaDocument,
    ],
    close: () => profiles.close(),
  });
  return Object.freeze({ app, registry, sessionAuth, publicConfig });
}
