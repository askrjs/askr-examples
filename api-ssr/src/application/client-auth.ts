import type { AuthContext } from "@askrjs/auth";

export async function resolveBrowserAuth(): Promise<AuthContext> {
  const response = await fetch("/api/session", { credentials: "same-origin" });
  if (!response.ok) {
    return { authenticated: false, principal: null, session: null, tenant: null };
  }
  return response.json() as Promise<AuthContext>;
}
