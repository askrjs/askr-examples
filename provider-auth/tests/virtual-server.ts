import type { AskrApp } from "@askrjs/server/askr";
/** Unit-only module identity for the production document boundary; every caller must provide its explicit mock. */
export const app: Pick<AskrApp, "fetch"> = {
  async fetch() {
    throw new Error("Production document unit tests require the explicit composed owner mock");
  },
};
export default app;
