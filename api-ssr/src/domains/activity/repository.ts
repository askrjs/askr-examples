export interface ActivityEvent {
  id: string;
  kind: 'deployment' | 'access' | 'policy';
  title: string;
  detail: string;
  time: string;
}

export interface ActivityRepository {
  list(signal?: AbortSignal): Promise<readonly ActivityEvent[]>;
}

export function createInMemoryActivityRepository(): ActivityRepository {
  const events: readonly ActivityEvent[] = [
    { id: 'evt-1004', kind: 'deployment', title: 'Production deployment completed', detail: 'Operations API 2.4.0 is healthy in all regions.', time: '09:42 UTC' },
    { id: 'evt-1003', kind: 'policy', title: 'Access policy published', detail: 'The support escalation policy passed validation.', time: '09:18 UTC' },
    { id: 'evt-1002', kind: 'access', title: 'Workspace member invited', detail: 'Grace Hopper was invited as an operator.', time: '08:51 UTC' },
  ];
  return {
    async list(signal) {
      if (signal?.aborted) throw signal.reason;
      return events.map((event) => ({ ...event }));
    },
  };
}
