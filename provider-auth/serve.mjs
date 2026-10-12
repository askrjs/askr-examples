import { app, environment, startHttps } from "./dist/server/production.js";
const serving = await startHttps(app, environment);
console.log(`Provider application listening at ${environment.origin}`);
let closing;
function stop() {
  closing ??= serving.close().then(
    () => {
      process.exitCode = 0;
    },
    () => {
      console.error("Provider application shutdown failed");
      process.exitCode = 1;
    },
  );
  return closing;
}
process.once("SIGTERM", () => {
  void stop();
});
process.once("SIGINT", () => {
  void stop();
});
