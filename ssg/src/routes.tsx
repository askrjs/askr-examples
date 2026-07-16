import { createRouteRegistry, route } from "@askrjs/askr/router";
import { runbooks } from "./data.js";
import { HomePage, RunbookPage } from "./pages.js";

export const pageRegistry = createRouteRegistry(() => {
  // Register static pages here; entries expands parameterized routes at build time.
  route("/", HomePage, { title: "Northstar Runbooks" });
  route("/runbooks/{slug}", RunbookPage, {
    title: "Operations Runbook",
    entries: () => runbooks.map(({ slug }) => ({ slug })),
  });
});
