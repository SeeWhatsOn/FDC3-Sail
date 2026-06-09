---
sidebar_position: 3
title: Composition & internals
---

# Composition & internals

How `@finos/sail-desktop-agent` modules compose and interact. For integration steps and copy-paste examples, see the [integrator guide](./integrator-guide).

## Layered runtime model

```mermaid
flowchart TB
  subgraph apps ["FDC3 apps (external)"]
    A1["iframe app — @finos/fdc3"]
    A2["iframe app — @finos/fdc3"]
  end

  subgraph host ["Your host shell"]
    HL["AppLauncher"]
    HI["IntentResolver (optional)"]
    HC["Channel chrome (optional)"]
  end

  subgraph edge ["Browser edge — connectors/browser"]
    WCP["WCPConnector"]
    MP1["MessagePortTransport"]
    MP2["MessagePortTransport"]
    WCP --> MP1
    WCP --> MP2
  end

  subgraph wire ["Internal transport (local mode)"]
    T["InMemoryTransport pair"]
  end

  subgraph da ["Desktop Agent — core/"]
    DAG["DesktopAgent"]
    H["DACP handlers"]
    S["AgentState"]
    DAG --> H --> S
  end

  A1 <-->|"WCP + MessagePort"| MP1
  A2 <-->|"WCP + MessagePort"| MP2
  host -->|"host contracts"| edge
  HL -.->|"iframe name = instanceId"| A1
  edge <-->|"one Transport pipe"| T
  T <--> da
```

**Key rule:** apps never talk to `DesktopAgent` directly. All app traffic flows **edge → Transport → DA → Transport → edge → MessagePort**.

## Preset vs manual composition

```mermaid
flowchart LR
  subgraph preset ["Preset — 90% of hosts"]
    P["createBrowserDesktopAgent()"]
    P --> E1["WCPConnector (hidden)"]
    P --> D1["DesktopAgent"]
    E1 --- T1["InMemoryTransport pair"]
    D1 --- T1
  end

  subgraph manual ["Manual — framework authors"]
    D2["new DesktopAgent({ transport })"]
    E2["new WCPConnector(transport)"]
    D2 --- T2["createInMemoryTransportPair()"]
    E2 --- T2
  end

  subgraph remote ["Remote DA"]
    C["createWCPClient({ transport })"]
    S["new DesktopAgent on server"]
    C --- NET["Socket / Worker transport"]
    S --- NET
  end
```

| Pattern | Returns | You manage |
|---------|---------|------------|
| `createBrowserDesktopAgent` | `DesktopAgent` | Host contracts only; edge coupled to `start()`/`stop()` |
| `getBrowserDesktopAgentSession(da)` | `{ wcpConnector, connectorTransport }` | Advanced channel DACP, edge tests |
| `createWCPClient` | `{ wcpConnector, start, stop }` | Browser side of remote DA |
| Manual pair | `DesktopAgent` + `WCPConnector` | Both transports and lifecycle |

## Source tree responsibilities

```text
packages/sail-desktop-agent/src/
│
├── core/
│   ├── desktop-agent.ts       # DesktopAgent class — start/stop, handler dispatch
│   ├── handlers/dacp/         # All FDC3 operations (open, channels, intents, …)
│   ├── handlers/dacp/wcp-handlers.ts  # WCP4–5 identity validation
│   ├── state/                 # Immutable AgentState (selectors + mutators)
│   └── app-directory/         # DirectoryApp metadata
│
├── host-contracts/
│   ├── app-launcher.ts        # AppLauncher — host opens iframes/windows
│   ├── intent-resolver.ts     # IntentResolver — disambiguation UI contract
│   └── channel-control.ts     # ChannelControl — picker contract shape
│
├── protocols/
│   ├── dacp/                  # DACP message types
│   └── wcp/                   # WCP handshake, routing, connection map
│
├── transports/
│   └── in-memory-transport.ts # Same-process linked endpoints
│
├── connectors/browser/
│   ├── wcp-connector.ts       # WCP1–3, postMessage listener, port map
│   ├── message-port-transport.ts
│   ├── browser-desktop-agent.ts   # createBrowserDesktopAgent core factory
│   └── browser-desktop-agent-session.ts  # getBrowserDesktopAgentSession
│
└── presets/
    └── browser-desktop-agent.ts   # Top-level preset + intentResolver wiring
```

## WCP and DACP ownership

```mermaid
sequenceDiagram
  participant App as App iframe
  participant Edge as WCPConnector
  participant Tr as Transport
  participant DA as DesktopAgent

  Note over App,Edge: WCP1–3 — edge only
  App->>Edge: WCP1Hello (postMessage)
  Edge->>App: WCP3Handshake + MessagePort

  Note over App,DA: WCP4–5 — DA validates, edge migrates port map
  App->>Edge: WCP4 on MessagePort
  Edge->>Tr: forward WCP4
  Tr->>DA: WCP4ValidateAppIdentity
  DA->>Tr: WCP5 response
  Tr->>Edge: WCP5
  Edge->>App: WCP5 on MessagePort
  Edge->>Edge: temp id → canonical id

  Note over App,DA: DACP — DA handlers, edge routes by instanceId
  App->>Edge: joinUserChannelRequest
  Edge->>Tr: DACP + meta.source
  Tr->>DA: handler updates state
  DA->>Tr: channelChangedEvent + meta.destination
  Tr->>Edge: route to port
  Edge->>App: deliver on MessagePort
```

| Phase | Owner | Code location |
|-------|--------|---------------|
| WCP1–3 | Edge | `wcp-connector.ts`, `protocols/wcp/wcp1-3-handshake.ts` |
| MessagePort bridge | Edge | `message-port-transport.ts`, `wcp-message-routing.ts` |
| WCP4–5 | DA (+ edge port migration) | `core/handlers/dacp/wcp-handlers.ts` |
| WCP6 Goodbye | Both | Edge drops port; DA removes instance |
| DACP (all `fdc3.*`) | DA | `core/handlers/dacp/*` |

## Instance identity pipeline

Toolbox `AppTimeout` usually means a break in this chain:

```mermaid
flowchart LR
  L["AppLauncher.instanceId"]
  I["iframe name"]
  T["temp-{uuid} on edge"]
  W4["WCP4 claim"]
  C["canonical instanceId"]
  R["meta.destination.instanceId"]

  L --> I --> T --> W4 --> C --> R
```

| Step | Module |
|------|--------|
| Launcher returns id | `host-contracts/app-launcher.ts` |
| Open registers PENDING | `core/handlers/dacp/app-handlers.ts` |
| WCP4 adopt vs mint | `core/handlers/dacp/wcp-handlers.ts` |
| Port map migration | `protocols/wcp/wcp-connection-management.ts` |

## Intent resolution flow

```mermaid
sequenceDiagram
  participant App as Raising app
  participant DA as DesktopAgent
  participant Edge as WCPConnector
  participant Host as Host IntentResolver

  App->>DA: raiseIntentRequest
  DA->>DA: multiple handlers — pause
  DA->>Edge: intentResolverNeeded
  Edge->>Host: event (or preset calls IntentResolver.resolve)
  Host->>Host: show picker UI
  Host->>Edge: resolveIntentSelection
  Edge->>DA: selection
  DA->>App: intent delivered to target
```

Two mechanisms exist for intent UI — see [integrator guide — intent resolver](./integrator-guide#intent-resolver--host-shell-ui):

- **Host shell (default):** `intentResolver` contract or `intentResolverNeeded` event
- **WCP3 injection:** `wcpOptions.intentResolverUrl` — `@finos/fdc3` loads iframe in app window

## Channel change flow (host chrome)

```mermaid
sequenceDiagram
  participant Chrome as Host channel toolbar
  participant Plat as SailPlatform (optional)
  participant Edge as WCPConnector
  participant DA as DesktopAgent
  participant App as App iframe

  Chrome->>Plat: changeAppChannel(instanceId, channelId)
  Plat->>Edge: joinUserChannelRequest via connectorTransport
  Edge->>DA: DACP + meta.source.instanceId
  DA->>DA: update instance.currentUserChannel
  DA->>Edge: channelChangedEvent
  Edge->>App: userChannelChanged
  Edge->>Chrome: channelChanged event
```

Pure DA hosts without `SailPlatform` use `getBrowserDesktopAgentSession` — see [integrator guide](./integrator-guide#channel-selector--host-shell-ui).

## Testing layers

| Layer | Suite | Proves |
|-------|-------|--------|
| DACP handlers | Cucumber + MockTransport (~103 `@conformance2.2`) | FDC3 handler behaviour |
| Handler units | Vitest in `dacp/__tests__/` | Individual request paths |
| Edge seam | `wcp-desktop-agent.integration.test.ts` | WCP + MessagePort + DA routing |
| Full oracle | FINOS toolbox via conformance harness | End-to-end browser behaviour |

See [conformance traceability](./conformance) for BDD vs toolbox gaps.

## Related

- [Integrator guide](./integrator-guide) — host contracts, presets, deployment decision tree
- [Channel selection (Sail stack)](../../architecture/channel-selection) — `SailPlatform` channel APIs
- [@finos/sail-platform-api](../platform-api/overview) — workspace, layout, `SailPlatform` wrapper
