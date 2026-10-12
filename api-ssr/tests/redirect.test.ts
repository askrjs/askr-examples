import { describe, expect, it } from "vitest";
import { safeNextPath } from "../src/features/session/redirect.js";

describe("safeNextPath", () => {
  it("should preserve a same-origin path, query, and fragment", () => {
    expect(safeNextPath("/workspace/users/1?tab=recent#activity", "https://example.test")).toBe(
      "/workspace/users/1?tab=recent#activity",
    );
  });

  it("should preserve traversal-like text in query values", () => {
    expect(safeNextPath("/workspace?path=/../reports#activity", "https://example.test")).toBe(
      "/workspace?path=/../reports#activity",
    );
  });

  it("should preserve encoded backslashes in query values", () => {
    expect(safeNextPath("/workspace?token=a%5Cb#activity", "https://example.test")).toBe(
      "/workspace?token=a%5Cb#activity",
    );
  });

  it.each([
    "//attacker.example",
    "///attacker.example",
    "/\\\\attacker.example",
    "https://attacker.example/path",
    "/workspace/../login",
    "/workspace/%2e%2e/login",
    "/%5c%5cattacker.example",
    "workspace",
  ])("should fall back for unsafe or non-path values: %s", (next) => {
    expect(safeNextPath(next, "https://example.test")).toBe("/workspace");
  });
});
