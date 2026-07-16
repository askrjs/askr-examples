import { afterEach, describe, expect, it } from "vitest";
import { createSPA } from "@askrjs/askr/boot";
import { pageRegistry } from "../src/application/routes.js";

describe("SPA operations workspace", () => {
  afterEach(() => {
    document.body.replaceChildren();
    window.history.replaceState(null, "", "/");
  });

  it("should retain the base journey routes and not-found behavior", () => {
    expect(new Set(pageRegistry.manifest.records.map((record) => record.path))).toEqual(
      new Set(["/", "/activity", "/*"]),
    );
  });

  it("should filter deterministic activity given a client interaction", async () => {
    window.history.replaceState(null, "", "/activity");
    const root = document.createElement("div");
    root.id = "app";
    document.body.append(root);

    await createSPA({ root, registry: pageRegistry });
    const deployment = [...root.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "deployment",
    );
    expect(root.querySelectorAll('[data-testid="activity-list"] li')).toHaveLength(4);

    deployment?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(root.querySelectorAll('[data-testid="activity-list"] li')).toHaveLength(2);
    expect(root.textContent).toContain("Production deployment completed");
    expect(root.textContent).not.toContain("Workspace member invited");
  });
});
