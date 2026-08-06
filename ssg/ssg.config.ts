import { pageRegistry } from "./src/routes.js";
import { renderDocument } from "./src/document.js";
import { withThemeStyles } from "@askrjs/themes/ssr";

export const outputDir = "./dist/static";
export const seed = 20260714;
export const siteUrl = "https://example.com";
export const staticConfig = {
  registry: pageRegistry,
  outputDir,
  seed,
  siteUrl,
  document: withThemeStyles(renderDocument),
  styleRegistrationValidation: "error" as const,
  concurrency: 1,
  assets: [
    {
      from: "./.askr/client/assets",
      to: "assets",
    },
  ],
} as const;
