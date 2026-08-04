---
sidebar_position: 1
---

# @finos/sail-platform

`@finos/sail-platform` is the **composition layer** for building an FDC3 host. It packages a
standards-compliant FDC3 Desktop Agent (`SailDesktopAgent`, from `@finos/sail-desktop-agent`) together
with the things a host application needs around that agent but which the FDC3 standard does not
specify:

- **host UI seams** — where the host plugs in app launching, intent resolution, and channel selection;
- **host chrome** — grouped, push-based controllers a host's own UI can bind to, instead of polling
  agent state;
- **platform storage** — pluggable persistence for workspaces, layouts, and host config;
- **a lifecycle** — construct, start, stop, with events forwarded to the host.

**Location:** `packages/sail-platform/`

## Scope boundary

The package does not own FDC3 semantics — intents, contexts, channels, and the DACP/WCP wire
protocols all live in `@finos/sail-desktop-agent`. `sail-platform` composes that engine; it does not
reimplement or extend the standard. It also holds **no UI**: every visual surface is an interface the
host implements.

`SailPlatform` itself is **stateless** — it forwards lifecycle events to the host callbacks you supply
and does not maintain its own model of connected apps or channel membership
(`sail-platform.ts:384`). Hosts own their own state.

For where this package sits relative to `@finos/sail-desktop-agent` and the two shells, see
[Architecture Overview — package ownership](../../architecture/overview#2-clear-package-ownership).

## Two entry points

The package exposes two constructors, and both end at the same `SailDesktopAgent` — there is one FDC3
engine, not two:

- **`createSailBrowserDesktopAgent(config)`** — returns a `SailDesktopAgent` directly, with Sail's WCP
  defaults (host-owned UI, no injected iframes) and an optional origin allowlist. No storage, no
  lifecycle callbacks — the host owns everything above the agent.
- **`new SailPlatform(config)` + `.start()`** — returns a platform object that owns an agent, plus host
  chrome, platform storage, and lifecycle callbacks.

Neither is more mature or more "correct" — pick by what you want the package to own. For the full
side-by-side comparison and the diagram showing both paths against `@finos/sail-desktop-agent`, see
[Architecture Overview — Two entry points](../../architecture/overview#two-entry-points).

### `createSailBrowserDesktopAgent(config)`

```typescript
import { createSailBrowserDesktopAgent } from "@finos/sail-platform"

const desktopAgent = createSailBrowserDesktopAgent({
  appLauncher: myLauncher,
  appDirectories: ["/apps.json"],
  allowedOrigins: ["https://my-host.example"], // optional Sail deployment policy
  debug: true,
})

desktopAgent.start()
// Construction only builds the object — start() attaches the window listener that
// lets iframe apps complete fdc3.getAgent().
```

Its config is `SailDesktopAgentOptions` (everything `SailDesktopAgent` accepts) plus two Sail-specific
additions: `allowedOrigins` — when set, WCP4 identity validation rejects connections from any other
`MessageEvent.origin` (`sail-browser-desktop-agent.ts:19-26`) — and `debug`. It returns the
`SailDesktopAgent` augmented with a `use()` method for the middleware pipeline; see
[Extensibility](#extensibility-the-observability-seam-planned) for why that pipeline is not a working
extension point today.

`allowedOrigins` is undefined by default, which means **no allowlist is applied** — this is a
fail-open control, not a fail-closed one, and it exists only on this entry point (`SailPlatform` has no
equivalent option). See [Architecture Overview — WCP4 origin allowlist](../../architecture/security) for
the full picture, including that neither shell in this repo sets it today.

### `new SailPlatform(config)` + `.start()`

```typescript
import { SailPlatform } from "@finos/sail-platform"

const platform = new SailPlatform({
  appLauncher: myAppLauncher,
  intentResolver: myIntentResolver, // optional
  onAppConnected: metadata => console.log(metadata.appId),
  onChannelChanged: (instanceId, channelId) => updateChrome(instanceId, channelId),
})

platform.start() // synchronous — returns void, not a Promise

await platform.changeAppChannel(instanceId, "fdc3.channel.1")
const channelId = platform.getAppUserChannel(instanceId)

await platform.workspaces.list()
await platform.layouts.save(workspaceId, layout)
await platform.sailConfig.update({ theme: "dark" }) // the property is `sailConfig`, not `config`

platform.stop() // synchronous — returns void
```

> The `SailPlatform` class's own source JSDoc (`sail-platform.ts:178-189`) shows `await platform.start()`
> / `await platform.stop()` and `platform.config.get()`. Both are wrong: `start()`/`stop()` return `void`,
> and the property is `sailConfig`. That is a source-comment defect, not a design decision — do not copy
> it from there.

`SailPlatform.start()` (`sail-platform.ts:222`) constructs `new SailDesktopAgent({...})` internally
(`:227`) and wires the config's lifecycle callbacks to the agent's grouped controllers (`:384`). Calling
`start()` twice throws; every accessor (`agent`, `channels`, `intentResolver`, `apps`, `connector`,
`changeAppChannel`, `getAppUserChannel`) throws `"SailPlatform not started. Call start() first."` before
`start()` runs (`:373-376`).

## The lifecycle contract: read storage before you construct

`apps` and `userChannels` are **constructor data**, and `start()` is **synchronous** — but platform
storage (`workspaces`/`layouts`/`sailConfig`) is **asynchronous**. A host that seeds the agent from
persisted state must therefore `await` its reads *before* constructing `SailPlatform`, not after
calling `start()`. Starting first and reconciling later means the agent runs briefly on defaults and
needs a restart to correct itself. This is a property of the package's contract, not of any one host —
see [Architecture Overview — Lifecycle and its one real constraint](../../architecture/overview#lifecycle-and-its-one-real-constraint)
for the sequence diagram.

## API surface

**Host UI seams — the host implements these:**

| Seam | Required? | Purpose |
|---|---|---|
| `appLauncher: AppLauncher` | **yes** | Open and close apps in the host's own windows/panels. `SailAppLauncher` (below) is the supplied helper — this, not the raw `AppLauncher` interface, is the intended host entry. |
| `intentResolver?: IntentResolver` | no | Render intent-resolution UI. Omitted ⇒ first handler auto-selected. |
| `channelSelector?: ChannelSelector` | no | Render channel-selection UI. Omitted ⇒ apps handle it themselves. |

Because Sail hosts control their own UI, `SailPlatform.start()` disables the agent's injected-iframe
resolver and channel-selector surfaces (`getIntentResolverUrl: () => false`,
`getChannelSelectorUrl: () => false`, `sail-platform.ts:239-241`). The host's own implementations are
the only UI.

**`SailAppLauncher`** (`services/app-launcher/sail-app-launcher.ts`) is the supplied `AppLauncher`
implementation: give it `onLaunchApp(appMetadata, instanceId, context?)` and, optionally,
`onCloseApp(instanceId)`, and it generates the instance id and delegates launch/close to your
callbacks. `onCloseApp` is required only if you need `fdc3.close()` support — omitting it makes
`SailAppLauncher.close()` reject. This is the real host seam — **both** shells in this repo construct a
`SailAppLauncher` rather than hand-implementing the raw `AppLauncher` interface
(`sail-finance/src/main.tsx`, `sail-one/src/state/sail-host.ts:172`):

```typescript
import { SailAppLauncher } from "@finos/sail-platform"

const appLauncher = new SailAppLauncher({
  async onLaunchApp(appMetadata, instanceId, context) {
    // Mount an iframe/panel/tab for this instance — the launcher generated instanceId for you.
    mountAppPanel({ instanceId, appId: appMetadata.appId, context })
  },
  async onCloseApp(instanceId) {
    // Required only to support fdc3.close() — tear down the container you mounted above.
    unmountAppPanel(instanceId)
  },
})
```

Pass this `appLauncher` to either entry point — `createSailBrowserDesktopAgent({ appLauncher, ... })` or
`new SailPlatform({ appLauncher, ... })` — instead of implementing the lower-level `AppLauncher`
contract by hand. The [Desktop Agent integrator guide](../desktop-agent/integrator-guide#host-contract-example)
teaches the raw `AppLauncher` contract this wraps.

**Host chrome — push-based controllers for host UI:** `platform.apps`, `platform.channels`,
`platform.intentResolver` expose the underlying agent's grouped controllers directly.
`platform.changeAppChannel(instanceId, channelId)` resolves once the change is confirmed on the wire;
`platform.getAppUserChannel(instanceId)` is the authoritative one-off read (no DACP round-trip);
`platform.getUserChannels()` lists the configured user channels. `platform.connector` exposes the raw
`BrowserAppConnection` for advanced integration work. **Hosts should not poll `agent.getState()`** —
the grouped controllers are the supported path.

**Lifecycle callbacks** — `onAppConnected`, `onAppDisconnected`, `onChannelChanged`,
`onHandshakeFailed` — each wired to the agent's controllers only if supplied
(`sail-platform.ts:389-407`).

**Platform storage** — `platform.workspaces` (`list()`, `get(workspaceId)`,
`create(name, initialLayout?)`, `delete(workspaceId)`), `platform.layouts` (`get(workspaceId)`,
`save(workspaceId, layout)`), `platform.sailConfig` (`get()`, `update(config)`) — all `async`, all
delegating through `SailPlatformClient` to a pluggable `PlatformApi` backend. See
[Platform storage](#platform-storage) below for what backs it today and its real caveats.

**Agent configuration passthrough** — `apps`, `userChannels`, `implementationMetadata`,
`openContextListenerTimeoutMs`, `heartbeatEnabled` / `heartbeatIntervalMs` / `heartbeatTimeoutMs`,
`debug` all pass through to the internal `SailDesktopAgent` construction.

## Choosing an entry point

Pick by **what you want the package to own**, not by maturity:

- **`createSailBrowserDesktopAgent`** — you want a standards-compliant FDC3 Desktop Agent and nothing
  else. You already have state management, persistence, and UI, and you'll bind the agent's controllers
  yourself.
- **`SailPlatform`** — you want the agent *plus* the host scaffolding: pluggable persistence for
  workspaces and layouts, lifecycle callbacks instead of manual controller wiring, the intent-resolver
  and channel-selector seams, and a place for the `[planned]` services tier (below) to arrive without a
  re-architecture.

Both require an `appLauncher`. The FDC3 surface your apps see is identical either way — you can start
at the low entry and move to `SailPlatform` later.

## Platform storage

`platform.workspaces`, `platform.layouts`, and `platform.sailConfig` are implemented today, delegating
through `SailPlatformClient` to a working `LocalStorageBackend`
(`sail-platform/src/client/local-storage-backend.ts:72-130`). This holds regardless of whether a shell
in this repo drives it — an API's status is read off the code, not off how many hosts here happen to
call it.

`SailPlatformClient` is configured via the `storage` option on `SailPlatformConfig`:

```typescript
new SailPlatform({
  appLauncher,
  storage: {
    storage: "localStorage", // default
    localStorage: { keyPrefix: "my_app_", debug: true },
  },
})
```

Two honest caveats:

- **Payloads are typed `unknown`** (`sail-platform.ts:139-160`) — the schemas for workspace, layout,
  and config shapes are not yet part of the contract. Callers own their own runtime validation.
- **`storage: "remote"` throws** — the option exists on `SailPlatformClientConfig` but constructing a
  client with it throws `"Remote storage backend not yet implemented"`
  (`sail-platform-client.ts:78`). Only `"localStorage"` works today.

The backend is pluggable behind the `PlatformApi` interface, which is what makes a server-backed store
a later swap rather than a rewrite.

## Extensibility: the observability seam `[planned]`

There is no working "middleware" mechanism in this package today. `createSailBrowserDesktopAgent`
constructs a `MiddlewarePipeline` and returns a `use()` method for registering middleware
(`sail-browser-desktop-agent.ts:80-88`), but the pipeline is never wired into the message path — the
source comment at `:88` says as much ("This will require wrapping the agent's transport with
middleware"). Registering middleware today has no effect on DACP traffic; do not build against it.

The intended customisation and telemetry mechanism is instead the **agent observability seam**: a
typed `AgentEvent` stream surfaced on the `SailDesktopAgent` controller surface — alongside logging,
channels, and intents — emitted **after** each FDC3 operation and unable to block or alter it. It has
two separable halves: event tracking, mapped to OpenTelemetry inside `@finos/sail-platform` (the agent
itself takes no OTEL dependency); and logging, where the existing `Logger` stays plain diagnostics that
a host may map to OTEL Logs itself.

The seam is fully designed but **not yet built** — no `observe()` API exists to call today. See
[Architecture Overview — the observability seam](../../architecture/overview#extensibility-the-observability-seam-planned)
for the full description; the collected-but-unwired `MiddlewarePipeline` above is **superseded** by it,
not a working alternative.

**Message validation** (implemented, no relation to the pipeline above): inbound DACP/WCP messages are
checked against the FDC3 schema from `@finos/fdc3-schema` — the same mechanism
`@finos/sail-desktop-agent` uses.

## Implemented vs planned

**`[implemented]`** — both entry points; the shared `SailDesktopAgent`; the three host UI seams; host
chrome (`apps` / `channels` / `intentResolver` / `connector` / `changeAppChannel` /
`getAppUserChannel` / `getUserChannels`); the four lifecycle callbacks; platform storage over a
pluggable `PlatformApi` with a working `localStorage` backend; agent config passthrough; start/stop
lifecycle.

**`[planned]`**

- **Remote storage backend** — the config option exists and throws.
- **Typed storage payloads** — `unknown` today.
- **Observability / OpenTelemetry** — designed at `.cursor/plans/agent-observability-seam.md`, not built.
- **Auth, entitlements, connectors** — do not exist in any form.
- **Middleware pipeline** — collected but unwired; superseded by the observability seam.

## Reference implementations

Two shells in this repo consume this package. They are worked examples, not the reason the package's
API exists — an API here is not downgraded because no shell drives it, and a shell using the package a
particular way is not the package's contract.

- **`sail-finance`** (finance-specific example UI) — low entry. Calls `createSailBrowserDesktopAgent` +
  `SailAppLauncher`, with its own Zustand state
  (`packages/sail-finance/src/main.tsx`). See [@finos/sail-finance](../sail-finance/overview).
- **`sail-one`** (domain-neutral example UI) — high entry. Calls `new SailPlatform(...).start()` with
  the lifecycle callbacks, async-hydrating its persisted state before construction per
  [the lifecycle contract](#the-lifecycle-contract-read-storage-before-you-construct)
  (`packages/sail-one/src/state/sail-host.ts`). See [@finos/sail-one](../sail-one/overview).

Neither shell currently drives `workspaces`, `layouts`, or `sailConfig` directly — `sail-finance`
persists its own way (Zustand + raw `localStorage`) and `sail-one` uses `SailPlatformClient`'s
`get`/`updateConfig` for its own shell state, not the `workspaces`/`layouts` namespaces. That is a fact
about the shells, not a limitation of the package.

## Related

- [Architecture Overview](../../architecture/overview) — package ownership, both entry points, the
  host-contract surface, and enforced boundaries.
- [Desktop Agent integrator guide](../desktop-agent/integrator-guide) — the underlying FDC3 engine this
  package composes.
- [Channel selection](../../architecture/channel-selection) — host chrome vs app-hosted selector URLs.
- [@finos/sail-finance](../sail-finance/overview) · [@finos/sail-one](../sail-one/overview) — the two
  example UIs built on this package.
