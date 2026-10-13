import composed from "virtual:askr-server";
import raw, { environment } from "./entry-server.js";
import { withApplicationLifecycle } from "./compose.js";
export { environment };
export { startHttps } from "./https.js";
export const app = withApplicationLifecycle(composed, raw, {
  provider: environment.provider,
  mode: environment.mode,
});
export default app;
