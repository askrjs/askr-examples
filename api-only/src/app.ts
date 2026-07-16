import { createServerApp } from "@askrjs/server";
import { accessLog, requestId, securityHeaders } from "@askrjs/server/middleware";
import type { AppDependencies } from "./boot/dependencies.js";
import api from "./api.js";

export function createApp(deps: AppDependencies) {
  return createServerApp({
    router: api.createRouter(deps),
    middleware: [
      requestId(),
      securityHeaders(),
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
    onError: (_error, ctx) => ctx.internalServerError("The request could not be completed"),
  });
}
