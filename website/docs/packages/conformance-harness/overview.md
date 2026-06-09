---
sidebar_position: 1
---

# @finos/sail-conformance-harness

Minimal React host that wires **only** `@finos/sail-desktop-agent` to run the [FINOS FDC3 conformance toolbox](https://fdc3.finos.org/toolbox/fdc3-conformance/). Use as a diagnostic clean room compared to the full Sail stack.

**Location:** `packages/sail-conformance-harness/`

## Quick start

```bash
nvm use 24
npm install
npm run dev -w @finos/sail-conformance-harness
```

Dev server: **http://localhost:3001**

## Architecture

- **`createBrowserDesktopAgent`** — local DA + WCP (no `SailPlatform`)
- **App directory** — repo-root `conformance-appd.json` via preset `apps` option
- **Intent resolution** — preset `intentResolver` with programmatic handler selection
- **Instance identity** — iframe `name` must equal `instanceId` for WCP4 correlation

## Related

- [Desktop Agent conformance traceability](../desktop-agent/conformance)
- [Integrator guide](../desktop-agent/integrator-guide)
