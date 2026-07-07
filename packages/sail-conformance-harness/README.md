# @finos/sail-conformance-harness

Minimal React host for the [FINOS FDC3 conformance toolbox](https://fdc3.finos.org/toolbox/fdc3-conformance/) — wires only `@finos/sail-desktop-agent` (no full Sail stack). Toolbox runs assume `heartbeatEnabled: false` (matching Cucumber default); enable heartbeat only for dedicated heartbeat scenarios.

## Documentation

[finos.github.io/FDC3-Sail/docs/packages/conformance-harness/overview](https://finos.github.io/FDC3-Sail/docs/packages/conformance-harness/overview)

## Fixtures and toolbox results

| Path | Purpose |
|------|---------|
| `conformance-appd.json` | FINOS conformance app directory fixture (hosted URLs; shared with `sail-web` dev) |
| `src/conformance-app-directory.ts` | Loads the fixture and rewrites toolbox origin for local FINOS dev (`VITE_CONFORMANCE_TOOLBOX=local`) |
| `results/conformance-report-v3.txt` … `v5.txt` | Committed FINOS toolbox export history ( **v5 = current baseline** ) |
| `results/conformance-test-failure-review.md` | Failure attribution matrix vs exports |
| `results/README.md` | This folder index |

## Run

From the monorepo root (`npm install` at repo root — shared dev tooling is hoisted from the root workspace):

```bash
npm run dev -w @finos/sail-conformance-harness
```

For **FDC3 2.2** (local toolbox profile):

```bash
npm run dev:local -w @finos/sail-conformance-harness
```

Dev server: **http://localhost:3001**. The harness page header shows the active toolbox profile and FDC3 target; `[ConformanceHarness]` startup lines appear on the **host page** DevTools console (not inside the Conformance1 iframe).

### Toolbox origin (hosted vs local FINOS)

The harness loads `conformance-appd.json` (hosted FINOS URLs) and optionally rewrites the toolbox base at bootstrap:

| Profile | Env | Toolbox origin | FDC3 target |
|---------|-----|----------------|-------------|
| Hosted (default) | — | `https://fdc3.finos.org/toolbox/fdc3-conformance` | 3.0 |
| Local FINOS dev | `VITE_CONFORMANCE_TOOLBOX=local` | `http://localhost:3001` | 2.2 |

```bash
# Local FINOS toolbox on port 3001 (run FINOS `npm run dev` instead of the harness, or use another port for one of them)
VITE_CONFORMANCE_TOOLBOX=local npm run dev -w @finos/sail-conformance-harness
```

Hosted URLs include `/toolbox/fdc3-conformance` before `/apps/...`; local rewrite drops that segment so paths become `http://localhost:3001/apps/...`.

## Session teardown

Launched mock apps (`forceNewWindow`) open in **script-closable popup windows**: the host opens `about:blank` with window features, then navigates to the FINOS mock URL so `AppLauncher.close` can destroy the container when mocks call `fdc3.close()` (FINOS mocks do not call `window.close()`). Instances are **pre-registered** before `window.open` so WCP4 adopts the host `instanceId`. On `fdc3.close()` or agent disconnect, the harness closes the browsing context (popup registry or WCP `source` window), removes the panel entry, and calls `disconnectInstance`.

```bash
npm test -w @finos/sail-conformance-harness
npm run typecheck -w @finos/sail-conformance-harness
```
