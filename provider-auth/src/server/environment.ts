import { isIP } from "node:net";

export interface ProviderApi {
  readonly resource: string;
  readonly scopes: readonly string[];
  readonly url: string;
}

interface ApplicationEnvironment {
  readonly mode: "ssr" | "spa";
  readonly origin: string;
  readonly listenPort: number;
  readonly sessionSecrets: readonly string[];
  readonly actionCsrfSecret: string;
  readonly tls: {
    readonly certPath: string;
    readonly keyPath: string;
  };
  readonly api?: ProviderApi;
}

export type ProviderEnvironment = ApplicationEnvironment &
  (
    | {
        readonly provider: "auth0";
        readonly credentials: {
          readonly domain: string;
          readonly clientId: string;
          readonly clientSecret: string;
          readonly organization?: string;
        };
      }
    | {
        readonly provider: "microsoft";
        readonly credentials: {
          readonly tenantId: string;
          readonly clientId: string;
          readonly clientSecret: string;
        };
      }
    | {
        readonly provider: "google";
        readonly credentials: {
          readonly clientId: string;
          readonly clientSecret: string;
          readonly hostedDomain?: string;
        };
      }
    | {
        readonly provider: "apple";
        readonly credentials: {
          readonly servicesId: string;
          readonly teamId: string;
          readonly keyId: string;
          readonly privateKeyPath: string;
        };
      }
  );

/** Read server-only configuration. Error messages name keys and never values. */
export function readProviderEnvironment(
  env: Readonly<Record<string, string | undefined>>,
): ProviderEnvironment {
  const provider = env.ASKR_PROVIDER;
  if (
    provider !== "auth0" &&
    provider !== "microsoft" &&
    provider !== "google" &&
    provider !== "apple"
  ) {
    throw new Error("ASKR_PROVIDER must select auth0, microsoft, google or apple");
  }
  const mode = env.ASKR_RENDER_MODE ?? "ssr";
  if (mode !== "ssr" && mode !== "spa") {
    throw new Error("ASKR_RENDER_MODE must select ssr or spa");
  }
  const publicOrigin = required(env, "ASKR_ORIGIN");
  const publicUrl = httpsUrl(publicOrigin, "ASKR_ORIGIN");
  if (
    !/^https:\/\/[^/\\?#\s]+\/?$/i.test(publicOrigin) ||
    publicUrl.pathname !== "/" ||
    publicUrl.search ||
    publicUrl.hash
  ) {
    throw new Error("ASKR_ORIGIN must contain only an HTTPS origin");
  }
  const hostname = publicUrl.hostname.replace(/^\[|\]$/g, "").replace(/\.+$/, "");
  if (
    provider === "apple" &&
    (isIP(hostname) !== 0 || hostname === "localhost" || hostname.endsWith(".localhost"))
  ) {
    throw new Error("ASKR_ORIGIN requires a registered public hostname for Apple");
  }
  const listenPort = env.ASKR_LISTEN_PORT ?? "3443";
  if (!/^[1-9][0-9]{0,4}$/.test(listenPort) || Number(listenPort) > 65535) {
    throw new Error("ASKR_LISTEN_PORT must be a port from 1 to 65535");
  }
  const sessionSecrets = required(env, "ASKR_SESSION_SECRETS").split(",");
  if (
    sessionSecrets.length > 4 ||
    new Set(sessionSecrets).size !== sessionSecrets.length ||
    sessionSecrets.some((secret) => !isSessionSecret(secret))
  ) {
    throw new Error(
      "ASKR_SESSION_SECRETS must contain one to four distinct 32-byte base64url keys in rotation order",
    );
  }
  const common: ApplicationEnvironment = {
    mode,
    origin: publicUrl.origin,
    listenPort: Number(listenPort),
    sessionSecrets,
    actionCsrfSecret: required(env, "ASKR_ACTION_CSRF_SECRET"),
    tls: {
      certPath: required(env, "ASKR_TLS_CERT_PATH"),
      keyPath: required(env, "ASKR_TLS_KEY_PATH"),
    },
  };
  switch (provider) {
    case "auth0": {
      const apiKeys = ["AUTH0_API_AUDIENCE", "AUTH0_API_SCOPES", "AUTH0_API_URL"] as const;
      const hasApi = apiKeys.some((key) => env[key] !== undefined);
      return {
        ...common,
        provider,
        credentials: {
          domain: required(env, "AUTH0_DOMAIN"),
          clientId: required(env, "AUTH0_CLIENT_ID"),
          clientSecret: required(env, "AUTH0_CLIENT_SECRET"),
          ...(env.AUTH0_ORGANIZATION === undefined
            ? {}
            : { organization: required(env, "AUTH0_ORGANIZATION") }),
        },
        ...(hasApi
          ? {
              api: {
                resource: resource(required(env, "AUTH0_API_AUDIENCE"), "AUTH0_API_AUDIENCE"),
                scopes: scopes(required(env, "AUTH0_API_SCOPES"), "AUTH0_API_SCOPES"),
                url: httpsUrl(required(env, "AUTH0_API_URL"), "AUTH0_API_URL").href,
              },
            }
          : {}),
      };
    }
    case "microsoft":
      return {
        ...common,
        provider,
        credentials: {
          tenantId: required(env, "MICROSOFT_TENANT_ID"),
          clientId: required(env, "MICROSOFT_CLIENT_ID"),
          clientSecret: required(env, "MICROSOFT_CLIENT_SECRET"),
        },
        api: {
          resource: "https://graph.microsoft.com",
          scopes: ["https://graph.microsoft.com/User.Read"],
          url: "https://graph.microsoft.com/v1.0/me?$select=displayName",
        },
      };
    case "google":
      return {
        ...common,
        provider,
        credentials: {
          clientId: required(env, "GOOGLE_CLIENT_ID"),
          clientSecret: required(env, "GOOGLE_CLIENT_SECRET"),
          ...(env.GOOGLE_HOSTED_DOMAIN === undefined
            ? {}
            : { hostedDomain: required(env, "GOOGLE_HOSTED_DOMAIN") }),
        },
        api: {
          resource: "https://www.googleapis.com",
          scopes: ["https://www.googleapis.com/auth/calendar.calendarlist.readonly"],
          url: "https://www.googleapis.com/calendar/v3/users/me/calendarList",
        },
      };
    case "apple":
      return {
        ...common,
        provider,
        credentials: {
          servicesId: required(env, "APPLE_SERVICES_ID"),
          teamId: required(env, "APPLE_TEAM_ID"),
          keyId: required(env, "APPLE_KEY_ID"),
          privateKeyPath: required(env, "APPLE_PRIVATE_KEY_PATH"),
        },
      };
  }
}

function required(env: Readonly<Record<string, string | undefined>>, key: string): string {
  const value = env[key];
  if (value === undefined || value.length === 0 || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function httpsUrl(value: string, key: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${key} must be an HTTPS URL`);
  }
  if (
    /[\x00-\x20\x7f]/.test(value) ||
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    /^https:\/\/[^/?#]*@/i.test(value) ||
    value.includes("#")
  ) {
    throw new Error(`${key} must be an HTTPS URL without credentials`);
  }
  return parsed;
}

function isSessionSecret(value: string): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return false;
  const bytes = Buffer.from(value, "base64url");
  return bytes.length === 32 && bytes.toString("base64url") === value;
}

function resource(value: string, key: string): string {
  if (value.length > 2048 || !/^[\x21-\x7e]+$/.test(value)) {
    throw new Error(`${key} must be a nonempty resource identifier`);
  }
  return value;
}

function scopes(value: string, key: string): readonly string[] {
  const parts = value.split(" ");
  if (
    parts.length > 32 ||
    parts.some((part) => !/^[\x21\x23-\x5b\x5d-\x7e]+$/.test(part)) ||
    new Set(parts).size !== parts.length
  ) {
    throw new Error(`${key} must contain distinct space-separated OAuth scopes`);
  }
  return parts;
}
