import { createMutation } from "@askrjs/askr/data";
import { ErrorBoundary } from "@askrjs/askr/components";
import { navigate } from "@askrjs/askr/router";
import { FileCodeIcon, LayoutDashboardIcon, LogOutIcon, UsersIcon } from "@askrjs/lucide";
import { Alert, Aside, Block, Button, Grid, NavLink, Stack } from "@askrjs/themes/components";
import { OperationsLayout } from "../../application/layout.js";

export function WorkspaceLayout({ children }: { children?: unknown }) {
  const logout = createMutation<Record<string, never>, boolean>({
    action: async (_input, { signal }) => {
      const response = await fetch("/api/session", {
        method: "DELETE",
        signal,
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Logout failed");
      return true;
    },
  });
  return (
    <OperationsLayout>
      <Grid columns={{ base: 1, md: "14rem minmax(0, 1fr)" }} gap="2xl">
        <Aside aria-label="Workspace navigation">
          <Stack gap="4">
            <h2>Operator tools</h2>
            <Stack as="nav" gap="2">
              <NavLink href="/workspace" match="exact">
                <LayoutDashboardIcon aria-hidden="true" /> Dashboard
              </NavLink>
              <NavLink href="/workspace/users">
                <UsersIcon aria-hidden="true" /> Users
              </NavLink>
              <NavLink href="/workspace/policies/support-escalation">
                <FileCodeIcon aria-hidden="true" /> Policies
              </NavLink>
              <NavLink href="/workspace/locale">Language</NavLink>
              <NavLink href="/workspace/deferred">Deferred data</NavLink>
              <NavLink href="/workspace/deferred-failure">Deferred failure</NavLink>
            </Stack>
            <Button
              variant="ghost"
              disabled={logout.pending}
              onPress={() =>
                void logout.execute({}).then(() => navigate("/login", { replace: true }))
              }
            >
              <LogOutIcon aria-hidden="true" /> Sign out
            </Button>
          </Stack>
        </Aside>
        <Block as="section">
          <ErrorBoundary
            fallback={(error, reset) => (
              <Alert role="alert">
                <p>Workspace rendering failed: {String(error)}</p>
                <Button onPress={reset}>Try rendering again</Button>
              </Alert>
            )}
          >
            <>{children}</>
          </ErrorBoundary>
        </Block>
      </Grid>
    </OperationsLayout>
  );
}
