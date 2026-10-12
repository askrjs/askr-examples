import { readFile } from "node:fs/promises";
import { createPrivateKey } from "node:crypto";
import { createAuth0Provider } from "@askrjs/auth/providers/auth0";
import { createMicrosoftProvider } from "@askrjs/auth/providers/microsoft";
import { createGoogleProvider } from "@askrjs/auth/providers/google";
import { createAppleProvider } from "@askrjs/auth/providers/apple";
import type { ProviderEnvironment } from "./environment.js";
export async function selectedProvider(env: ProviderEnvironment) {
  const resources = env.api ? [{ resource: env.api.resource, scopes: env.api.scopes }] : [];
  switch (env.provider) {
    case "auth0":
      return createAuth0Provider({ id: "auth0", ...env.credentials, resources });
    case "microsoft":
      return createMicrosoftProvider({ id: "microsoft", ...env.credentials, resources });
    case "google":
      return createGoogleProvider({ id: "google", ...env.credentials, resources });
    case "apple": {
      let privateKey: JsonWebKey;
      try {
        privateKey = createPrivateKey(await readFile(env.credentials.privateKeyPath)).export({
          format: "jwk",
        });
      } catch {
        throw new Error("APPLE_PRIVATE_KEY_PATH must contain a server-readable P-256 private key");
      }
      return createAppleProvider({
        id: "apple",
        servicesId: env.credentials.servicesId,
        teamId: env.credentials.teamId,
        keyId: env.credentials.keyId,
        privateKey,
      });
    }
  }
}
