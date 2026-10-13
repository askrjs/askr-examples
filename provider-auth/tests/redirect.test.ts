import { describe, expect, it } from "vite-plus/test";
import { safeReturnTo } from "../src/redirect.js";
describe("safe provider return paths", () => {
  it.each(["/account", "/account/details?a=1&a=2#panel", "/login?next=%2Faccount"])(
    "retains safe path/query/hash %s",
    (value) => {
      expect(safeReturnTo(value, "https://app.example.test")).toBe(value);
    },
  );
  it.each([
    undefined,
    null,
    "",
    "https://foreign.test",
    "//foreign.test",
    "/\\foreign.test",
    "/%5cforeign.test",
    "/%2f%2fforeign.test",
    "/https%3a/foreign.test",
    "/%2e%2e/secret",
    "/account?x=%00",
    "/account#%7f",
    "/%",
    "/\naccount",
  ])("rejects an unsafe target %j", (value) => {
    expect(safeReturnTo(value, "https://app.example.test")).toBe("/account");
  });
});
