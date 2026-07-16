import { createRouteRegistry, route } from "@askrjs/askr/router";
import { ActivityPage, NotFoundPage, OverviewPage } from "./pages.js";

export const baseRoutePaths = ["/", "/activity", "/*"] as const;

const overviewMeta = {
  title: "Northstar Operations",
  description: "Operational health and recent activity.",
  html: { lang: "en", dir: "ltr" as const },
};
const activityMeta = {
  title: "Activity · Northstar Operations",
  description: "Recent deployment, access, and policy events.",
  html: { lang: "en", dir: "ltr" as const },
};

export const pageRegistry = createRouteRegistry(() => {
  // Register additional application routes here.
  route("/", OverviewPage, { meta: overviewMeta });
  route("/activity", ActivityPage, { meta: activityMeta });
  route("/*", NotFoundPage);
});
