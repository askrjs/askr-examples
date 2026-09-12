import { ActivityIcon, GaugeIcon, MoonIcon, SunIcon } from "@askrjs/lucide";
import { ThemeScope, ThemeToggle } from "@askrjs/themes/theme";
import {
  Block,
  Container,
  Header,
  Main,
  NavBrand,
  NavGroup,
  NavLink,
  Navbar,
  Stack,
} from "@askrjs/themes/components";

export function OperationsLayout({ children }: { children?: unknown }) {
  return (
    <ThemeScope storageKey="askr-examples-theme">
      <Header position="sticky">
        <Container size="xl" paddingY="lg">
          <Navbar>
            <NavBrand>
              <NavLink href="/" match="exact" aria-label="Northstar operations home">
                <GaugeIcon aria-hidden="true" /> Northstar Operations
              </NavLink>
            </NavBrand>
            <NavGroup align="end">
              <Block direction="row" gap="sm" align="center" wrap>
                <NavLink href="/" match="exact">
                  Overview
                </NavLink>
                <NavLink href="/activity">
                  <ActivityIcon aria-hidden="true" /> Activity
                </NavLink>
                <ThemeToggle
                  aria-label="Toggle color theme"
                  lightIcon={<SunIcon aria-hidden="true" />}
                  darkIcon={<MoonIcon aria-hidden="true" />}
                />
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
    </ThemeScope>
  );
}
