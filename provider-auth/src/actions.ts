import { defineAction } from "@askrjs/askr/actions";
import { schema } from "@askrjs/schema";
export const readProviderAction = defineAction({
  id: "provider.read-summary",
  input: schema.object({}),
  invalidates: ["provider-private"],
});
export interface ProviderSummary {
  readonly message: string;
}
/** Resolve a fresh session-bound token for every submission; undefined never falls back to SSR. */
export async function actionCsrf(signal: AbortSignal): Promise<string | undefined> {
  const response = await fetch("/api/action-csrf", {
    signal,
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) throw new Error("The action could not obtain CSRF protection");
  const body: unknown = await response.json();
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => key !== "csrfToken")
  )
    throw new Error("Invalid action CSRF response");
  if (!("csrfToken" in body)) return undefined;
  if (typeof body.csrfToken !== "string" || !/^[\x21-\x7e]+$/u.test(body.csrfToken))
    throw new Error("Invalid action CSRF response");
  return body.csrfToken;
}
export function actionProblem(error: unknown): unknown {
  return error instanceof Error ? error.cause : undefined;
}
