import { createApp } from '../app.js';
import { createDependencies } from '../boot/dependencies.js';
import { createApplicationTelemetry } from '../boot/telemetry.js';

// Create dependencies once at the server composition root, not inside handlers.
const telemetry = createApplicationTelemetry();
const app = createApp(createDependencies(), telemetry);

export { app, telemetry };
export default app;
