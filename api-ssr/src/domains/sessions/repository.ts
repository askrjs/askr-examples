import type { AuthSession, Principal } from "@askrjs/auth";

export const SESSION_COOKIE = "northstar-session";
export const DEMO_SESSION_ID = "northstar-demo-session";

export interface SessionRepository {
  get(id: string, options?: { request: Request; signal: AbortSignal }): Promise<AuthSession | null>;
  create(): Promise<AuthSession>;
  delete(id: string): Promise<void>;
}

export interface PrincipalRepository {
  get(
    subject: string,
    options?: { request: Request; signal: AbortSignal },
  ): Promise<Principal | null>;
}

export function createInMemorySessionRepository(): SessionRepository {
  const sessions = new Map<string, AuthSession>();
  return {
    async get(id, options) {
      if (options?.signal.aborted) throw options.signal.reason;
      const session = sessions.get(id);
      return session ? { ...session } : null;
    },
    async create() {
      const session: AuthSession = { id: DEMO_SESSION_ID, subject: "demo-operator" };
      sessions.set(session.id, session);
      return { ...session };
    },
    async delete(id) {
      sessions.delete(id);
    },
  };
}

export function createInMemoryPrincipalRepository(): PrincipalRepository {
  const principal: Principal = {
    id: "demo-operator",
    subject: "demo-operator",
    roles: ["operator"],
    permissions: ["dashboard:read", "users:read", "users:write", "policies:read", "policies:write"],
    name: "Demo Operator",
  };
  return {
    async get(subject, options) {
      if (options?.signal.aborted) throw options.signal.reason;
      return subject === principal.subject ? { ...principal } : null;
    },
  };
}
