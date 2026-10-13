import { createSPA, hydrateSPA } from "@askrjs/askr/boot";
import { readPublicConfig } from "./public-config.js";
import { createExampleRegistry } from "./registry.js";
import "./styles.css";
const root = document.getElementById("app");
if (!root) throw new Error("Missing #app root element");
let config;
try {
  config = readPublicConfig(document);
} catch (error) {
  root.replaceChildren();
  throw error;
}
const { registry, sessionAuth } = createExampleRegistry(config);
if (config.mode === "ssr") await hydrateSPA({ root, registry, auth: sessionAuth });
else await createSPA({ root, registry, auth: sessionAuth });
root.dataset.askrReady = "true";
