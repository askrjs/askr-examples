import { action } from "@askrjs/askr/actions";
import { createSPA, hydrateSPA } from "@askrjs/askr/boot";
import { createExampleRegistry } from "../../src/registry.js";
import { readProviderAction, actionCsrf, type ProviderSummary } from "../../src/actions.js";
import { handleAction } from "@askrjs/server/askr";
import { createAuth0Provider } from "@askrjs/auth/providers/auth0";
import { createMicrosoftProvider } from "@askrjs/auth/providers/microsoft";
import { createGoogleProvider } from "@askrjs/auth/providers/google";
import { createAppleProvider } from "@askrjs/auth/providers/apple";
import type { RenderableChild } from "@askrjs/askr";
export function PublicPanel() {
  action<Record<string, never>, ProviderSummary>(readProviderAction, { csrfToken: actionCsrf });
  // @ts-expect-error A fresh resolver must be asynchronous with an AbortSignal argument.
  action(readProviderAction, { csrfToken: 123 });
  return <p>One public scoped Askr JSX owner</p>;
}
export const valueChildren: RenderableChild = <PublicPanel />;
export function boot(root: HTMLElement) {
  const { registry, sessionAuth } = createExampleRegistry({ provider: "google", mode: "spa" });
  return [
    createSPA({ root, registry, auth: sessionAuth }),
    hydrateSPA({ root, registry, auth: sessionAuth }),
  ];
}
export const apiAction = handleAction(readProviderAction, async (context) => {
  const token: string = await context.auth.token("google", {
    resource: "https://www.googleapis.com",
    scopes: ["https://www.googleapis.com/auth/calendar.calendarlist.readonly"],
    signal: context.signal,
  });
  // Token remains a server local; the action only returns a deliberate display result.
  return { result: { message: token.length ? "Provider permission confirmed" : "Unavailable" } };
});
export const factoryTypes = [
  createAuth0Provider,
  createMicrosoftProvider,
  createGoogleProvider,
  createAppleProvider,
] as const;
// @ts-expect-error Provider-specific credentials cannot be omitted.
createMicrosoftProvider({ id: "microsoft" });
createAppleProvider({
  id: "apple",
  servicesId: "app",
  teamId: "TEAM123456",
  keyId: "KEY1234567",
  privateKey: {},
  // @ts-expect-error Apple cannot be configured as an API resource provider.
  resources: [{ resource: "api", scopes: ["read"] }],
});
