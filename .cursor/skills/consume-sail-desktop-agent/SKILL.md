---
name: consume-sail-desktop-agent
description: Integrates @finos/sail-desktop-agent as an npm consumer when building an FDC3 desktop platform host. Covers top-level package exports, manual composition vs presets, host contracts (AppLauncher, IntentResolver, ChannelControl), and advanced subpath imports. Use when constructing a Desktop Agent from scratch, wiring transports, or helping someone embed Sail desktop-agent outside this monorepo.
disable-model-invocation: true
---

# Consume @finos/sail-desktop-agent

Guides agents helping integrators build an **FDC3 platform** (desktop host) using the published npm package — not contributors hacking `packages/sail-desktop-agent/src`.

For FDC3 2.2 spec semantics (App Directory schema, DACP, WCP spec text), load **`fdc3-expert`** and fetch upstream docs. This skill covers **Sail package wiring only**.

## Package surface

### Primary (start here)

Import from **`@finos/sail-desktop-agent`** — the top-level entry is the default integration surface after PKG-01–PKG-06:

| Export | Use |
|--------|-----|
| `createBrowserDesktopAgent` | **Preset** — browser DA + WCP connector + in-memory transport pair |
| `DesktopAgent` | **Manual composition** — core FDC3 engine |
| `AppLauncher` | Host contract — implement `open` / launch for your environment |
| `IntentResolver` | Host contract — platform-owned intent picker UI |
| `ChannelControl` | Host contract — platform-owned channel selector UI |
| `DEFAULT_FDC3_USER_CHANNELS` | FDC3 default user channel definitions (override via `userChannels`) |
| `AppDirectoryManager`, `resolveDesktopAgentConfig`, core types | Directory management, config helpers, DACP types |

### Advanced subpaths (not the primary surface)

Use these only when presets are insufficient or you need lower-level types:

| Import | Use |
|--------|-----|
| `@finos/sail-desktop-agent/browser` | `WCPConnector`, `createWCPClient`, `MessagePortTransport` — manual WCP wiring |
| `@finos/sail-desktop-agent/transports` | `createInMemoryTransportPair`, `InMemoryTransport` — custom transport topology |
| `@finos/sail-desktop-agent/presets` | Same preset factories as top-level (alternate entry for tree-shaking experiments) |

**Do not** teach integrators to import `createBrowserDesktopAgent` from `/browser` as the default path — use the **top-level** package entry.

**Out of scope:** `@finos/sail-platform-api`, `@finos/sail-web`, monorepo-relative imports (`../../packages/...`), Cucumber `test/support/*`, `*ForTesting` helpers.

## Two consumption modes

| Mode | When to use | What you assemble |
|------|-------------|-------------------|
| **Preset** | Browser host in one JS realm; default WCP + in-memory transport wiring is fine | `createBrowserDesktopAgent({ appLauncher, intentResolver, apps, userChannels, … })` |
| **Manual composition** | Custom transports, remote DA split, tests, or full control over every connector | `DesktopAgent` + `WCPConnector` + paired `Transport` + host contracts |

Choose **presets** for faster integration. Choose **manual composition** when you own transport topology or deploy the DA away from the browser WCP terminator.

## Workflow (required)

1. **Interview the integrator** — do not pick an architecture silently. Ask the forks below; explain trade-offs; then implement their choice.
2. **Use published top-level imports first** — assume `npm install @finos/sail-desktop-agent` and built `dist/` exports.
3. **Call `start()`** — both `desktopAgent.start()` and `wcpConnector.start()` (or factory `start()`) before apps connect.
4. **Seed the app directory** — `open` / `findIntent` need directory data; use `apps` and/or `appDirectories` (see [App directory](#app-directory)).
5. **Delegate spec depth** — point to `fdc3-expert` for App Directory JSON shape, intent names, and conformance wording.

---

## Fork 1: Preset vs manual vs remote

Ask:

> Are you running the Desktop Agent **in the same browser window** as your platform UI, **remote** (server/worker owns the DA), or do you need **full manual control** over transport and WCP?

| Choice | When to use | Entry |
|--------|-------------|--------|
| **A. Preset (local browser DA)** | Platform shell and DA share one JS realm; iframe apps use `getAgent()` + WCP | `createBrowserDesktopAgent()` from top level |
| **B. Remote DA** | DA runs on server or in a Web Worker; browser only terminates WCP to iframes | `createWCPClient({ transport })` from `/browser` — **you** supply a `Transport` to the remote DA |
| **C. Manual composition** | Custom transport topology, tests, or non-browser host with your own connector | `new DesktopAgent({ transport, appLauncher, … })` + `new WCPConnector(…)` + paired transports from `/browser` and `/transports` |

### A. Preset — local browser DA (primary walkthrough)

```typescript
import {
  createBrowserDesktopAgent,
  type AppLauncher,
  type IntentResolver,
  DEFAULT_FDC3_USER_CHANNELS,
} from "@finos/sail-desktop-agent"

const appLauncher: AppLauncher = {
  launch: async (request, appMetadata) => {
    // Open iframe/tab; set iframe name to instanceId for WCP4 identity validation
    return { appId: request.app.appId, instanceId: "…" }
  },
}

const intentResolver: IntentResolver = {
  resolve: async request => {
    // Show platform UI with request.handlers; return selection or null to cancel
    return {
      selectedHandler: chosen,
      target: { appId: chosen.app.appId, instanceId: chosen.instanceId },
    }
  },
}

const { desktopAgent, wcpConnector, start, stop } = createBrowserDesktopAgent({
  appLauncher,
  intentResolver,
  apps: [
    {
      appId: "my-app",
      title: "My App",
      type: "web",
      details: { url: "https://app.example" },
    },
  ],
  userChannels: DEFAULT_FDC3_USER_CHANNELS, // optional — these are the defaults
  wcpOptions: {
    getIntentResolverUrl: () => false,
    getChannelSelectorUrl: () => false,
  },
})

start()
// iframe apps: fdc3.getAgent() → WCP handshake → DACP on desktopAgent
```

Preset factory behavior (know this when debugging):

- Creates an **in-memory transport pair** (DA ↔ WCP connector).
- Wires `requestIntentResolution` on `DesktopAgent` to `wcpConnector.requestIntentResolution`.
- When `intentResolver` is provided, connects WCP `intentResolverNeeded` to your **`IntentResolver.resolve`** — you do **not** need manual `wcpConnector.on("intentResolverNeeded", …)` wiring for platform-owned UI.
- `apps` **seeds** the App Directory in-memory; no HTTP fetch required.
- Optionally loads remote directories via `appDirectories` → `loadDirectory()`.

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
import { DesktopAgent, type AppLauncher, type IntentResolver } from "@finos/sail-desktop-agent"
import { WCPConnector } from "@finos/sail-desktop-agent/browser"
import { createInMemoryTransportPair } from "@finos/sail-desktop-agent/transports"

const [daTransport, wcpTransport] = createInMemoryTransportPair()

const wcpConnector = new WCPConnector(wcpTransport, {
  getIntentResolverUrl: () => false,
  getChannelSelectorUrl: () => false,
})

const desktopAgent = new DesktopAgent({
  transport: daTransport,
  appLauncher: myAppLauncher,
  apps: mySeedApps,
  userChannels: myUserChannels,
  requestIntentResolution: req => wcpConnector.requestIntentResolution(req),
})

desktopAgent.start()
wcpConnector.start()
```

For platform-owned intent UI in manual mode, either:

- Pass an `IntentResolver`-shaped adapter into `requestIntentResolution`, or
- Listen on `wcpConnector.on("intentResolverNeeded", …)` and call `wcpConnector.resolveIntentSelection(…)`.

Prefer the **`IntentResolver` host contract** (via preset `intentResolver` option or a thin adapter) over raw WCP events when building host UI.

**Never** rely on the default unpaired `InMemoryTransport` inside `new DesktopAgent()` for production browser bridges — use a **pair** or `createBrowserDesktopAgent()`.

---

## Fork 2: Intent resolver and channel selector UI

Ask:

> Will your platform **own** intent/channel UI in the host page, or will apps receive **iframe URLs** in `WCP3Handshake`?

| Model | `getIntentResolverUrl` / `getChannelSelectorUrl` | Platform work |
|-------|--------------------------------------------------|---------------|
| **Platform-owned UI** | Return `false` (recommended preset default) | Implement `IntentResolver` / `ChannelControl` host contracts; preset `intentResolver` replaces manual `intentResolverNeeded` wiring |
| **Iframe-injected UI** | Return absolute URLs per `instanceId` | Host those pages; they participate in WCP intent-resolver protocol |

### Platform-owned UI (preset — preferred)

```typescript
import { createBrowserDesktopAgent, type IntentResolver } from "@finos/sail-desktop-agent"

const intentResolver: IntentResolver = {
  resolve: async request => {
    const chosen = await showIntentPicker(request.handlers)
    if (!chosen) return null
    return {
      selectedHandler: chosen,
      target: { appId: chosen.app.appId, instanceId: chosen.instanceId },
    }
  },
}

const { start } = createBrowserDesktopAgent({
  intentResolver,
  wcpOptions: {
    getIntentResolverUrl: () => false,
    getChannelSelectorUrl: () => false,
  },
})

start()
```

Apps see `intentResolverUrl: false` and `channelSelectorUrl: false` in handshake — meaning **the host shell**, not embedded FDC3 iframes, supplies those surfaces.

Implement **`ChannelControl`** in your platform layer for per-instance channel chrome when `getChannelSelectorUrl` returns `false`. Drive channel changes via your host UI and typed connector APIs (e.g. `changeAppChannel` through platform transport helpers) — not `sendDACPMessageOnBehalfOf` hacks.

### Iframe-injected UI

```typescript
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent"

createBrowserDesktopAgent({
  wcpOptions: {
    getIntentResolverUrl: id => `https://platform.example/resolver?instance=${id}`,
    getChannelSelectorUrl: id => `https://platform.example/channels?instance=${id}`,
  },
})
```

Use when resolver/selector are standalone FDC3-aware pages loaded in iframes per spec.

---

## App directory

FDC3 **schema and REST semantics** → `fdc3-expert`. Sail **hooks**:

### Seed at preset time (no URLs)

```typescript
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent"

createBrowserDesktopAgent({
  apps: [
    { appId: "chart", title: "Chart", type: "web", details: { url: "https://…" } },
  ],
})
```

The `apps` option seeds the in-memory directory **without** fetching `appDirectories` URLs.

### Load remote directories (optional, additive)

```typescript
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent"

createBrowserDesktopAgent({
  apps: localSeedApps,
  appDirectories: ["https://example.com/appd"], // normalized to .../v2/apps
})
```

### After `DesktopAgent` exists (manual or post-factory)

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
- **`resolveDesktopAgentConfig(options)`** — exported for tests or building config objects without instantiating; normal apps use constructor or presets.
- **`appLauncher`** — required for `open`; inject via preset or `DesktopAgent` constructor.
- **`intentResolver`** — preset option wires the `IntentResolver` host contract to WCP; replaces manual `intentResolverNeeded` listeners for platform-owned UI.
- **`userChannels`** — optional override; defaults come from `DEFAULT_FDC3_USER_CHANNELS`.
- **Logging** — `logger` + `logPayloadDetail` (`'metadata' | 'full'`) on preset or `DesktopAgentOptions`.

```typescript
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent"

createBrowserDesktopAgent({
  implementationMetadata: { provider: "My Desk", providerVersion: "1.0.0" },
  logger: myLogger,
})
```

---

## Lifecycle checklist

```
[ ] npm install @finos/sail-desktop-agent
[ ] Choose Fork 1 (preset A / remote B / manual C) with integrator
[ ] Choose Fork 2 (platform UI vs iframe URLs)
[ ] Wire appLauncher (+ intentResolver for platform-owned intent UI)
[ ] Seed apps and/or load appDirectories
[ ] start() DA + WCP
[ ] Host iframes with correct origins for WCP4 identity validation
```

---

## Anti-patterns

| Do not | Do instead |
|--------|------------|
| Import `createBrowserDesktopAgent` from `/browser` as the default teaching path | Top-level `@finos/sail-desktop-agent` |
| Import from `packages/sail-desktop-agent/src/...` in consumer apps | Published package imports |
| Use unpaired default transport in browser production | `createBrowserDesktopAgent` or `createInMemoryTransportPair` |
| Wire `intentResolverNeeded` manually when using the `IntentResolver` contract on presets | Pass `intentResolver` to `createBrowserDesktopAgent` |
| Add `*ForTesting` methods to `DesktopAgent` in consumer code | Production APIs only |
| Duplicate full App Directory tutorial here | `fdc3-expert` + `getAppDirectory()` hooks above |
| Document `SailPlatform` as part of this skill | Mention it exists in platform-api; stay package-only |

---

## Quick reference: `createBrowserDesktopAgent` result

| Member | Role |
|--------|------|
| `desktopAgent` | FDC3 DACP handler (`getInfo`, `getAppDirectory`, instance APIs via transport) |
| `wcpConnector` | WCP1–6, MessagePorts, UI URL generation, `requestIntentResolution` / `resolveIntentSelection` |
| `connectorTransport` | Transport on WCP side — use for typed host channel control |
| `start()` | Starts both |
| `stop()` | Stops both |

See `packages/sail-desktop-agent/README.md` in this repo for architecture diagram and extended examples when developing the package itself.
