import { derive, For, Show, state } from '@askrjs/askr';
import { CheckCircleIcon, FilterIcon } from '@askrjs/lucide';
import {
  Badge,
  Block,
  Button,
  Card,
  CardContent,
  EmptyState,
  Grid,
  Inline,
  PageHeader,
  Stack,
  Stat,
  StatLabel,
  StatValue,
} from '@askrjs/themes/components';
import { Link } from '@askrjs/askr/router';
import {
  activityEvents,
  overviewStats,
  type ActivityKind,
} from './data.js';
import { OperationsLayout } from './layout.js';

export function OverviewPage() {
  return (
    <OperationsLayout>
      <PageHeader
        title="Everything is running smoothly."
        description="Review service health, access changes, and policy activity from one operations workspace."
        actions={<Button asChild variant="primary"><Link href="/activity">Review recent activity</Link></Button>}
      />
      <Grid columns={{ base: 1, md: 3 }} gap="md" aria-label="Workspace status">
        <For each={overviewStats} by={(stat) => stat.label}>
          {(stat) => (
            <Stat>
              <CheckCircleIcon aria-hidden="true" />
              <StatLabel>{stat.label}</StatLabel>
              <StatValue>{stat.value}</StatValue>
            </Stat>
          )}
        </For>
      </Grid>
    </OperationsLayout>
  );
}

type ActivityFilter = 'all' | ActivityKind;

export function ActivityPage() {
  const [filter, setFilter] = state<ActivityFilter>('all');
  const visibleEvents = derive(() =>
    filter() === 'all'
      ? activityEvents
      : activityEvents.filter((event) => event.kind === filter()),
  );
  const filters: ActivityFilter[] = ['all', 'deployment', 'access', 'policy'];

  return (
    <OperationsLayout>
      <PageHeader
        title="Recent activity"
        description="Use local reactive state to focus the deterministic event stream."
      />
      <Inline gap="2" wrap role="group" aria-label="Filter activity">
        <FilterIcon aria-hidden="true" />
        <For each={filters} by={(value) => value}>
          {(value) => (
            <Button
              variant={filter() === value ? 'primary' : 'outline'}
              aria-pressed={filter() === value ? 'true' : 'false'}
              onPress={() => setFilter(value)}
            >
              {value === 'all' ? 'All activity' : value}
            </Button>
          )}
        </For>
      </Inline>
      <Show
        when={() => visibleEvents().length > 0}
        fallback={<EmptyState title="No matching activity" description="Choose another activity filter." />}
      >
        <Stack as="ol" gap="3" p="0" data-testid="activity-list" aria-live="polite">
          <For each={() => visibleEvents()} by={(event) => event.id}>
            {(event) => (
              <Block as="li" data-kind={event.kind}>
                <Card>
                  <CardContent>
                    <Block rowFrom="sm" justify="between" gap="md">
                      <Stack gap="2">
                        <Inline gap="2" align="center"><Badge>{event.kind}</Badge><strong>{event.title}</strong></Inline>
                        <p>{event.detail}</p>
                      </Stack>
                      <time>{event.time}</time>
                    </Block>
                  </CardContent>
                </Card>
              </Block>
            )}
          </For>
        </Stack>
      </Show>
    </OperationsLayout>
  );
}

export function NotFoundPage() {
  return (
    <OperationsLayout>
      <EmptyState
        title="Workspace page not found"
        description="The requested operations page does not exist."
        action={<Button asChild variant="primary"><Link href="/">Return to the overview</Link></Button>}
      />
    </OperationsLayout>
  );
}
