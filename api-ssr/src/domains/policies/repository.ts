export interface Policy {
  id: string;
  name: string;
  language: "json";
  source: string;
  version: number;
}

export type PolicyUpdateResult =
  | { kind: "updated"; policy: Policy }
  | { kind: "missing" }
  | { kind: "conflict"; current: Policy };

export interface PolicyRepository {
  find(id: string, signal?: AbortSignal): Promise<Policy | null>;
  update(id: string, source: string, expectedVersion: number): Promise<PolicyUpdateResult>;
}

export function createInMemoryPolicyRepository(): PolicyRepository {
  const policies = new Map<string, Policy>([
    [
      "support-escalation",
      {
        id: "support-escalation",
        name: "Support escalation",
        language: "json",
        source: '{\n  "allow": ["support:read"],\n  "escalateAfterMinutes": 15\n}',
        version: 1,
      },
    ],
  ]);
  return {
    async find(id, signal) {
      if (signal?.aborted) throw signal.reason;
      const policy = policies.get(id);
      return policy ? { ...policy } : null;
    },
    async update(id, source, expectedVersion) {
      const current = policies.get(id);
      if (!current) return { kind: "missing" };
      if (current.version !== expectedVersion) return { kind: "conflict", current: { ...current } };
      const policy = { ...current, source, version: current.version + 1 };
      policies.set(id, policy);
      return { kind: "updated", policy: { ...policy } };
    },
  };
}
