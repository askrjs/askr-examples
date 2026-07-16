import { createAuth } from "@askrjs/auth";
import { createAskrApp } from "@askrjs/server/askr";
import { accessLog, requestId, securityHeaders } from "@askrjs/server/middleware";
import type { AppDependencies } from "./boot/dependencies.js";
import { createActionHandlers } from "./boot/actions.js";
import { createQueryRegistry } from "./boot/queries.js";
import { createApplicationTelemetry, type ApplicationTelemetry } from "./boot/telemetry.js";
import { SESSION_COOKIE } from "./domains/sessions/repository.js";
import { pageRegistry } from "./application/routes.js";
import { apiSecuritySchemes, defineApi } from "./api.js";

export function createApp(
  deps: AppDependencies,
  telemetry: ApplicationTelemetry = createApplicationTelemetry(),
) {
  return createAskrApp({
    name: "Northstar Operations API and SSR",
    version: "1.0.0",
    dependencies: deps,
    pages: pageRegistry,
    queryRegistry: createQueryRegistry(deps),
    api: { prefix: "/api", securitySchemes: apiSecuritySchemes, define: defineApi },
    actions: {
      handlers: createActionHandlers(),
      csrf: { secret: "northstar-example-csrf-secret" },
    },
    auth: {
      resolver: createAuth({
        sessions: deps.sessions,
        principals: deps.principals,
        sessionCookie: SESSION_COOKIE,
      }),
    },
    middleware: [
      requestId(),
      securityHeaders({
        contentSecurityPolicy:
          "default-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:",
      }),
      accessLog(({ request, response, requestId }) =>
        deps.logger.write({
          method: request.method,
          path: new URL(request.url).pathname,
          status: response.status,
          requestId,
        }),
      ),
    ],
    probes: {
      livez: () => true,
      readyz: () => deps.users.ready(),
      startupz: () => true,
    },
    telemetry,
    onError: (_error, ctx) => ctx.internalServerError("The request could not be completed"),
  });
}
