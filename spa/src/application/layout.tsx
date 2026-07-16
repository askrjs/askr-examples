import { ActivityIcon, GaugeIcon, MoonIcon, SunIcon } from "@askrjs/lucide";
import { ThemeScope, ThemeToggle } from "@askrjs/themes/theme";
import {
  Container,
  Header,
  Inline,
  Main,
  Navbar,
  NavBrand,
  NavGroup,
  NavLink,
  Stack,
} from "@askrjs/themes/components";

export function OperationsLayout({ children }: { children?: unknown }) {
  return (
    <ThemeScope storageKey="askr-examples-theme">
      <Header position="sticky">
        <Container size="xl" py="lg">
          <Navbar>
            <NavBrand>
              <NavLink href="/" match="exact" aria-label="Northstar operations home">
                <GaugeIcon aria-hidden="true" /> Northstar Operations
              </NavLink>
            </NavBrand>
            <NavGroup align="end">
              <Inline gap="2" align="center" wrap>
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
              </Inline>
            </NavGroup>
          </Navbar>
        </Container>
      </Header>
      <Main>
        <Container size="xl" py="2xl">
          <Stack gap="2xl">{children}</Stack>
        </Container>
      </Main>
    </ThemeScope>
  );
}
