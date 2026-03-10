# sail-web

Browser deployment of FDC3 Sail. A React application that hosts the FDC3 Desktop Agent in a browser tab, allowing FDC3 apps to run in iframes and communicate via the Web Connection Protocol (WCP).

## Overview

`sail-web` is the primary deployment target for FDC3 Sail in a browser context. It:

- Hosts the `@finos/sail-platform-api` Desktop Agent in the browser's main window
- Renders an app workspace UI where FDC3 apps are opened in iframes
- Manages app directories, workspaces, and user channel membership
- Provides an intent resolver UI for routing `raiseIntent` calls

## Development

```bash
# From the monorepo root
npm run dev:web

# Or just this app
npm run dev --workspace=@finos/sail-web
```

The app is served at http://localhost:5173.

## Building

```bash
npm run build --workspace=@finos/sail-web
```

## Architecture

```
sail-web (React app)
  │
  ├── @finos/sail-platform-api  — Desktop Agent factory + middleware
  │     └── @finos/sail-desktop-agent  — Pure FDC3 core
  │
  └── @finos/sail-ui  — Shared UI components
```

FDC3 apps are loaded in `<iframe>` elements. Each app connects to the Desktop Agent using `@finos/fdc3-get-agent` via the Web Connection Protocol (WCP1–6 handshake over `postMessage`/`MessagePort`).

## Testing

```bash
# Unit tests (Vitest)
npm test --workspace=@finos/sail-web

# E2E tests (Playwright)
npm run test:e2e --workspace=@finos/sail-web
```

## License

Copyright 2025 FINOS. Distributed under the Apache 2.0 License.
