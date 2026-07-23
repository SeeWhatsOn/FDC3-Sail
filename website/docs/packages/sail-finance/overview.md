---
sidebar_position: 1
---

# @finos/sail-finance

Browser deployment of FDC3 Sail — a React application that hosts the Desktop Agent in a browser tab and runs FDC3 apps in iframes.

**Location:** `packages/sail-finance/`

## What it does

- Hosts `SailPlatform` in the browser main window
- Renders workspace UI (tabs, panels) for FDC3 apps in iframes
- Provides intent resolver and channel selector chrome (host-controlled UI)
- Manages workspaces, layouts, and app directory integration

## Development

```bash
# From monorepo root (starts agent, platform, server, and web)
npm run dev

# Or this package only
npm run dev -w @finos/sail-finance
```

Dev server: **http://localhost:3000**

## Architecture

```text
sail-finance (React)
  ├── @finos/sail-platform  — SailPlatform, launcher, middleware
  │     └── @finos/sail-desktop-agent
  └── @finos/sail-theme — brand tokens + assets
```

Reference wiring for host contracts:

- `src/contexts/SailDesktopAgentContext.tsx` — platform provider
- `src/components/ChannelSelector.tsx` — channel chrome
- `src/stores/intent-resolver-store.ts` — intent resolution UI

## Related

- [Run Sail](../../run-sail) — run or host the full platform
- [Getting Started](../../getting-started) — embed a Desktop Agent in your own web app
- [Deployment targets (DPWA)](../../architecture/deployment-targets)
- [@finos/sail-platform](../platform/overview)
