# Changelog

## Unreleased

### Breaking changes

- Require the coordinated Askr 0.5 platform packages. Generate ordinary locks
  against the frozen candidate registry until publication; a published 0.4
  installation cannot provide the new provider presets and session contracts.
- Provider authentication uses server-owned sessions and public provider presets.
  Browser token SDKs and the retired `@askrjs/auth/browser` and
  `@askrjs/auth/auth0` paths are not consumer contracts for these applications.

### Added

- A separately installable Auth0, Microsoft, Google and Apple application with
  SSR and SPA modes, server actions, HTTPS, and signed simulated provider tests.
- Independent stage installation, lock replay and compiled API, MCP and SSG
  runtime qualification against the frozen package graph.

### Fixed

- Declare SPA's own jsdom dependency and keep installed/generated files outside
  each stage's lint and format scope.
- Preserve the API/SSR DOMPurify override for standalone installation.
- Clear the SSG server root before boot after a hydration failure.
- Run the provider application's signed Chromium, Firefox and WebKit journeys,
  installed public surface and both TypeScript compiler gates in ordinary CI.
- Consume Vite's installed virtual-server declaration without duplicate local
  shims and align typed lifecycle test doubles with OpenAPI 3.1.2.
- Resolve the declared TypeScript 6 compiler in both standalone and hoisted
  workspace installations.
- Send independent-stage audits to the public advisory database while retaining
  the frozen candidate registry for package installation.
- Qualify all 54 signed provider browser cases through an explicit simulated
  provider handoff and strict loopback CONNECT transport. Preserve Apple's
  cross-site `form_post`, canonical authorization parameters, actual callback
  cookies, exact private-request cancellation and bounded cleanup.
- Start Google sign-in with identity scopes, then request Calendar permission
  through the first server action's explicit consent flow.
