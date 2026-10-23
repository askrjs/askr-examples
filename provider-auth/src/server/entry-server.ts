import { readProviderEnvironment } from "./environment.js";
import { createExampleApp } from "./app.js";
export const environment = readProviderEnvironment(process.env);
const application = await createExampleApp(environment);
export const app = application.app;
export default app;
