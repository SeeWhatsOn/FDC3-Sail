---
sidebar_position: 4
---

# Deployment Targets: Browser vs Electron

FDC3 Sail's supported v3-pre runtime is the browser host: `sail-web` runs a browser-resident `SailDesktopAgent`, and FDC3 web apps connect through WCP and `MessagePort`. `sail-electron` is an optional wrapper around the same web stack, but native multi-window and deep OS integration remain integration work.

## Overview

| Capability | Browser / PWA (`sail-web`) | Electron wrapper (`sail-electron`) |
|---|---|---|
| **Runtime** | Modern browser (Chrome, Edge) | Chromium bundled in Electron |
| **Installation** | Installable PWA or opened in browser | Native installer / binary |
| **OS integration** | Limited (web sandbox) | Full (file system, tray, notifications) |
| **Updates** | Automatic via browser cache | Requires update mechanism |
| **Distribution** | URL / CDN | Installer package |
| **FDC3 path** | Browser-resident WCP + MessagePort | Same browser-resident path inside Electron |
| **App isolation** | Browser cross-origin sandboxing | Electron renderer isolation where the wrapper provides it |

## How Shared Architecture Works

Both targets use the same layered architecture:

```
┌──────────────────────────────────────────┐
│  sail-web (DPWA) │  sail-electron         │  ← Layer 3: Application
└──────────────────────────────────────────┘
                        ↓ uses
┌──────────────────────────────────────────┐
│  @finos/sail-platform-api                 │  ← Layer 2: Platform SDK
│  (SailPlatform, workspace/layout/config)  │
└──────────────────────────────────────────┘
                        ↓ uses
┌──────────────────────────────────────────┐
│  @finos/sail-desktop-agent               │  ← Layer 1: FDC3 engine
│  (SailDesktopAgent, DACP, WCP app connection) │
└──────────────────────────────────────────┘
```

The `sail-desktop-agent` package keeps FDC3 state and handlers headless, but the browser-ready path intentionally owns a `BrowserAppConnection`. Use `SailDesktopAgent` for shipping browser hosts; manual `DesktopAgent` composition is for package internals and focused tests.

## Browser / PWA (`sail-web`)

### What It Is

`sail-web` is a browser application that can also be installed as a Progressive Web App. It hosts the Desktop Agent in a browser tab/window and exposes it to FDC3 apps running in iframes via the Web Connection Protocol (WCP).

### How It Works

1. User opens the Sail URL (or launches the installed PWA).
2. The Sail UI loads in the browser.
3. FDC3 apps open in iframes within the Sail window.
4. Apps connect to the Desktop Agent via `window.postMessage` (WCP1–3 handshake).
5. After handshake, apps communicate via a dedicated `MessagePort` (WCP4–5).

### Advantages

- **Zero installation for the DA**: Users access the Desktop Agent via a URL — no binary to install.
- **Automatic updates**: The DA updates on every page load without user action.
- **Cross-platform**: Runs wherever Chrome/Edge runs (Windows, macOS, Linux).
- **Developer-friendly**: Standard web debugging tools work out of the box.
- **No Electron maintenance**: No need to track Electron security releases.

### Limitations

- **Sandboxed**: Limited access to OS-level APIs (file system, system tray, OS notifications).
- **Browser restrictions**: Apps must be served over HTTPS in production. Cross-origin restrictions apply.
- **Single window**: All FDC3 apps share the Sail browser window (iframes), limiting independent window management.
- **No native packaging**: Cannot be distributed as a standalone `.exe` or `.dmg` without a wrapper.

### When to Choose DPWA

- You want the simplest possible deployment with no installation step.
- Your FDC3 apps are web-based and don't need deep OS integration.
- You prioritise ease of update and maintenance.
- You're building a SaaS or cloud-hosted desktop agent.

## Electron wrapper (`sail-electron`)

### What It Is

`sail-electron` packages the browser host in Electron. It can provide native packaging and selected OS integration, but the v3-pre FDC3 path is still the browser-resident agent and WCP app connection.

### How It Works

1. User installs and launches the Electron application.
2. The renderer hosts the Sail web shell and `SailDesktopAgent`.
3. FDC3 apps connect through the same browser WCP path used by `sail-web`.
4. Any native windowing, IPC, and packaging policy is supplied by the Electron wrapper.

### Advantages

- **Native OS integration**: System tray, notifications, file system access, and native menus.
- **Native shell options**: Electron can add menus, notifications, deep links, and managed packaging around the web host.
- **Packaging**: Distributable as a signed native installer for corporate IT deployment.
- **No browser tab management**: The DA doesn't compete with the user's browser tabs.
- **Offline-capable**: Can be bundled with all dependencies for air-gapped environments.

### Limitations

- **Installation required**: Users must install the binary; IT may require admin rights.
- **Update management**: Updates require an in-app updater (e.g., `electron-updater`) or manual re-install.
- **Binary size**: Electron bundles Chromium (~100–200 MB).
- **Security maintenance**: Must track Electron security releases and rebuild regularly.
- **Platform-specific builds**: Separate binaries for Windows, macOS, and Linux.

### When to Choose Electron

- Your users need OS-level features such as native notifications, deep links, or managed installers.
- You are prepared to own Electron-specific windowing, update, and security policy.
- Your organisation requires a packaged, IT-managed desktop application.
- You need to operate in an air-gapped or restricted network environment.

## The Decision: Browser First

FDC3 Sail keeps `sail-web` as the primary runtime because it matches the current `SailDesktopAgent` architecture and the FDC3 For-The-Web connection model. Electron remains valuable for packaging the same browser host when an organisation needs a native shell.

Remote Desktop Agent, cross-device sync, and native app connection adapters are deferred. They should be explicit future adapters, not documentation promises about the current v3-pre package surface.

## Related Documentation

- [Architecture Overview](./overview) - Three-layer architecture
- [@finos/sail-desktop-agent](../packages/desktop-agent/overview) - Core FDC3 engine
- [@finos/sail-platform-api](../packages/platform-api/overview) - Platform services
