---
name: consume-sail-desktop-agent
description: Integrates @finos/sail-desktop-agent as an npm consumer when building an FDC3 desktop platform host. Covers package entry points, when to use createBrowserDesktopAgent vs createWCPClient vs new DesktopAgent, WCP UI options (platform-owned vs iframe URLs), and app directory hooks. Use when constructing a Desktop Agent from scratch, wiring transports, or helping someone embed Sail desktop-agent outside this monorepo.
disable-model-invocation: true
---

# Consume @finos/sail-desktop-agent

Guides agents helping integrators build an **FDC3 platform** (desktop host) using the published npm package — not contributors hacking `packages/sail-desktop-agent/src`.

For FDC3 2.2 spec semantics (App Directory schema, DACP, WCP spec text), load **`fdc3-expert`** and fetch upstream docs. This skill covers **Sail package wiring only**.

## Package surface

| Import | Use |
|--------|-----|
| `@finos/sail-desktop-agent` | `DesktopAgent`, `resolveDesktopAgentConfig`, `AppDirectoryManager`, core types |
| `@finos/sail-desktop-agent/browser` | `createBrowserDesktopAgent`, `createWCPClient`, `WCPConnector`, `MessagePortTransport` |
| `@finos/sail-desktop-agent/transports` | `createInMemoryTransportPair`, `InMemoryTransport` (tests, manual composition) |

**Out of scope:** `@finos/sail-platform-api`, `@finos/sail-web`, monorepo-relative imports (`../../packages/...`), Cucumber `test/support/*`, `*ForTesting` helpers.

## Workflow (required)

1. **Interview the integrator** — do not pick an architecture silently. Ask the forks below; explain trade-offs; then implement their choice.
2. **Use published imports only** — assume `npm install @finos/sail-desktop-agent` and built `dist/` exports.
3. **Call `start()`** — both `desktopAgent.start()` and `wcpConnector.start()` (or factory `start()`) before apps connect.
4. **Load apps** — `open` / `findIntent` need directory data; see [App directory](#app-directory).
5. **Delegate spec depth** — point to `fdc3-expert` for App Directory JSON shape, intent names, and conformance wording.

---

## Fork 1: How to assemble the agent

Ask:

> Are you running the Desktop Agent **in the same browser window** as your platform UI, **remote** (server/worker owns the DA), or do you need **full manual control** over transport and WCP?

| Choice | When to use | Entry |
|--------|-------------|--------|
| **A. Local browser DA** (default depth) | Platform shell and DA share one JS realm; iframe apps use `getAgent()` + WCP | `createBrowserDesktopAgent()` |
| **B. Remote DA** | DA runs on server or in a Web Worker; browser only terminates WCP to iframes | `createWCPClient({ transport })` — **you** supply a `Transport` to the remote DA |
| **C. Manual composition** | Custom transport topology, tests, or non-browser host with your own connector | `new DesktopAgent({ transport })` + `new WCPConnector(otherSide)` + paired transports |

### A. Local browser DA (primary walkthrough)

```typescript
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent/browser"

const { desktopAgent, wcpConnector, start, stop } = createBrowserDesktopAgent({
  appDirectories: ["https://your-host.example/apps/v2/apps"],
  wcpOptions: {
    getIntentResolverUrl: () => false,
    getChannelSelectorUrl: () => false,
  },
})

start()
// iframe apps: fdc3.getAgent() → WCP handshake → DACP on desktopAgent
```

Factory behavior (know this when debugging):

- Creates an **in-memory transport pair** (DA ↔ WCP connector).
- Wires `requestIntentResolution` on `DesktopAgent` to `wcpConnector.requestIntentResolution`.
- Optionally loads `appDirectories` via `desktopAgent.getAppDirectory().loadDirectory()`.

### B. Remote DA (explain, implement if chosen)

```typescript
import { createWCPClient } from "@finos/sail-desktop-agent/browser"
// import your Transport implementation (WebSocket, worker bridge, etc.)

const { wcpConnector, start, stop } = createWCPClient({
  transport: myTransportToRemoteDesktopAgent,
  wcpOptions: { /* same UI fork as below */ },
})

start()
```

The remote side must run a `DesktopAgent` (or equivalent) connected to the **other end** of `transport`. This package does not ship Socket.IO or worker transports — only the contract.

### C. Manual composition (explain, implement if chosen)

```typescript
import { DesktopAgent } from "@finos/sail-desktop-agent"
import { WCPConnector } from "@finos/sail-desktop-agent/browser"
import { createInMemoryTransportPair } from "@finos/sail-desktop-agent/transports"

const [daTransport, wcpTransport] = createInMemoryTransportPair()

const wcpConnector = new WCPConnector(wcpTransport, { /* wcpOptions */ })
const desktopAgent = new DesktopAgent({
  transport: daTransport,
  requestIntentResolution: req => wcpConnector.requestIntentResolution(req),
})

desktopAgent.start()
wcpConnector.start()
```

**Never** rely on the default unpaired `InMemoryTransport` inside `new DesktopAgent()` for production browser bridges — use a **pair** or `createBrowserDesktopAgent()`.

---

## Fork 2: Intent resolver and channel selector UI

Ask:

> Will your platform **own** intent/channel UI in the host page, or will apps receive **iframe URLs** in `WCP3Handshake`?

| Model | `getIntentResolverUrl` / `getChannelSelectorUrl` | Platform work |
|-------|--------------------------------------------------|---------------|
| **Platform-owned UI** | Return `false` (Sail factory default) | Listen for resolver flow; render picker; call `wcpConnector.resolveIntentSelection(response)` |
| **Iframe-injected UI** | Return absolute URLs per `instanceId` | Host those pages; they participate in WCP intent-resolver protocol |

### Platform-owned UI

```typescript
const { wcpConnector, start } = createBrowserDesktopAgent({
  wcpOptions: {
    getIntentResolverUrl: () => false,
    getChannelSelectorUrl: () => false,
  },
})

wcpConnector.on("intentResolverNeeded", payload => {
  // Show your UI: payload carries candidate apps/intents
  // On user choice:
  wcpConnector.resolveIntentSelection({
    requestId: payload.requestId,
    appId: chosen.appId,
    instanceId: chosen.instanceId,
    intent: chosen.intent,
  })
})

start()
```

`createBrowserDesktopAgent` already connects `desktopAgent` → `wcpConnector.requestIntentResolution`. For manual `DesktopAgent`, pass the same via `requestIntentResolution` in constructor options.

Apps see `intentResolverUrl: false` and `channelSelectorUrl: false` in handshake — meaning **the host shell**, not embedded FDC3 iframes, supplies those surfaces.

### Iframe-injected UI

```typescript
createBrowserDesktopAgent({
  wcpOptions: {
    getIntentResolverUrl: id => `https://platform.example/resolver?instance=${id}`,
    getChannelSelectorUrl: id => `https://platform.example/channels?instance=${id}`,
  },
})
```

Use when resolver/selector are standalone FDC3-aware pages loaded in iframes per spec. Implement those pages against WCP intent-resolver behavior.

**Channel changes:** Per-instance user channel for connected apps is an FDC3 platform concern. With package-only integration, document that host UI must drive `changeAppChannel` / channel APIs via your platform layer once instances exist — not via `sendDACPMessageOnBehalfOf` hacks.

---

## App directory

FDC3 **schema and REST semantics** → `fdc3-expert`. Sail **hooks**:

### At factory time

```typescript
createBrowserDesktopAgent({
  appDirectories: [
    "https://example.com/appd", // normalized to .../v2/apps
  ],
})
```

### After `DesktopAgent` exists

```typescript
const dir = desktopAgent.getAppDirectory()

await dir.loadDirectory("https://example.com/appd")
dir.addApplications([{ appId: "my-app", title: "My App", type: "web", details: { url: "https://app.example" } }])

const apps = dir.retrieveAllApps()
const intents = dir.retrieveIntents("fdc3.instrument", "ViewChart")
```

Constructor alternatives on `new DesktopAgent({ apps, appDirectoryManager })` for pre-seeded or custom manager instances.

---

## Configuration essentials

- **Product defaults** — `new DesktopAgent(options)` deep-merges `implementationMetadata` from `sail-default-config` (provider `FDC3-Sail`, version from package). Override via `implementationMetadata` partial, not handler-level fallbacks.
- **`resolveDesktopAgentConfig(options)`** — exported for tests or building config objects without instantiating; normal apps use constructor or factories.
- **`appLauncher`** — inject to implement `open` / launch semantics for your environment.
- **`userChannels`** — optional override; defaults come from `DEFAULT_FDC3_USER_CHANNELS` inside the agent.
- **Logging** — `logger` + `logPayloadDetail` (`'metadata' | 'full'`) on factory or `DesktopAgentOptions`.

```typescript
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent/browser"

createBrowserDesktopAgent({
  implementationMetadata: { provider: "My Desk", providerVersion: "1.0.0" },
  logger: myLogger,
})
```

---

## Lifecycle checklist

```
[ ] npm install @finos/sail-desktop-agent
[ ] Choose Fork 1 (A / B / C) with integrator
[ ] Choose Fork 2 (platform UI vs iframe URLs)
[ ] Wire transport pair (A or C) or remote transport (B)
[ ] Load app directory (URLs and/or addApplications)
[ ] start() DA + WCP
[ ] Platform UI listens for intentResolverNeeded if using false URLs
[ ] Host iframes with correct origins for WCP4 identity validation
```

---

## Anti-patterns

| Do not | Do instead |
|--------|------------|
| Import from `packages/sail-desktop-agent/src/...` in consumer apps | Published subpath imports |
| Use unpaired default transport in browser production | `createBrowserDesktopAgent` or `createInMemoryTransportPair` |
| Add `*ForTesting` methods to `DesktopAgent` in consumer code | Production APIs only |
| Duplicate full App Directory tutorial here | `fdc3-expert` + `getAppDirectory()` hooks above |
| Document `SailPlatform` as part of this skill | Mention it exists in platform-api; stay package-only |

---

## Quick reference: `createBrowserDesktopAgent` result

| Member | Role |
|--------|------|
| `desktopAgent` | FDC3 DACP handler (`getInfo`, `getAppDirectory`, instance APIs via transport) |
| `wcpConnector` | WCP1–6, MessagePorts, UI URL generation, `requestIntentResolution` / `resolveIntentSelection` |
| `start()` | Starts both |
| `stop()` | Stops both |

See `packages/sail-desktop-agent/README.md` in this repo for architecture diagram and extended examples when developing the package itself.
