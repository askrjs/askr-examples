import { describe, expect, it } from "vite-plus/test";
import { readProviderEnvironment } from "../src/server/environment.js";

const secret = Buffer.alloc(32, 7).toString("base64url");
function environment(provider = "auth0"): Record<string, string> {
  return {
    ASKR_PROVIDER: provider,
    ASKR_ORIGIN: "https://app.example.test:3443",
    ASKR_SESSION_SECRETS: secret,
    ASKR_ACTION_CSRF_SECRET: "application-owned-action-csrf-secret",
    ASKR_TLS_CERT_PATH: "/local/certificate.pem",
    ASKR_TLS_KEY_PATH: "/local/key.pem",
    AUTH0_DOMAIN: "tenant.example.test",
    AUTH0_CLIENT_ID: "auth0-client",
    AUTH0_CLIENT_SECRET: "auth0-private-secret",
    MICROSOFT_TENANT_ID: "01234567-89ab-cdef-0123-456789abcdef",
    MICROSOFT_CLIENT_ID: "microsoft-client",
    MICROSOFT_CLIENT_SECRET: "microsoft-private-secret",
    GOOGLE_CLIENT_ID: "google-client",
    GOOGLE_CLIENT_SECRET: "google-private-secret",
    APPLE_SERVICES_ID: "test.example.signin",
    APPLE_TEAM_ID: "TEAM123456",
    APPLE_KEY_ID: "KEY1234567",
    APPLE_PRIVATE_KEY_PATH: "/local/apple.p8",
  };
}

describe("explicit provider application configuration", () => {
  it.each(["auth0", "microsoft", "google", "apple"])(
    "selects %s without inspecting unrelated credentials",
    (provider) => {
      const env = environment(provider);
      for (const key of Object.keys(env)) {
        if (
          /^(AUTH0|MICROSOFT|GOOGLE|APPLE)_/.test(key) &&
          !key.startsWith(`${provider.toUpperCase()}_`)
        )
          delete env[key];
      }
      expect(readProviderEnvironment(env)).toMatchObject({
        provider,
        mode: "ssr",
        origin: "https://app.example.test:3443",
        listenPort: 3443,
        sessionSecrets: [secret],
      });
    },
  );

  it.each(["ssr", "spa"])("selects %s rendering explicitly", (mode) => {
    expect(readProviderEnvironment({ ...environment(), ASKR_RENDER_MODE: mode }).mode).toBe(mode);
  });

  it.each(["", "oidc", "Auth0", "../../secret"])("rejects an unknown provider %j", (provider) => {
    expect(() => readProviderEnvironment(environment(provider))).toThrow("ASKR_PROVIDER");
  });

  it("rejects an unknown render mode", () => {
    expect(() => readProviderEnvironment({ ...environment(), ASKR_RENDER_MODE: "ssg" })).toThrow(
      "ASKR_RENDER_MODE",
    );
  });

  it("keeps the public Apple tunnel origin separate from the local HTTPS listener", () => {
    expect(
      readProviderEnvironment({
        ...environment("apple"),
        ASKR_ORIGIN: "https://signin.example.test",
      }),
    ).toMatchObject({
      origin: "https://signin.example.test",
      listenPort: 3443,
    });
  });

  it("uses an explicitly configured local listening port without changing the callback origin", () => {
    expect(
      readProviderEnvironment({
        ...environment(),
        ASKR_ORIGIN: "https://app.example.test",
        ASKR_LISTEN_PORT: "8443",
      }),
    ).toMatchObject({
      origin: "https://app.example.test",
      listenPort: 8443,
    });
  });

  it.each(["", "0", "-1", "65536", "3443.5", "https", " 3443 "])(
    "rejects an invalid listening port %j",
    (listenPort) => {
      expect(() =>
        readProviderEnvironment({ ...environment(), ASKR_LISTEN_PORT: listenPort }),
      ).toThrow("ASKR_LISTEN_PORT");
    },
  );

  it.each([
    "http://app.example.test:3443",
    "https://name:password@app.example.test:3443",
    "https://app.example.test:3443/private",
    "https://app.example.test:3443/?secret=value",
    "https://app.example.test:3443/#private",
    "https://app.example.test:3443/?",
    "https://app.example.test:3443/#",
    "https://app.example.test:3443/private/..",
    "https://@app.example.test:3443",
    "https://app.example.test:3443/\n",
  ])("requires a single HTTPS origin: %s", (origin) => {
    expect(() => readProviderEnvironment({ ...environment(), ASKR_ORIGIN: origin })).toThrow(
      "ASKR_ORIGIN",
    );
  });

  it.each([
    "https://localhost:3443",
    "https://localhost.:3443",
    "https://app.localhost.:3443",
    "https://127.0.0.1:3443",
    "https://[::1]:3443",
  ])("rejects Apple live loopback origins: %s", (origin) => {
    expect(() => readProviderEnvironment({ ...environment("apple"), ASKR_ORIGIN: origin })).toThrow(
      "ASKR_ORIGIN",
    );
  });

  it.each([
    "ASKR_SESSION_SECRETS",
    "ASKR_ACTION_CSRF_SECRET",
    "ASKR_TLS_CERT_PATH",
    "ASKR_TLS_KEY_PATH",
    "AUTH0_CLIENT_SECRET",
  ])("requires %s without disclosing other secrets", (key) => {
    const env = environment();
    env[key] = "";
    let message = "";
    try {
      readProviderEnvironment(env);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain(key);
    expect(message).not.toContain(env.AUTH0_CLIENT_SECRET || "auth0-private-secret");
    expect(message).not.toContain(secret);
  });

  it("retains the ordered current and previous encryption keys", () => {
    const previous = Buffer.alloc(32, 8).toString("base64url");
    expect(
      readProviderEnvironment({ ...environment(), ASKR_SESSION_SECRETS: `${secret},${previous}` })
        .sessionSecrets,
    ).toEqual([secret, previous]);
  });

  it("limits the rotation key set even when every key is different", () => {
    const keys = [1, 2, 3, 4, 5].map((byte) => Buffer.alloc(32, byte).toString("base64url"));
    expect(() =>
      readProviderEnvironment({ ...environment(), ASKR_SESSION_SECRETS: keys.join(",") }),
    ).toThrow("ASKR_SESSION_SECRETS");
  });

  it("does not read malformed unrelated provider configuration", () => {
    const env = {
      ...environment("microsoft"),
      AUTH0_DOMAIN: "bad domain",
      AUTH0_API_URL: "http://bad.example.test",
      APPLE_PRIVATE_KEY_PATH: "",
      GOOGLE_CLIENT_SECRET: "",
    };
    expect(readProviderEnvironment(env).provider).toBe("microsoft");
  });

  it.each(["MICROSOFT_CLIENT_SECRET", "GOOGLE_CLIENT_SECRET", "APPLE_PRIVATE_KEY_PATH"])(
    "requires the selected provider credential %s",
    (key) => {
      const provider = key.split("_")[0].toLowerCase();
      expect(() => readProviderEnvironment({ ...environment(provider), [key]: "" })).toThrow(key);
    },
  );

  it.each(["demo", " ", `${secret},${secret}`, Array(5).fill(secret).join(",")])(
    "rejects malformed or repeated encryption keys",
    (keys) => {
      expect(() =>
        readProviderEnvironment({ ...environment(), ASKR_SESSION_SECRETS: keys }),
      ).toThrow("ASKR_SESSION_SECRETS");
    },
  );

  it("requires the complete Auth0 API configuration when an audience is supplied", () => {
    expect(() =>
      readProviderEnvironment({ ...environment(), AUTH0_API_AUDIENCE: "https://api.example.test" }),
    ).toThrow("AUTH0_API_");
  });

  it("rejects non-HTTPS Auth0 server API endpoints", () => {
    expect(() =>
      readProviderEnvironment({
        ...environment(),
        AUTH0_API_AUDIENCE: "urn:example:api",
        AUTH0_API_SCOPES: "read:profile",
        AUTH0_API_URL: "http://api.example.test/profile",
      }),
    ).toThrow("AUTH0_API_URL");
  });

  it("keeps the exact Auth0 audience and configured scopes", () => {
    expect(
      readProviderEnvironment({
        ...environment(),
        AUTH0_API_AUDIENCE: "urn:example:api",
        AUTH0_API_SCOPES: "read:profile read:summary",
        AUTH0_API_URL: "https://api.example.test/profile",
      }),
    ).toMatchObject({
      api: {
        resource: "urn:example:api",
        scopes: ["read:profile", "read:summary"],
        url: "https://api.example.test/profile",
      },
    });
  });

  it("uses the explicit Microsoft Graph resource and qualified permission", () => {
    expect(readProviderEnvironment(environment("microsoft"))).toMatchObject({
      api: {
        resource: "https://graph.microsoft.com",
        scopes: ["https://graph.microsoft.com/User.Read"],
        url: "https://graph.microsoft.com/v1.0/me?$select=displayName",
      },
    });
  });

  it("uses the narrow Google calendar-list permission", () => {
    expect(readProviderEnvironment(environment("google"))).toMatchObject({
      api: {
        resource: "https://www.googleapis.com",
        scopes: ["https://www.googleapis.com/auth/calendar.calendarlist.readonly"],
        url: "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      },
    });
  });

  it("does not invent an Apple API bearer-token target", () => {
    expect(readProviderEnvironment(environment("apple")).api).toBeUndefined();
  });
});
