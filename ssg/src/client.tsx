import "@askrjs/themes/default";
import { hydrateSPA } from "@askrjs/askr/boot";
import { pageRegistry } from "./routes.js";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app root");

await hydrateSPA({ root, registry: pageRegistry });
root.dataset.askrReady = "true";
