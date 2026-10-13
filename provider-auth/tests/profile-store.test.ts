import { describe, expect, it } from "vite-plus/test";
import { createDisplayProfiles } from "../src/server/profile-store.js";
describe("bounded display hints", () => {
  it("keeps hint data separate from authority and expires it absolutely", () => {
    let now = 0;
    const store = createDisplayProfiles(() => now);
    store.remember(
      "principal",
      { email: "signed@test", email_verified: true, roles: ["never-copy"] },
      { givenName: "Unsigned", familyName: "Hint" },
    );
    expect(store.label("principal")).toBe("Unsigned Hint");
    now += 8 * 60 * 60 * 1000;
    expect(store.label("principal")).toBeUndefined();
  });
  it("bounds storage and only falls back to validated email", () => {
    const store = createDisplayProfiles(() => 0);
    store.remember("unverified", { email: "private@test", email_verified: false });
    expect(store.label("unverified")).toBeUndefined();
    for (let index = 0; index < 1001; index++)
      store.remember(String(index), { email: "confirmed@test", email_verified: true });
    expect(store.label("0")).toBeUndefined();
    expect(store.label("1000")).toBe("confirmed@test");
    store.close();
    expect(store.label("1000")).toBeUndefined();
  });
});
