import { Link } from "@askrjs/askr/router";
import { BookOpenIcon, GaugeIcon } from "@askrjs/lucide";
import {
  Block,
  Button,
  Container,
  Header,
  Main,
  NavBrand,
  NavGroup,
  Navbar,
  Stack,
} from "@askrjs/themes/components";

export function SiteLayout({ children }: { children?: unknown }) {
  return (
    <>
      <Header>
        <Container size="xl" paddingY="lg">
          <Navbar>
            <NavBrand>
              <GaugeIcon aria-hidden="true" />
              <strong>Northstar Runbooks</strong>
            </NavBrand>
            <NavGroup align="end">
              <Block direction="row" gap="sm">
                <Button asChild variant="ghost">
                  <Link href="/">Home</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/runbooks/api-recovery">
                    <BookOpenIcon aria-hidden="true" /> Runbooks
                  </Link>
                </Button>
              </Block>
            </NavGroup>
          </Navbar>
        </Container>
      </Header>
      <Main>
        <Container size="xl" paddingY="2xl">
          <Stack gap="2xl">{children}</Stack>
        </Container>
      </Main>
    </>
  );
}
