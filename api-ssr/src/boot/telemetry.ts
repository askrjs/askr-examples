import { createTelemetry } from "@askrjs/otel";

/**
 * Connect an SDK/provider at the production composition root when the
 * application needs exported spans. The package itself installs no backend.
 */
export function createApplicationTelemetry() {
  return createTelemetry({ tracerName: "@askrjs/example-api-ssr" });
}

export type ApplicationTelemetry = ReturnType<typeof createApplicationTelemetry>;
