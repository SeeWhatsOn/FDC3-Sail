# FDC3 Conformance Harness

Minimal React host that wires **only** `@finos/sail-desktop-agent` to run the [FINOS FDC3 conformance toolbox](https://fdc3.finos.org/toolbox/fdc3-conformance/). Use this as a diagnostic clean room compared to the full Sail stack (`sail-web`, `sail-platform-api`, `sail-ui`).

## Quick start

From the repo root:

```bash
nvm use 24
npm install
npm run dev -w @finos/sail-conformance-harness
```

Dev server: **http://localhost:3001**

## Architecture

- **`createBrowserDesktopAgent`** — local desktop agent + WCP connector (no SailPlatform).
- **App directory** — apps loaded from repo-root `conformance-appd.json` via `getAppDirectory().addApplications()`.
- **Bootstrap** — Conformance1 iframe mounts on load with a generated `instanceId`; the agent starts **before** React renders so WCP1Hello is handled immediately.
- **Dynamic open** — `fdc3.open` uses `createHarnessAppLauncher`, which appends a panel to React state and renders an iframe.
- **Intent resolution** — listens for `intentResolverNeeded` on `wcpConnector` and resolves programmatically via `selectIntentHandler` + `resolveIntentSelection` (no modal UI).

## Instance identity (WCP4)

Each panel gets a unique id from `crypto.randomUUID()` (or reuses the id from an `fdc3.open` target). The iframe **`name` attribute must equal `instanceId`** so WCP identity validation can correlate the connection with the host panel.

## Debug logging

Agent bootstrap sets `logPayloadDetail: 'full'` and logs WCP connect/disconnect and intent resolution choices to the browser console.

## Tests

```bash
cd packages/sail-conformance-harness && npm test
```

Unit tests cover programmatic intent handler selection in `src/intent-resolution.test.ts`.
