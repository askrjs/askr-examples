import { schema } from "@askrjs/schema";
import { security } from "@askrjs/server/openapi";
import type { AskrAppApi } from "@askrjs/server/askr";
import type { AppDependencies } from "./boot/dependencies.js";
import { SESSION_COOKIE } from "./domains/sessions/repository.js";
import { registerApiRoutes } from "./routes/api.js";

export const apiSecuritySchemes = {
  cookieSession: security.apiKey(SESSION_COOKIE, "cookie", {
    description: "Deterministic local demo session",
  }),
};

export function defineApi(api: AskrAppApi<AppDependencies>) {
  const User = api.schema(
    "User",
    schema.object({
      id: schema.string(),
      name: schema.string(),
      email: schema.email(),
      role: schema.enum(["operator", "viewer"]),
      version: schema.integer({ minimum: 1 }),
    }),
  );
  const Dashboard = api.schema(
    "Dashboard",
    schema.object({
      healthyServices: schema.integer(),
      openIncidents: schema.integer(),
      activeUsers: schema.integer(),
      trend: schema.array(schema.object({ label: schema.string(), value: schema.number() })),
    }),
  );
  const Activity = api.schema(
    "Activity",
    schema.object({
      id: schema.string(),
      kind: schema.enum(["deployment", "access", "policy"]),
      title: schema.string(),
      detail: schema.string(),
      time: schema.string(),
    }),
  );
  const Policy = api.schema(
    "Policy",
    schema.object({
      id: schema.string(),
      name: schema.string(),
      language: schema.literal("json"),
      source: schema.string(),
      version: schema.integer({ minimum: 1 }),
    }),
  );
  const Principal = api.schema(
    "Principal",
    schema.object({
      id: schema.string(),
      subject: schema.optional(schema.string()),
      permissions: schema.optional(schema.array(schema.string())),
      roles: schema.optional(schema.array(schema.string())),
    }),
  );
  const Session = api.schema(
    "Session",
    schema.object({ id: schema.string(), subject: schema.string() }),
  );
  const AuthContext = api.schema(
    "AuthContext",
    schema.object({
      authenticated: schema.boolean(),
      principal: schema.nullable(Principal),
      session: schema.nullable(Session),
      tenant: schema.nullable(schema.string()),
    }),
  );

  // Register additional API route groups beside this one.
  registerApiRoutes(api, { Activity, AuthContext, Dashboard, Policy, User });
}
