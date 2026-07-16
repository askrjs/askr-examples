export interface Dashboard {
  healthyServices: number;
  openIncidents: number;
  activeUsers: number;
  trend: readonly { label: string; value: number }[];
}

export interface DashboardRepository {
  get(signal?: AbortSignal): Promise<Dashboard>;
}

export function createInMemoryDashboardRepository(): DashboardRepository {
  const dashboard: Dashboard = {
    healthyServices: 12,
    openIncidents: 0,
    activeUsers: 47,
    trend: [
      { label: "Mon", value: 31 },
      { label: "Tue", value: 38 },
      { label: "Wed", value: 35 },
      { label: "Thu", value: 44 },
      { label: "Fri", value: 47 },
    ],
  };
  return {
    async get(signal) {
      if (signal?.aborted) throw signal.reason;
      return structuredClone(dashboard);
    },
  };
}
