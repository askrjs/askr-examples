export interface Runbook {
  slug: string;
  title: string;
  summary: string;
  steps: string[];
}

export const runbooks: Runbook[] = [
  {
    slug: "api-recovery",
    title: "API recovery",
    summary: "Restore the operations API after a regional service interruption.",
    steps: [
      "Confirm the readiness probe is failing.",
      "Shift traffic to the healthy region.",
      "Verify request IDs in the access log.",
    ],
  },
  {
    slug: "policy-rollback",
    title: "Policy rollback",
    summary: "Return an invalid access policy to the last verified revision.",
    steps: [
      "Pause policy publication.",
      "Restore the previous policy version.",
      "Run the permission verification checks.",
    ],
  },
];

export function findRunbook(slug: string): Runbook | null {
  return runbooks.find((runbook) => runbook.slug === slug) ?? null;
}
