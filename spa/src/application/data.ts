export type ActivityKind = "deployment" | "access" | "policy";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  time: string;
}

export const activityEvents: ActivityEvent[] = [
  {
    id: "evt-1004",
    kind: "deployment",
    title: "Production deployment completed",
    detail: "Operations API 2.4.0 is healthy in all regions.",
    time: "09:42 UTC",
  },
  {
    id: "evt-1003",
    kind: "policy",
    title: "Access policy published",
    detail: "The support escalation policy passed validation.",
    time: "09:18 UTC",
  },
  {
    id: "evt-1002",
    kind: "access",
    title: "Workspace member invited",
    detail: "Grace Hopper was invited as an operator.",
    time: "08:51 UTC",
  },
  {
    id: "evt-1001",
    kind: "deployment",
    title: "Runbook verification finished",
    detail: "All twelve recovery checks completed successfully.",
    time: "08:25 UTC",
  },
];

export const overviewStats: Array<{ label: string; value: string }> = [
  { label: "Healthy services", value: "12 / 12" },
  { label: "Open incidents", value: "0" },
  { label: "Policy coverage", value: "98%" },
];
