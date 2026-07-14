import { Link } from '@askrjs/askr/router';
import { BookOpenIcon, GaugeIcon } from '@askrjs/lucide';
import {
  Button,
  Container,
  Header,
  Inline,
  Main,
  Navbar,
  NavBrand,
  NavGroup,
  Stack,
} from '@askrjs/themes/components';

export function SiteLayout({ children }: { children?: unknown }) {
  return (
    <>
      <Header>
        <Container size="xl" py="lg">
          <Navbar>
            <NavBrand><GaugeIcon aria-hidden="true" /><strong>Northstar Runbooks</strong></NavBrand>
            <NavGroup align="end">
              <Inline gap="2">
                <Button asChild variant="ghost"><Link href="/">Home</Link></Button>
                <Button asChild variant="ghost"><Link href="/runbooks/api-recovery"><BookOpenIcon aria-hidden="true" /> Runbooks</Link></Button>
              </Inline>
            </NavGroup>
          </Navbar>
        </Container>
      </Header>
      <Main><Container size="xl" py="2xl"><Stack gap="2xl">{children}</Stack></Container></Main>
    </>
  );
}
