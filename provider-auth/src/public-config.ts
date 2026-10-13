export type ProviderName = "auth0" | "microsoft" | "google" | "apple";
export interface PublicConfig {
  readonly provider: ProviderName;
  readonly mode: "ssr" | "spa";
  readonly api?: { readonly resource: string; readonly scopes: readonly string[] };
}
export const providerMarker = '<meta name="askr-example-provider" content="__ASKR_PROVIDER__" />';
export const modeMarker = '<meta name="askr-example-mode" content="__ASKR_MODE__" />';
export function examplePublicConfig(provider: ProviderName, mode: "ssr" | "spa"): PublicConfig {
  return {
    provider,
    mode,
    ...(provider === "microsoft"
      ? {
          api: {
            resource: "https://graph.microsoft.com",
            scopes: ["https://graph.microsoft.com/User.Read"],
          },
        }
      : provider === "google"
        ? {
            api: {
              resource: "https://www.googleapis.com",
              scopes: ["https://www.googleapis.com/auth/calendar.calendarlist.readonly"],
            },
          }
        : {}),
  };
}
export function readPublicConfig(document: Document): PublicConfig {
  if (
    document.querySelectorAll('meta[name="askr-example-provider"]').length !== 1 ||
    document.querySelectorAll('meta[name="askr-example-mode"]').length !== 1
  )
    throw new Error("Invalid provider application boot configuration");
  const provider = document
    .querySelector('meta[name="askr-example-provider"]')
    ?.getAttribute("content");
  const mode = document.querySelector('meta[name="askr-example-mode"]')?.getAttribute("content");
  if (
    !["auth0", "microsoft", "google", "apple"].includes(provider ?? "") ||
    (mode !== "ssr" && mode !== "spa")
  )
    throw new Error("Invalid provider application boot configuration");
  if (
    provider !== "auth0" &&
    provider !== "microsoft" &&
    provider !== "google" &&
    provider !== "apple"
  )
    throw new Error("Invalid provider application boot configuration");
  return examplePublicConfig(provider, mode);
}
