---
sidebar_position: 2
title: Integrator guide
---

# Browser edge and Desktop Agent

This document is the **primary integrator guide** for FDC3 in the browser. The package implements two cooperating roles:

1. **Browser edge** — everything that talks to child app browsing contexts (WCP, MessagePort, per-app routing).
2. **Desktop Agent (DA)** — headless FDC3 logic (DACP handlers, channel state, intents, instance registry).

Everything else is detail under one of those two boxes.

## Two-box model

```text
┌────────────────────────── BROWSER EDGE ──────────────────────────┐
│  Host shell: iframes, AppLauncher, optional IntentResolver UI    │
│  WCPConnector (app-connection/)                                  │
│    • WCP1–3 handshake (postMessage + MessageChannel)             │
│    • MessagePort per connected app                               │
│    • Routes DACP by meta.destination.instanceId                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │ Transport — ONE pipe (not per app)
                             ▼
┌────────────────────────── DESKTOP AGENT ─────────────────────────┐
│  DesktopAgent (core/)                                            │
│    • All fdc3.* behaviour via DACP handlers                      │
│    • WCP4–5 identity validation → canonical instanceId           │
│    • Channel membership, intents, open-with-context, heartbeat   │
└──────────────────────────────────────────────────────────────────┘
```

| Role | Package path | Speaks to |
|------|--------------|-----------|
| Browser edge | `src/app-connection/` (incl. `wcp/`) | iframe or child-window apps (WCP + MessagePort) |
| Desktop Agent | `src/core/` (incl. `dacp/`) | Host via `Transport`; apps only via edge |

**InMemoryTransport** (local mode) is only the **short internal wire** between edge and DA in the same JS process. It is **not** how apps connect. Toolbox `AppTimeout` failures usually mean **MessagePort routing or instanceId mismatch** on the edge, not broken InMemoryTransport.

## Host contract example

FDC3 in the browser is three runtime parts. Only the bottom two come from this package; **your host shell** wires the contracts in the middle.

```text
  FDC3 Apps          Your host (contracts)       FDC3 engine
  @finos/fdc3    →   launcher · directory   →   createBrowserDesktopAgent()
  getAgent()         intent UI · channel UI      (edge + DA, in-process)
                     open/close · lifecycle
```

Iframe apps call `fdc3.getAgent()` via `@finos/fdc3` — you do not implement that layer. You **do** implement the host contracts below, then pass them to `createBrowserDesktopAgent`.

### Browser mode (engine in same tab)

```typescript
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent/presets"
import type { AppLauncher, ChannelControl } from "@finos/sail-desktop-agent"

// --- Host contract: open apps (required) ---

const appShell = document.getElementById("app-shell")!

const appLauncher: AppLauncher = {
  async launch(request, app) {
    const instanceId = request.app?.instanceId ?? crypto.randomUUID()
    const iframe = document.createElement("iframe")
    iframe.name = instanceId // MUST match WCP4 identity — host ↔ engine link
    iframe.src = app.type === "web" ? (app.details?.url as string) : ""
    iframe.dataset.appId = app.appId
    appShell.appendChild(iframe)
    return { appId: app.appId, instanceId }
  },
}

// --- Host contract: channel chrome (optional) ---
// Default wcpOptions omit channelSelectorUrl injection — the host owns channel UI.
// ChannelControl is the contract shape for your toolbar (not a createBrowserDesktopAgent option yet).
// SailPlatform implements channel changes via changeAppChannel; pure DA hosts use getAppUserChannelId + shell UI.

const channelToolbar: ChannelControl = {
  async selectChannel(request) {
    return showChannelPicker(request.availableChannels, request.currentChannel)
  },
}
// channelToolbar.selectChannel(...) from your shell when the user picks a channel

// --- Wire engine + host contracts ---

const desktopAgent = createBrowserDesktopAgent({
  appDirectories: ["/apps.json"],
  appLauncher,
  // wcpOptions omitted → intentResolverUrl/channelSelectorUrl false (host-owned UI)

  onAppConnected: meta => {
    tabs.markConnected(meta.instanceId, meta.appId)
  },
  onAppDisconnected: instanceId => {
    tabs.remove(instanceId)
    appShell.querySelector(`iframe[name="${instanceId}"]`)?.remove()
  },
  onHandshakeFailed: (error, connectionId) => {
    console.error("WCP handshake failed", connectionId, error)
  },
})

// Auto-started by default — iframe apps can await fdc3.getAgent()

// Host-owned intent resolver UI. The engine calls this only for ambiguous resolution.
desktopAgent.intentResolverUI?.onRequest(request => {
  void showIntentPicker(request.choices ?? []).then(choice => {
    if (choice) {
      desktopAgent.intentResolverUI?.select(request.requestId, choice)
    } else {
      desktopAgent.intentResolverUI?.cancel(request.requestId)
    }
  })
})

// Host closes an app: tear down iframe, then tell the engine
function closeApp(instanceId: string) {
  appShell.querySelector(`iframe[name="${instanceId}"]`)?.remove()
  desktopAgent.disconnectInstance(instanceId)
}

// Host reads channel membership for chrome (join usually via app fdc3 API or your channel bar)
function currentChannel(instanceId: string) {
  return desktopAgent.getAppUserChannelId(instanceId)
}

// Teardown
// desktopAgent.stop()
```

| Host contract | Required? | Wired via |
|---------------|-----------|-----------|
| `appLauncher` | **Yes** — FDC3 `open()` needs a host that creates iframes/windows | `createBrowserDesktopAgent({ appLauncher })` |
| `appDirectories` or `apps` | **Yes** — app metadata for open/intent resolution | `appDirectories: [...]` or `apps: [...]` |
| `intentResolverUI` | When multiple handlers — host shell UI, not WCP3 iframe injection | Returned on the browser preset `DesktopAgent` handle |
| Channel UI | When `channelSelectorUrl` is false (default) — host toolbar/chrome | `ChannelControl` contract; read state with `getAppUserChannelId` |
| Lifecycle | Recommended — tab chrome, cleanup | `onAppConnected` / `onAppDisconnected` / `onHandshakeFailed` |

`createBrowserDesktopAgent` returns a single `DesktopAgent` handle; the browser edge starts and stops with `desktopAgent.start()` / `desktopAgent.stop()`. Browser hosts also get `desktopAgent.intentResolverUI` for framework-neutral resolver UI wiring. You do not manage `WCPConnector` in application code.

## `getAgent()` discovery support

FDC3 `getAgent()` supports more than one web mechanism. Sail's browser host implements the browser-resident **proxy** mechanism: a child app sends `WCP1Hello` with `postMessage`, Sail replies with `WCP3Handshake`, and app API calls then travel over a `MessagePort` using DACP.

| Scenario | Does standard `getAgent()` find Sail? | What to do |
|----------|---------------------------------------|------------|
| App in an iframe owned by the Sail host | Yes. This is the primary and tested browser path. | Set the iframe `name` to the host instance id and list the app URL in the app directory. |
| App opened with `window.open` by the Sail host | Can work if the child keeps `window.opener` and the app directory identity matches. | Implement a window-based `AppLauncher`; this is not the default `sail-web` launcher. |
| App in a traditional preload-style container | `getAgent()` can return `window.fdc3` when the container injects it. | This is a different FDC3 web interface. Sail's browser preset does not currently install `window.fdc3` into the host page. |
| React component rendered in the same top-level page as the Sail host | No, not as a separate standard FDC3 app. There is no parent/opener for proxy discovery, and no Sail preload object is installed. | Treat it as host UI and use `SailPlatform` / `DesktopAgent` host APIs, or put it in an iframe/window. |

This is the key difference for teams coming from preload-style desktop agents: in the browser-resident model, independent apps usually need independent browsing contexts. Same-page components can still participate in the product UI, but they are not separate FDC3 app instances through `@finos/fdc3` unless Sail later provides a dedicated top-level adapter.

The browsing-context boundary is also a feature. A Sail host can embed apps from different teams and technology stacks side by side: React, Vue, Angular, Svelte, or plain JavaScript. Each app owns its bundle and deployment URL; Sail owns launch, identity, channels, intents, and lifecycle.

### App code

Application code should stay vendor-neutral and use the FDC3 package:

```typescript
import { fdc3 } from "@finos/fdc3"

const agent = await fdc3.getAgent()

await agent.addContextListener("fdc3.instrument", context => {
  console.log("instrument context", context)
})

await agent.broadcast({
  type: "fdc3.instrument",
  id: { ticker: "AAPL" },
})
```

Host code supplies the app directory and launches the app. App code should not import `@finos/sail-desktop-agent`, inspect parent windows, or manually speak DACP.

### Same-page components

If your "app" is a React component rendered inside the same page that created `SailPlatform` or `createBrowserDesktopAgent`, it is part of the host shell. Use the host APIs already available in that process:

```typescript
const platform = new SailPlatform({ appLauncher, intentResolver })
platform.start()

const channels = platform.getUserChannels()
const currentChannel = platform.getAppUserChannel(instanceId)
await platform.changeAppChannel(instanceId, "fdc3.channel.1")
```

If you need those components to behave like independent FDC3 apps with their own identity, listeners, channel membership, and lifecycle, launch each one in an iframe or child window. A future Sail component adapter could provide a direct in-page API, but that would be a Sail-specific integration path rather than the standard `@finos/fdc3` `getAgent()` discovery path.

Installing a global `window.fdc3` object in the host page would not by itself make each component an independent app. Every component would see the same global API and share the same browsing context. Without an additional Sail-owned identity layer, their listeners, channel membership, and app metadata would all belong to one host-page app identity. Multiple component libraries should therefore not each try to install their own `window.fdc3`; that would create competing globals rather than separate FDC3 apps.

### Wiring intent resolver and channel selector UI

FDC3 defines **two different mechanisms** for each UI. Sail and this package default to **host-owned UI** (no iframe injected into the app window).

| UI | Mechanism A — host shell (recommended) | Mechanism B — WCP3 iframe injection |
|----|----------------------------------------|-------------------------------------|
| Intent resolver | `desktopAgent.intentResolverUI` or low-level `intentResolver` contract | `wcpOptions.intentResolverUrl` — `@finos/fdc3` loads a page **inside the app window** |
| Channel selector | Host toolbar + `joinUserChannel` on behalf of the app | `wcpOptions.channelSelectorUrl` — `@finos/fdc3` loads a page **inside the app window** |

**Default (omit `wcpOptions`):** both URLs are `false` — your host shell owns both UIs. This matches FDC3 when the [browser-resident host](https://fdc3.finos.org/docs/api/specs/browserResidentDesktopAgents) renders chrome outside the app iframe.

#### Intent resolver — host shell UI

When `raiseIntent` or `raiseIntentForContext` is ambiguous, the engine pauses and asks the host to pick one choice. Explicit `AppIdentifier` targets and unambiguous matches bypass this UI.

**Option 1 — browser preset UI methods (simplest):** use the framework-neutral `intentResolverUI` returned on the browser preset handle:

```typescript
const desktopAgent = createBrowserDesktopAgent({ appLauncher, appDirectories: ["/apps.json"] })

desktopAgent.intentResolverUI?.onRequest(request => {
  // Open YOUR modal — React dialog, Vue component, native picker, etc.
  // Use choices for raiseIntentForContext, where the user may choose intent + app.
  void myIntentModal.open({
    context: request.context,
    choices: request.choices ?? [],
  }).then(choice => {
    if (choice) {
      desktopAgent.intentResolverUI?.select(request.requestId, choice)
    } else {
      desktopAgent.intentResolverUI?.cancel(request.requestId)
    }
  })
})
```

The resolver request includes running app instances, launchable app rows, and display metadata from the app directory where available (`title`, `name`, `icons`, `screenshots`, `instanceMetadata`). A selected choice feeds the normal Desktop Agent delivery path: launch if needed, wait for the listener if needed, send the `intentEvent`, and return `IntentResolution` to the raising app.

The `intentResolverUI` request/response shapes are Sail host UI adapter types, not official FDC3 DACP or WCP wire messages.

**Option 2 — low-level host contract:** provide your own `IntentResolver` if you want to own promise correlation yourself:

```typescript
const desktopAgent = createBrowserDesktopAgent({
  appLauncher,
  intentResolver: {
    async resolve(request) {
      const choice = await myIntentModal.open({ choices: request.choices ?? [] })
      if (!choice) return null
      return {
        selectedHandler: choice.handler,
        target: {
          appId: choice.handler.app.appId,
          instanceId: choice.handler.instanceId,
        },
        intent: choice.intent.name,
      }
    },
  },
})
```

**Option 3 — connector event listener (advanced):** use only when you already hold `wcpConnector` (`createWCPClient`) or need `getBrowserDesktopAgentSession`:

```typescript
import { getBrowserDesktopAgentSession } from "@finos/sail-desktop-agent/presets"

const { wcpConnector } = getBrowserDesktopAgentSession(desktopAgent)

wcpConnector.on("intentResolverNeeded", payload => {
  void myIntentModal.open(payload).then(selection => {
    wcpConnector.resolveIntentSelection({
      requestId: payload.requestId,
      selectedHandler: selection
        ? { appId: selection.appId, instanceId: selection.instanceId }
        : null,
    })
  })
})
```

`intentResolverNeeded` is a Sail browser connector event, not an official FDC3 WCP wire message. Prefer `desktopAgent.intentResolverUI` unless you are doing manual connector composition.

**Option 4 — injected iframe (uncommon for custom hosts):**

```typescript
createBrowserDesktopAgent({
  appLauncher,
  wcpOptions: { intentResolverUrl: true }, // FINOS reference UI, or a URL string
})
```

No `intentResolver` contract needed — `@finos/fdc3` hosts the picker inside each app window.

#### Channel selector — host shell UI

When `channelSelectorUrl` is `false` (default), the **host** renders channel chrome (toolbar button, per-app dropdown). The app does not get an injected channel iframe.

1. **Read** current channel: `desktopAgent.getAppUserChannelId(instanceId)`
2. **List** channels: `desktopAgent.getUserChannels()`
3. **Change** channel: send `joinUserChannelRequest` / `leaveCurrentChannelRequest` on behalf of the app, then wait for `channelChanged` on the edge

With **`SailPlatform`** (easiest — wraps the DACP send):

```typescript
const platform = new SailPlatform({ appLauncher, intentResolver })
await platform.start()

// In your ChannelSelector component (see packages/sail-web/src/components/ChannelSelector.tsx):
const channels = platform.getUserChannels()
const currentId = platform.getAppUserChannel(instanceId)
await platform.changeAppChannel(instanceId, channelId) // or null to leave

// Keep toolbar state in sync
platform.connector.on("channelChanged", (id, channelId) => {
  updateTabChrome(id, channelId)
})
```

With **`createBrowserDesktopAgent` only** (no platform-api):

```typescript
import { getBrowserDesktopAgentSession } from "@finos/sail-desktop-agent/presets"

const { wcpConnector, connectorTransport } = getBrowserDesktopAgentSession(desktopAgent)

function changeAppChannel(instanceId: string, channelId: string | null): Promise<void> {
  return new Promise((resolve, reject) => {
    const requestUuid = crypto.randomUUID()
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error("Channel change timeout"))
    }, 10_000)

    const onChanged = (changedId: string, newChannelId: string | null) => {
      if (changedId === instanceId && newChannelId === channelId) {
        cleanup()
        resolve()
      }
    }
    const cleanup = () => {
      clearTimeout(timeout)
      wcpConnector.off("channelChanged", onChanged)
    }

    wcpConnector.on("channelChanged", onChanged)

    connectorTransport.send({
      type: channelId ? "joinUserChannelRequest" : "leaveCurrentChannelRequest",
      payload: channelId ? { channelId } : {},
      meta: {
        requestUuid,
        timestamp: new Date().toISOString(),
        source: { instanceId },
      },
    })
  })
}

// Host toolbar click handler
channelButton.onclick = () => {
  void changeAppChannel(activeInstanceId, "fdc3.channel.1")
}
```

`ChannelControl` in `host-contracts/` describes the **picker contract** (`selectChannel(request)`); wire your toolbar to call `changeAppChannel` with the returned channel id. Sail web does not use `ChannelControl` directly — it uses `SailPlatform.changeAppChannel` plus `channelChanged` events (`connection-store.ts`).

**Injected channel iframe (uncommon):**

```typescript
createBrowserDesktopAgent({
  appLauncher,
  wcpOptions: { channelSelectorUrl: "/host/channel-selector.html" }, // or true for FINOS reference
})
```

#### End-to-end with Sail (reference stack)

```text
SailPlatform.start()
  → createBrowserDesktopAgent({ wcpOptions: false/false })
  → SailDesktopAgentProvider wires stores to platform.connector events
  → <IntentResolverDialog /> listens via intent-resolver-store
  → <ChannelSelector instanceId={...} /> calls platform.changeAppChannel
```

See `packages/sail-web/src/contexts/SailDesktopAgentContext.tsx` for provider wiring.

### Remote engine (server or Web Worker)

Host contracts stay the same on the **browser** side; only engine placement changes.

```typescript
import { createWCPClient } from "@finos/sail-desktop-agent/presets"
import { DesktopAgent } from "@finos/sail-desktop-agent"
import type { AppLauncher } from "@finos/sail-desktop-agent"

// Browser host — same appLauncher, same iframe shell, same lifecycle UI
const { wcpConnector, start, stop } = createWCPClient({
  transport: mySocketOrWorkerTransport,
  // same wcpOptions default: host-owned intent/channel UI
})

wcpConnector.on("appConnected", meta => tabs.markConnected(meta.instanceId, meta.appId))
wcpConnector.on("appDisconnected", id => tabs.remove(id))
start()

// Remote process — engine only (no WCP, no iframes)
const agent = new DesktopAgent({
  transport: serverTransport,
  appLauncher: serverSideLauncherOrStub, // if open() originates server-side
  appDirectories: ["/apps.json"],
})
agent.start()
```

For the full Sail stack (workspace, layout, pre-built launcher/resolver/channel UI), use `SailPlatform` in `@finos/sail-platform-api` — it implements the same host contracts and delegates engine wiring to this package.

## FDC3 2.2 alignment

This package implements a [Browser-Resident Desktop Agent](https://fdc3.finos.org/docs/api/specs/browserResidentDesktopAgents) with the split prescribed by FDC3 2.2:

| FDC3 2.2 concept | This package |
|------------------|--------------|
| `getAgent()` / WCP connection | **Edge** (`WCPConnector`) — WCP1–3, per-app `MessagePort` |
| DACP over `MessagePort` | **DA** (`DesktopAgent`) — all `fdc3.*` API behaviour |
| WCP4 `ValidateAppIdentity` | **DA** — `core/handlers/dacp/wcp-handlers.ts` |
| WCP5 success / failure | **DA** responds; **edge** migrates port map to canonical `instanceId` |
| WCP6 `Goodbye` | **Edge** tears down port; **DA** cleans registry |

Spec references (v2.2):

- [Web Connection Protocol](https://fdc3.finos.org/docs/api/specs/webConnectionProtocol) — handshake, UI URL fields, identity validation
- [Browser-Resident Desktop Agents](https://fdc3.finos.org/docs/api/specs/browserResidentDesktopAgents) — host shell responsibilities
- [Desktop Agent Communication Protocol](https://fdc3.finos.org/docs/api/specs/desktopAgentCommunicationProtocol) — DACP request/response routing via `meta.source` / `meta.destination`

### WCP phases (spec vs implementation)

| Step | FDC3 2.2 requirement | Owner in this package |
|------|------------------------|------------|
| WCP1 `Hello` | App posts to parent; includes `connectionAttemptUuid` | App (`@finos/fdc3`); edge listens |
| WCP3 `Handshake` | DA returns `MessagePort` + `intentResolverUrl` + `channelSelectorUrl` | Edge sends; values from `wcpOptions` |
| WCP4 | First message on port; `identityUrl` / `actualUrl` origins MUST match `WCP1` origin | DA validates |
| WCP4 reconnect | Optional `instanceId` + `instanceUuid`; DA MUST verify `instanceUuid` secret and `WindowProxy` | DA (`instance-identity-registry`) |
| WCP5 | DA assigns or reuses `appId`, `instanceId`, `instanceUuid` | DA; edge updates routing |
| DACP | All FDC3 API traffic on validated port | DA handlers; edge routes by `meta.destination.instanceId` |

### Injected UI URLs (`WCP3Handshake` payload)

FDC3 names these fields **`intentResolverUrl`** and **`channelSelectorUrl`** on the WCP3 payload. Each MAY be:

- a **URL string** — `@finos/fdc3` loads that page in an iframe for the app window;
- **`false`** — the app does not need an injected iframe (host or DA provides UI another way);
- **`true`** — use the FINOS reference UI.

This package defaults both to **`false`** when `wcpOptions` is omitted. That is spec-compliant when the host renders channel chrome and intent resolution outside injected iframes (see [Channel Selector and Intent Resolver](https://fdc3.finos.org/docs/api/specs/browserResidentDesktopAgents#channel-selector-and-intent-resolver-user-interfaces)).

**Two different “intent resolver” mechanisms:**

| Mechanism | Purpose |
|-----------|---------|
| WCP3 `intentResolverUrl` | iframe URL injected **into the app window** by `@finos/fdc3` |
| `intentResolverUI` on the browser preset handle | Host UI methods when DA needs disambiguation; not an official DACP/WCP message |
| `intentResolver` option on `createBrowserDesktopAgent` | Low-level host callback for custom composition |

Most browser hosts use **`false`** for WCP3 URLs and implement resolver/channel UI in the host shell via [host contracts](https://github.com/finos/FDC3-Sail/tree/main/packages/sail-desktop-agent/src/host-contracts).

### Package extensions (not FDC3 API)

These behaviours stay within FDC3 MUSTs but are host conventions supported by this library:

- **`iframe name = launcher instanceId`** — correlates `AppLauncher` output with WCP4; cross-origin iframes may not expose `window.name` to the host (integration tests use same-origin fixtures).
- **Host-adopt path** — `open` registers a `PENDING` instance; WCP4 may claim that `instanceId` before first connect so canonical id matches the launcher (supports `open()` returning `instanceId` early).
- **`HostInstanceBinding`** (below) — proposed integrator sugar only; not part of the FDC3 standard.

## Heartbeat and liveness configuration

FDC3 2.2 defines [`heartbeatEvent`](https://fdc3.finos.org/docs/api/specs/desktopAgentCommunicationProtocol#checking-apps-are-alive) / [`heartbeatAcknowledgment`](https://fdc3.finos.org/docs/api/specs/desktopAgentCommunicationProtocol#checking-apps-are-alive) as an optional **Desktop Agent** liveness mechanism — “periodically or on demand,” depending on how the app is connected. Apps respond when the DA sends a heartbeat; there is **no** `getAgent()` parameter to disable it from the app side.

Sail exposes heartbeat as **host-level configuration** on `DesktopAgent` / `createBrowserDesktopAgent` / `SailPlatform`. Settings apply to **every** connected instance for that agent — not per app or per entry in the app directory.

| Option | Default | Purpose |
|--------|---------|---------|
| `heartbeatEnabled` | `true` | When `true`, start DACP heartbeat after successful WCP5. When `false`, skip heartbeat timers and `heartbeatEvent` traffic. |
| `heartbeatIntervalMs` | `30_000` | Milliseconds between heartbeat sends (only when enabled). |
| `heartbeatTimeoutMs` | `60_000` | Milliseconds without an ack before the instance is torn down (only when enabled). |

Product defaults live in `packages/sail-desktop-agent/src/core/sail-default-config.ts` and merge in the `DesktopAgent` constructor via `resolveDesktopAgentConfig()`.

```typescript
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent/presets"

const desktopAgent = createBrowserDesktopAgent({
  appLauncher,
  heartbeatEnabled: true, // default — omit to keep enabled
  heartbeatIntervalMs: 30_000,
  heartbeatTimeoutMs: 60_000,
})

// Disable heartbeat when the host relies on WCP6 / MessagePort teardown only
const quietAgent = createBrowserDesktopAgent({
  appLauncher,
  heartbeatEnabled: false,
})
```

```typescript
// Remote or manual composition — same options on DesktopAgent
import { DesktopAgent } from "@finos/sail-desktop-agent"

const agent = new DesktopAgent({
  transport: daTransport,
  appLauncher,
  heartbeatEnabled: false,
})
```

**When to disable:** rare — e.g. local debugging, or a host that implements disconnect detection solely via [WCP6 Goodbye](https://fdc3.finos.org/docs/api/specs/webConnectionProtocol#step-5-disconnection) and port teardown. Production and conformance runs should normally leave heartbeat **enabled**; browser-resident agents often combine heartbeat with WCP6 and other signals.

**Logging vs protocol:** `@finos/fdc3` `getAgent({ logLevels: { proxy: "WARN" } })` hides `"Responding to heartbeat request"` in the browser console only. It does not stop heartbeat on the wire — use `heartbeatEnabled: false` on the host agent for that.

**Tests:** Cucumber uses shorter intervals via world config (`heartbeatIntervalMs` / `heartbeatTimeoutMs`). Vitest edge tests assert no connect-time flood when defaults are applied correctly.

## Connection lifecycle (happy path)

```mermaid
sequenceDiagram
  participant Host as Host shell
  participant Edge as WCPConnector
  participant DA as DesktopAgent
  participant App as App iframe

  Host->>Host: AppLauncher returns instanceId (iframe name)
  App->>Edge: WCP1Hello (postMessage)
  Edge->>App: WCP3Handshake + MessagePort
  App->>Edge: WCP4ValidateAppIdentity (claims host instanceId)
  Edge->>DA: WCP4 (+ temp instanceId)
  DA->>Edge: WCP5 (canonical instanceId)
  Edge->>Edge: Migrate temp → canonical in port map
  Edge->>App: WCP5 response
  App->>Edge: DACP e.g. joinUserChannel (MessagePort)
  Edge->>DA: DACP + meta.source.instanceId
  DA->>Edge: DACP + meta.destination.instanceId
  Edge->>App: DACP delivered on correct MessagePort
```

**Debugging rule:** follow **one instanceId** from launcher → iframe `name` → WCP4 payload → WCP5 canonical → `meta.destination.instanceId`. A break anywhere in that chain produces toolbox `AppTimeout`.

## Where WCP lives

| Phase | Owner | Location |
|-------|--------|----------|
| WCP1–3 (Hello, Handshake, MessageChannel) | **Edge** | `app-connection/wcp-connector.ts`, `app-connection/wcp/wcp1-3-handshake.ts` |
| Per-app MessagePort bridge | **Edge** | `app-connection/message-port-transport.ts`, `app-connection/wcp/wcp-message-routing.ts` |
| WCP4–5 (validate identity, canonical id) | **DA** | `core/handlers/dacp/wcp-handlers.ts` |
| WCP6 (Goodbye) | **Both** | Edge disconnects port; DA cleans registry |
| DACP (open, channels, intents, …) | **DA** | `core/handlers/dacp/*` |

Integrators normally touch **presets/factories** and **host contracts** (`AppLauncher`, `IntentResolver`), not WCP internals.

## How to wire (decision tree)

Use this tree instead of reading four parallel README patterns.

```text
Where does the Desktop Agent run?
│
├─ Same browser tab as your host UI
│    → createBrowserDesktopAgent() from @finos/sail-desktop-agent/presets
│    → Implement AppLauncher (iframes + instanceId on iframe name)
│    → Optional: intentResolverUI host methods; channel UI in host (omit wcpOptions → both URLs false)
│
└─ Remote (Node server, Web Worker, …)
     → Server/worker: new DesktopAgent({ transport: serverTransport })
     → Browser host: createWCPClient({ transport: clientTransport })
     → Same AppLauncher / iframe responsibilities on the browser side
```

| Integrator goal | Entry point | Avoid unless advanced |
|-----------------|-------------|------------------------|
| Ship a browser desktop | `createBrowserDesktopAgent` | Manual `InMemoryTransport` + `WCPConnector` |
| Remote DA | `createWCPClient` + server `DesktopAgent` | Duplicating WCP in app code |
| Unit-test FDC3 handlers | `MockTransport` + `DesktopAgent` | Expecting this to prove iframe delivery |

**Canonical import:** `@finos/sail-desktop-agent/presets` for application code and factories. `@finos/sail-desktop-agent/browser` (app-connection) remains for tree-shaking when you only need `WCPConnector` or `MessagePortTransport`.

## Public API — today vs simplified story

### Today (four equal-looking patterns in README)

```typescript
// Pattern 1 — preset
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent/presets"

// Pattern 2 — same factory, different path
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent/presets"

// Pattern 3 — remote client
import { createWCPClient } from "@finos/sail-desktop-agent/presets"

// Pattern 4 — manual
const [daTransport, wcpTransport] = createInMemoryTransportPair()
const desktopAgent = new DesktopAgent({ transport: daTransport })
const wcpConnector = new WCPConnector(wcpTransport)
```

### Browser edge (internal to the preset)

`createBrowserDesktopAgent` couples a hidden **`WCPConnector`** (the browser edge) to the returned `DesktopAgent`:

- `desktopAgent.start()` also starts the edge (`window` listener for WCP1, MessagePort routing)
- `desktopAgent.stop()` tears down the edge and the DA transport

You do **not** destructure or manage `wcpConnector` in application code. Host code uses `desktopAgent` plus `appLauncher` / `intentResolverUI`. Optional `onAppConnected` / `onAppDisconnected` callbacks replace direct `wcpConnector.on(...)` wiring.

Advanced access (host channel control via `connectorTransport`, edge-contract tests): `getBrowserDesktopAgentSession(desktopAgent)` from `@finos/sail-desktop-agent/presets`.

### Simplified integrator surface

```typescript
// 90% of browser hosts — one entry
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent/presets"

const desktopAgent = createBrowserDesktopAgent({
  appLauncher: myLauncher,
  // wcpOptions optional — defaults intentResolverUrl/channelSelectorUrl to false (FDC3 host-controlled)
})

desktopAgent.intentResolverUI?.onRequest(showIntentResolver)

// Auto-started by default — iframe apps connect via fdc3.getAgent()
```

Teardown: `desktopAgent.stop()`. Pass `autoStart: false` only if you must configure the agent before the edge listens, then call `desktopAgent.start()` yourself.

```typescript
// Injected FINOS reference UIs (WCP3 payload) — uncommon when the host owns UI
createBrowserDesktopAgent({
  appLauncher: myLauncher,
  wcpOptions: { intentResolverUrl: true, channelSelectorUrl: true },
})

// Custom iframe URLs (same names as FDC3 WCP3 payload fields)
createBrowserDesktopAgent({
  appLauncher: myLauncher,
  wcpOptions: {
    intentResolverUrl: "/host/intent-resolver.html",
    channelSelectorUrl: "/host/channel-selector.html",
  },
})

// Per-instance URLs — keep getters when URL depends on instanceId
createBrowserDesktopAgent({
  appLauncher: myLauncher,
  wcpOptions: {
    getChannelSelectorUrl: id => `/channels?instance=${id}`,
  },
})
```

```typescript
// Remote DA — browser side only
import { createWCPClient } from "@finos/sail-desktop-agent/presets"

const { wcpConnector, start } = createWCPClient({
  transport: myWebSocketClientTransport,
  // omit wcpOptions — same false/false default as local preset
})
start()
```

Manual composition stays in an **Advanced** appendix for framework authors, not the main quick start.

### `wcpOptions` — do you need to change anything?

**No.** Omitting `wcpOptions` already produces `intentResolverUrl: false` and `channelSelectorUrl: false` on every WCP3Handshake (see `WCPConnector` constructor). You do **not** need:

```typescript
wcpOptions: {
  getIntentResolverUrl: () => false,
  getChannelSelectorUrl: () => false,
}
```

unless you prefer the explicit form. Static fields (`intentResolverUrl`, `channelSelectorUrl`) mirror the FDC3 payload names and are equivalent to constant getters. Use **`getIntentResolverUrl` / `getChannelSelectorUrl`** only when the URL varies per connection (`instanceId` at handshake time is still `temp-{uuid}` until WCP5).

## Instance identity — today vs proposed

### Today (logic spread across modules)

Identity is correct when several conditions align, but the story is implicit:

```text
AppLauncher.launch() → instanceId
       ↓
iframe name={instanceId}
       ↓
WCP1Hello → temp-{connectionAttemptUuid} on edge connection map
       ↓
WCP4 payload.instanceId + instanceUuid + sourceWindow
       ↓
wcp-handlers: canReuse | canAdoptPendingHost | else createAppInstance (new UUID)
       ↓
WCP5 canonical instanceId → edge migrates MessagePort map temp → canonical
       ↓
open-with-context / broadcast / raiseIntent use meta.destination.instanceId
```

Relevant code today:

- Launcher contract: `src/host-contracts/app-launcher.ts`
- Open registers **PENDING**: `src/core/handlers/dacp/app-handlers.ts`
- WCP4 adopt vs mint: `src/core/handlers/dacp/wcp-handlers.ts` (`canAdoptPendingHostInstance`, `createAppInstance`)
- Port map migration: `src/app-connection/wcp/wcp-connection-management.ts`, `wcp-message-routing.ts`
- Open-with-context waits on target id: `src/core/handlers/dacp/utils/open-with-context.ts`

```mermaid
flowchart TB
  subgraph today ["Today — implicit pipeline"]
    L1[AppLauncher.instanceId]
    I1[iframe name]
    T1[temp connection id]
    W4[WCP4 handlers — 3 branches]
    C1[canonical id]
    R1[routing map]
    L1 --> I1 --> T1 --> W4 --> C1 --> R1
  end
```

### Proposed (same split, explicit binding) — not in FDC3 2.2

Keep edge + DA split. Add a **single host-facing contract** and one log line per transition (illustrative future API):

```typescript
// host-contracts/instance-binding.ts (proposed — illustrative)

/** One correlation record per launched iframe; edge + DA share this view. */
export interface HostInstanceBinding {
  /** From AppLauncher / iframe name — host authority */
  launcherInstanceId: string
  /** WCP1Hello correlation */
  connectionAttemptUuid: string
  /** After WCP5 — used in all DACP meta.destination */
  canonicalInstanceId: string
}

/** Host calls when mounting iframe (proposed API) */
export function registerHostInstanceBinding(
  wcpConnector: WCPConnector,
  binding: Pick<HostInstanceBinding, "launcherInstanceId" | "connectionAttemptUuid">
): void {
  // Edge: ensure PENDING instance exists under launcherInstanceId
  // Edge: log [instance-binding] registered launcher=… attempt=…
}

/** Edge calls after WCP5 (proposed) */
export function finalizeHostInstanceBinding(
  binding: HostInstanceBinding
): void {
  // Assert canonical === launcher when adopt path taken
  // log [instance-binding] canonical=… launcher=… match=true|false
}
```

```mermaid
flowchart TB
  subgraph proposed ["Proposed — explicit binding"]
    L2[registerHostInstanceBinding]
    WCP[WCP handshake]
    F2[finalizeHostInstanceBinding]
    R2[routing uses binding.canonicalInstanceId only]
    L2 --> WCP --> F2 --> R2
  end
```

**No merge of edge and DA** — only a named object and structured logs so toolbox debugging is “follow `HostInstanceBinding`,” not grep three folders.

## Testing model

| Suite | Proves | Does not prove |
|-------|--------|----------------|
| Cucumber + `MockTransport` (~103 `@conformance2.2`) | DA / DACP handler behaviour | iframe MessagePort delivery |
| Vitest handler tests | Individual DACP paths | WCP handshake |
| **Edge contract** (`wcp-desktop-agent.integration.test.ts`) | Edge + DA + MessagePort seam | Full FINOS toolbox oracle |

**Edge contract tests** (maintain here):

1. Single app: WCP4 → temp→canonical migration (existing).
2. Two apps: user-channel broadcast received on listener app.
3. Host instanceId: open → PENDING → WCP4 adopt → canonical === launcher id.
4. Assert `meta.destination.instanceId` on delivered `broadcastEvent`.

Run:

```bash
npm test -w @finos/sail-desktop-agent -- wcp-desktop-agent.integration
```

## Related docs

- [Package overview](./overview)
- [Composition & internals](./composition)
- [Conformance traceability](./conformance)