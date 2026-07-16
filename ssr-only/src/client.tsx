import { createSPA, hydrateSPA } from "@askrjs/askr/boot";
import { pageRegistry } from "./application/routes.js";
import "./styles.css";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app root element.");

// Adopt server markup when present, while keeping direct client rendering available.
if (root.hasChildNodes()) {
  await hydrateSPA({ root, registry: pageRegistry });
} else {
  await createSPA({ root, registry: pageRegistry });
}
