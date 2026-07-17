import { createPlot } from "@askrjs/charts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Grid,
  PageHeader,
  Stat,
  StatLabel,
  StatValue,
} from "@askrjs/themes/components";
import type { Dashboard } from "../../domains/dashboard/repository.js";
import { dashboardData } from "../../domains/queries.js";
import { QueryError } from "../shared/query-error.js";

type ActiveUsersRow = Dashboard["trend"][number];

const ActiveUsersPlot = createPlot<ActiveUsersRow>();

export function DashboardPage() {
  const dashboard = dashboardData();
  if (dashboard.loading) return <EmptyState title="Loading dashboard…" aria-busy="true" />;
  if (dashboard.error) return <QueryError query={dashboard} />;
  if (!dashboard.data) return <EmptyState title="Dashboard data is empty" />;
  return <DashboardContent dashboard={dashboard.data} />;
}

function DashboardContent({ dashboard }: { dashboard: Dashboard }) {
  return (
    <>
      <PageHeader
        title="Operations dashboard"
        description="This data was prefetched into the server-rendered query cache."
      />
      <Grid columns={{ base: 1, md: 3 }} gap="md">
        <Stat>
          <StatLabel>Healthy services</StatLabel>
          <StatValue>{dashboard.healthyServices}</StatValue>
        </Stat>
        <Stat>
          <StatLabel>Open incidents</StatLabel>
          <StatValue>{dashboard.openIncidents}</StatValue>
        </Stat>
        <Stat>
          <StatLabel>Active users</StatLabel>
          <StatValue>{dashboard.activeUsers}</StatValue>
        </Stat>
      </Grid>
      <Card>
        <CardHeader>
          <CardTitle>Active users this week</CardTitle>
        </CardHeader>
        <CardContent>
          <ActiveUsersPlot.Root
            data={dashboard.trend}
            rowKey="label"
            label="Active users this week"
            description="Daily active users from Monday through Friday."
          >
            <ActiveUsersPlot.Line x="label" y="value" />
            <ActiveUsersPlot.Point x="label" y="value" />
          </ActiveUsersPlot.Root>
        </CardContent>
      </Card>
    </>
  );
}
