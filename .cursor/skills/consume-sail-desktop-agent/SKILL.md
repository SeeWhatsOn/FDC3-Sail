---
name: consume-sail-desktop-agent
description: Integrates @finos/sail-desktop-agent as an npm consumer when building an FDC3 desktop platform host. Covers @finos/sail-desktop-agent/presets, manual composition vs presets, host contracts (AppLauncher, IntentResolver, ChannelControl), and advanced /browser subpath imports. Use when constructing a Desktop Agent from scratch, wiring transports, or helping someone embed Sail desktop-agent outside this monorepo.
disable-model-invocation: true
---

# Consume @finos/sail-desktop-agent

Guides agents helping integrators build an **FDC3 platform** (desktop host) using the published npm package — not contributors hacking `packages/sail-desktop-agent/src`.

For FDC3 2.2 spec semantics (App Directory schema, DACP, WCP spec text), load **`fdc3-expert`** and fetch upstream docs. This skill covers **Sail package wiring only**.

**Canonical docs:** [integrator guide](https://finos.github.io/FDC3-Sail/docs/packages/desktop-agent/integrator-guide) on the FDC3 Sail docs site.

## Package surface

### Primary (start here)

Application code should import the browser preset from **`@finos/sail-desktop-agent/presets`** (also re-exported from the top-level package):

| Export | Use |
|--------|-----|
| `createBrowserDesktopAgent` | **Preset** — returns `DesktopAgent`; browser edge coupled to `start()` / `stop()` |
| `DesktopAgent` | **Manual composition** — core FDC3 engine |
| `AppLauncher` | Host contract — implement `open` / launch for your environment |
| `IntentResolver` | Host contract — platform-owned intent picker UI |
| `ChannelControl` | Host contract shape — picker contract; not wired as a preset option yet |
| `DEFAULT_FDC3_USER_CHANNELS` | FDC3 default user channel definitions (override via `userChannels`) |
| `retrieveAllApps`, `retrieveIntents`, `fetchAppDirectory`, `resolveDesktopAgentConfig`, core types | App directory queries, fetch helpers, config, DACP types |

### Advanced subpaths

| Import | Use |
|--------|-----|
| `@finos/sail-desktop-agent/browser` | `getBrowserDesktopAgentSession`, `WCPConnector`, `createWCPClient` — edge internals and remote client |
| `@finos/sail-desktop-agent/transports` | `createInMemoryTransportPair`, `InMemoryTransport` — custom transport topology |
| `@finos/sail-desktop-agent` (top-level) | Same preset + host contracts as `/presets`; convenience entry |

**Do not** teach integrators to import `createBrowserDesktopAgent` from `/browser` as the default path.

**Out of scope:** `@finos/sail-platform-api`, `@finos/sail-web`, monorepo-relative imports (`../../packages/...`), Cucumber `test/support/*`, `*ForTesting` helpers.

## Two consumption modes

| Mode | When to use | What you assemble |
|------|-------------|-------------------|
| **Preset** | Browser host in one JS realm; default WCP + in-memory transport wiring is fine | `createBrowserDesktopAgent({ appLauncher, intentResolver, apps, userChannels, … })` |
| **Manual composition** | Custom transports, remote DA split, tests, or full control over every connector | `DesktopAgent` + `WCPConnector` + paired `Transport` + host contracts |

Choose **presets** for faster integration. Choose **manual composition** when you own transport topology or deploy the DA away from the browser WCP terminator.

## Workflow (required)

1. **Interview the integrator** — do not pick an architecture silently. Ask the forks below; explain trade-offs; then implement their choice.
2. **Use published `/presets` imports for application code** — assume `npm install @finos/sail-desktop-agent` and built `dist/` exports.
3. **Lifecycle** — preset `autoStart` defaults to `true`; otherwise call `desktopAgent.start()` once (edge starts with the agent). Teardown: `desktopAgent.stop()`.
4. **Seed the app directory** — `open` / `findIntent` need directory data; use `apps` and/or `appDirectories` (see [App directory](#app-directory)).
5. **Delegate spec depth** — point to `fdc3-expert` for App Directory JSON shape, intent names, and conformance wording.

---

## Fork 1: Preset vs manual vs remote

Ask:

> Are you running the Desktop Agent **in the same browser window** as your platform UI, **remote** (server/worker owns the DA), or do you need **full manual control** over transport and WCP?

| Choice | When to use | Entry |
|--------|-------------|--------|
| **A. Preset (local browser DA)** | Platform shell and DA share one JS realm; iframe apps use `getAgent()` + WCP | `createBrowserDesktopAgent()` from `/presets` |
| **B. Remote DA** | DA runs on server or in a Web Worker; browser only terminates WCP to iframes | `createWCPClient({ transport })` from `/browser` — **you** supply a `Transport` to the remote DA |
| **C. Manual composition** | Custom transport topology, tests, or non-browser host with your own connector | `new DesktopAgent({ transport, appLauncher, … })` + `new WCPConnector(…)` + paired transports from `/browser` and `/transports` |

### A. Preset — local browser DA (primary walkthrough)

```typescript
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent/presets"
import {
  type AppLauncher,
  type IntentResolver,
  DEFAULT_FDC3_USER_CHANNELS,
} from "@finos/sail-desktop-agent"

const appLauncher: AppLauncher = {
  launch: async (request, app) => {
    const instanceId = request.app?.instanceId ?? crypto.randomUUID()
    // Open iframe/tab; iframe name MUST match instanceId for WCP4 identity
    return { appId: app.appId, instanceId }
  },
}

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

const desktopAgent = createBrowserDesktopAgent({
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
  userChannels: DEFAULT_FDC3_USER_CHANNELS,
  // wcpOptions omitted → intentResolverUrl/channelSelectorUrl false (host-owned UI)
  onAppConnected: meta => tabs.markConnected(meta.instanceId, meta.appId),
  onAppDisconnected: instanceId => tabs.remove(instanceId),
})

// Auto-started by default — iframe apps: fdc3.getAgent() → WCP → DACP
```

Preset factory behavior (know this when debugging):

- Returns a single **`DesktopAgent`**; the browser edge is hidden and runs with `desktopAgent.start()` / `stop()`.
- Creates an **in-memory transport pair** (DA ↔ WCP connector).
- When `intentResolver` is provided, connects WCP `intentResolverNeeded` to **`IntentResolver.resolve`** — no manual `wcpConnector.on("intentResolverNeeded", …)` for platform-owned UI.
- `apps` **seeds** the App Directory in-memory; optionally load remote directories via `appDirectories`.
- Advanced edge access: `getBrowserDesktopAgentSession(desktopAgent)` from `/browser`.

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
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent/presets"
import type { IntentResolver } from "@finos/sail-desktop-agent"

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

createBrowserDesktopAgent({ appLauncher, intentResolver })
// Omit wcpOptions — host-owned intent/channel UI (FDC3 default)
```

Apps see `intentResolverUrl: false` and `channelSelectorUrl: false` in handshake — meaning **the host shell**, not embedded FDC3 iframes, supplies those surfaces.

Implement **`ChannelControl`** in your platform layer for per-instance channel chrome when `getChannelSelectorUrl` returns `false`. Drive channel changes via your host UI and typed connector APIs (e.g. `changeAppChannel` through platform transport helpers) — not `sendDACPMessageOnBehalfOf` hacks.

### Iframe-injected UI

```typescript
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent/presets"

createBrowserDesktopAgent({
  appLauncher,
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
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent/presets"

createBrowserDesktopAgent({
  appLauncher,
  apps: [
    { appId: "chart", title: "Chart", type: "web", details: { url: "https://…" } },
  ],
})
```

The `apps` option seeds the in-memory directory **without** fetching `appDirectories` URLs.

### Load remote directories (optional, additive)

```typescript
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent/presets"

createBrowserDesktopAgent({
  appLauncher,
  apps: localSeedApps,
  appDirectories: ["https://example.com/appd"],
})
```

### After `DesktopAgent` exists (manual or post-factory)

```typescript
import { retrieveAllApps, retrieveIntents } from "@finos/sail-desktop-agent"

const catalog = desktopAgent.getState().appDirectory
const apps = retrieveAllApps(catalog)
const intents = retrieveIntents(catalog, "fdc3.instrument", "ViewChart")
```

Seed at construction with `apps: [...]` or load remote URLs via preset `appDirectories: ["https://example.com/appd"]` (preset calls `loadDirectoryIntoState` internally). There is no `getAppDirectory()` facade — catalog data lives on `AgentState.appDirectory`.

---

## Configuration essentials

- **Product defaults** — `new DesktopAgent(options)` deep-merges `implementationMetadata` from `sail-default-config` (provider `FDC3-Sail`, version from package). Override via `implementationMetadata` partial, not handler-level fallbacks.
- **`resolveDesktopAgentConfig(options)`** — exported for tests or building config objects without instantiating; normal apps use constructor or presets.
- **`appLauncher`** — required for `open`; inject via preset or `DesktopAgent` constructor.
- **`intentResolver`** — preset option wires the `IntentResolver` host contract to WCP; replaces manual `intentResolverNeeded` listeners for platform-owned UI.
- **`userChannels`** — optional override; defaults come from `DEFAULT_FDC3_USER_CHANNELS`.
- **Logging** — `logger` + `logPayloadDetail` (`'metadata' | 'full'`) on preset or `DesktopAgentOptions`.

```typescript
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent/presets"

createBrowserDesktopAgent({
  appLauncher,
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
[ ] Preset autoStart (default true) or desktopAgent.start()
[ ] Host iframes: name = instanceId; correct origins for WCP4
```

---

## Anti-patterns

| Do not | Do instead |
|--------|------------|
| Import `createBrowserDesktopAgent` from `/browser` as the default teaching path | `@finos/sail-desktop-agent/presets` |
| Destructure `{ desktopAgent, wcpConnector, start }` from the preset factory | `const desktopAgent = createBrowserDesktopAgent({...})` |
| Call `wcpConnector.start()` separately after preset `createBrowserDesktopAgent` | Rely on coupled lifecycle (`autoStart` default true) |
| Import from `packages/sail-desktop-agent/src/...` in consumer apps | Published package imports |
| Use unpaired default transport in browser production | `createBrowserDesktopAgent` or `createInMemoryTransportPair` |
| Wire `intentResolverNeeded` manually when using the `IntentResolver` contract on presets | Pass `intentResolver` to `createBrowserDesktopAgent` |
| Add `*ForTesting` methods to `DesktopAgent` in consumer code | Production APIs only |
| Duplicate full App Directory tutorial here | `fdc3-expert` + `getState().appDirectory` + query exports above |
| Document `SailPlatform` as part of this skill | Mention it exists in platform-api; stay package-only |

---

## Quick reference: preset facade

| API | Role |
|-----|------|
| `createBrowserDesktopAgent(...)` | Returns **`DesktopAgent`** — FDC3 host APIs (`getInfo`, `getState`, `disconnectInstance`, `getAppUserChannelId`, …) |
| `desktopAgent.start()` / `stop()` | Starts/stops DA **and** coupled browser edge (unless `autoStart: false`) |
| `getBrowserDesktopAgentSession(da)` | From `/browser` — `{ wcpConnector, connectorTransport }` for edge events and host channel DACP |
| `onAppConnected` / `onAppDisconnected` | Preset options — lifecycle without direct `wcpConnector.on(...)` |

Full integrator reference: [finos.github.io/FDC3-Sail/docs/packages/desktop-agent/integrator-guide](https://finos.github.io/FDC3-Sail/docs/packages/desktop-agent/integrator-guide).
