import { createSPA, hydrateSPA } from "@askrjs/askr/boot";
import { pageRegistry } from "./application/routes.js";
import "./styles.css";
import "@askrjs/charts/default";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app root element.");

// Adopt prefetched SSR markup when present, while retaining direct client rendering.
if (root.hasChildNodes()) {
  await hydrateSPA({ root, registry: pageRegistry });
} else {
  await createSPA({ root, registry: pageRegistry });
}
