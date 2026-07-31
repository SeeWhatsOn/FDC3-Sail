---
sidebar_position: 1
---

# Architecture Overview

FDC3 Sail implements the FDC3 2.2 standard with a small set of package boundaries: a reusable Desktop Agent engine, optional Sail platform services, and host applications that provide the user experience.

This page is the system map. Package APIs, source-tree diagrams, and integration examples live under [Packages](../packages/desktop-agent/overview).

## Core Principles

### 1. FDC3 compliance first

- FDC3 apps use the standard `@finos/fdc3` library.
- App-to-agent communication follows FDC3 For-the-Web: WCP for discovery and connection, DACP for Desktop Agent operations.
- Sail-specific workspace, layout, config, and product-shell behavior stays outside the FDC3 engine.

### 2. Clear package ownership

- **`@finos/sail-desktop-agent`** owns FDC3 behavior: `SailDesktopAgent`, DACP handlers, WCP browser app connection, host contracts, and app directory logic. (`DesktopAgent` is the internal base class `SailDesktopAgent` extends — it is `@internal` and not a public entry point; see [Composition & internals](../packages/desktop-agent/composition#one-construction-path).)
- **`@finos/sail-platform`** owns Sail platform features: `SailPlatform`, workspace/layout/config APIs, product middleware, and host integration helpers.
- **`@finos/sail-finance`** is a deployment host that provides UI, app launch surfaces, and packaging.

### 3. Composition over hidden globals

Sail does not rely on a host-page `window.fdc3` preload. FDC3 apps run in iframe or window browsing contexts and discover the Desktop Agent through WCP. Host UI talks to `SailPlatform` or `DesktopAgent` APIs directly.

### 4. Browser-first Desktop Agent

The supported v3-pre product path is a browser-resident Desktop Agent: one `SailDesktopAgent` per host page, with FDC3 apps connecting through WCP and per-app `MessagePort`s. Worker, server, native, and cross-device paths are future adapters rather than current adoption paths.

## Layered Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  Hosts                                                      │
│  @finos/sail-finance, custom host shells                        │
│  - workspace UI, app launch surfaces, channel chrome        │
│  - intent resolver UI, packaging, product experience        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Sail platform services                                     │
│  @finos/sail-platform                                   │
│  - SailPlatform                                             │
│  - workspace, layout, config, storage-facing APIs           │
│  - Sail policy and host integration helpers                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  FDC3 Desktop Agent engine                                  │
│  @finos/sail-desktop-agent                                  │
│  - SailDesktopAgent, DACP handlers, AgentState              │
│  - BrowserAppConnection, WCP protocol helpers               │
│  - host contracts and app directory logic                   │
└─────────────────────────────────────────────────────────────┘
```

## App Connection Model

FDC3 apps connect through WCP and then exchange DACP messages over a per-app `MessagePort`:

```text
FDC3 app iframe/window
        │  WCP discovery + MessagePort
        ▼
Browser edge connector
        │  attached app connection
        ▼
DesktopAgent
```

For the detailed connection flow, module ownership, and manual composition patterns, see [Composition & internals](../packages/desktop-agent/composition) and the [Desktop Agent integrator guide](../packages/desktop-agent/integrator-guide).

## Host-Controlled UI

Sail Web uses host-controlled UI for shared desktop affordances:

- The host renders channel chrome around app iframes.
- The host supplies intent resolution UI.
- Apps still receive standard FDC3 events and call standard FDC3 APIs.

See [Channel selection](./channel-selection) for the boundary between host chrome, `SailPlatform`, and app-hosted selector URLs.

## Learn More

- [Deployment targets](./deployment-targets) — browser host deployment and the future native-shell direction.
- [Channel selection](./channel-selection) — host chrome vs app-hosted channel selector flows.
- [@finos/sail-desktop-agent](../packages/desktop-agent/overview) — FDC3 engine, integrator guide, and composition diagrams.
- [@finos/sail-platform](../packages/platform/overview) — Sail platform services and host integration APIs.
