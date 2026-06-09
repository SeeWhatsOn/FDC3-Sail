---
sidebar_position: 1
---

# Architecture Overview

FDC3 Sail implements the FDC3 2.2 standard using a modular, transport-agnostic architecture.

## Core Principles

### 1. FDC3 Compliance First
- Strict adherence to FDC3 2.2 standards
- Full support for **DACP** (Desktop Agent Communication Protocol)
- Full support for **WCP** (Web Connection Protocol)
- Standard `@finos/fdc3` library works unchanged

### 2. Separation of Concerns
- **Pure FDC3 engine** (`@finos/sail-desktop-agent`) — `core`, `host-contracts`, `protocols`, `transports`, `connectors`, and `presets` under `src/`
- **Platform services** (`@finos/sail-platform-api`) — Sail-specific wrappers; **layout**, **workspace**, **storage**, and **config** belong in platform-api, not in desktop-agent core
- Clear boundaries between FDC3 operations and proprietary features

### Public API modes

Integrators choose between two entry styles:

- **Manual composition primitives** — import `DesktopAgent`, connectors, and transports separately and wire them yourself (`@finos/sail-desktop-agent`, `/connectors`, `/transports`).
- **Presets** — import high-level factories from `@finos/sail-desktop-agent/presets` (for example `createBrowserDesktopAgent`) when default wiring is sufficient.

Use manual composition when you need custom transports or lifecycle control; use presets for faster integration.

### 3. Transport Agnostic
- Desktop Agent core has zero transport dependencies
- Works with Socket.IO, MessagePort, WebSockets, or any custom transport
- Transport is injected via the `Transport` interface

### 4. Environment Independent
- Desktop Agent package has no browser or Node.js dependencies
- Pure TypeScript that runs anywhere JavaScript runs
- Browser-specific code isolated to `sail-desktop-agent/browser` submodule

## Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: Application Layer                                 │
│  - Sail UI (packages/sail-web)                              │
│  - Sail Server (packages/sail-server)                       │
│  - Sail Electron (packages/sail-electron)                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: Platform Services (@finos/sail-platform-api)      │
│  - Desktop Agent wrappers (SailBrowserDesktopAgent)         │
│  - Transport implementations (Socket.IO, MessagePort)       │
│  - Platform API (Workspaces, Layouts)                       │
│  - WCP Gateway (browser-specific connection handler)        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: Pure FDC3 Engine (@finos/sail-desktop-agent)      │
│  src/core — DACP handlers, AgentState, app directory        │
│  src/host-contracts — host-facing connector contracts       │
│  src/protocols — DACP / WCP protocol helpers                │
│  src/transports — Transport implementations                 │
│  src/connectors — browser WCP bridge, MessagePort           │
│  src/presets — high-level preset factories                  │
│  ZERO platform layout / workspace / storage / config        │
└─────────────────────────────────────────────────────────────┘
```

### Why This Structure?

**Layer 1 (Desktop Agent)** is pure, testable FDC3 logic:
- No `window`, no `document`, no `fs`, no `http`
- Can run in Node.js, browsers, workers, Electron, etc.
- Easy to test with mock transports
- Reusable across different FDC3 implementations

**Layer 2 (Sail Platform SDK)** bridges environments:
- Wraps Layer 1 for specific runtime environments
- Provides transport implementations
- Owns platform features — **layout**, **workspace**, **storage**, and **config** are routed to `@finos/sail-platform-api` instead of `@finos/sail-desktop-agent` core
- Handles browser-specific WCP connection setup

**Layer 3 (Applications)** uses the APIs:
- Sail UI uses SailBrowserDesktopAgent
- FDC3 apps use standard `@finos/fdc3` library

## Communication Protocols

### DACP (Desktop Agent Communication Protocol)

Standard FDC3 2.2 protocol for all FDC3 operations:
- `broadcast` - Send context to channels
- `raiseIntent` - Raise intents between apps
- `joinUserChannel` - Join user channels
- And more...

### Sail Platform Protocol

Proprietary protocol for Sail-specific features owned by `@finos/sail-platform-api` (not desktop-agent core):

- **Workspace** management
- **Layout** persistence
- **Storage** clients
- **Config** (`sailConfig`)

These concerns belong in platform services — do not implement layout, workspace, storage, or config inside `@finos/sail-desktop-agent` core.

## State Management

The Desktop Agent uses a **functional state pattern** with immutable updates:

```typescript
interface AgentState {
  instances: Record<string, AppInstance>
  intents: {
    listeners: Record<string, IntentListener>
    pending: Record<string, PendingIntent>
    history: Record<string, IntentResolution>
  }
  channels: {
    user: Record<string, Channel>
    app: Record<string, Channel>
    private: Record<string, PrivateChannel>
    contexts: Record<string, Record<string, StoredContext>>
  }
  events: {
    listeners: Record<string, EventListener>
    byEventType: Record<string, string[]>
  }
  heartbeats: Record<string, HeartbeatState>
}
```

State is managed through pure functions:
- **Selectors** - Query state without modification
- **Mutators** - Return new state with changes

## WCP Integration Flow

```
1. App iframe calls fdc3.getAgent()
2. WCP1Hello via window.postMessage
3. WCPConnector creates MessageChannel
4. WCP3Handshake sends port1 to app
5. App sends WCP4ValidateAppIdentity via MessagePort
6. Desktop Agent validates against App Directory
7. WCP5ValidateAppIdentityResponse confirms identity
8. App now connected, can send/receive DACP messages
```

## Sail-Controlled UI

FDC3 Sail uses **Option 2: External UI Control** from the FDC3 specification:

- Channel selector and intent resolver are React components in the Sail UI
- One UI controls all apps (not one per app)
- WCP3Handshake returns `channelSelectorUrl: false`, `intentResolverUrl: false`
- Apps receive standard DACP events (e.g., `userChannelChangedEvent`)

See [Channel selection: host chrome vs app-hosted UI](./channel-selection) for set/get flows, layering (`sail-platform-api` vs desktop-agent), and Pattern A vs Pattern B.

## Learn More

- [@finos/sail-desktop-agent](../packages/desktop-agent/overview) — FDC3 engine, integrator guide, composition diagrams
- [Sail Platform SDK Architecture](./sail-platform-sdk) — Platform services and wrappers
- [Channel selection](./channel-selection) — Host chrome vs app-hosted selector
