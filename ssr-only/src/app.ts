import { createAskrApp } from "@askrjs/server/askr";
import { pageRegistry } from "./application/routes.js";

export function createApp() {
  return createAskrApp({
    name: "Northstar SSR",
    version: "0.0.1",
    dependencies: undefined,
    pages: pageRegistry,
  });
}
