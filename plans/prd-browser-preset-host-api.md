# PRD: Browser preset host API

## Persona / user

- **Host-shell developers** building a browser-resident FDC3 Desktop Agent with `createBrowserDesktopAgent` and custom React, Svelte, Vue, or vanilla JavaScript UI.
- **Platform builders** who need package-only host controls for intent resolver UI, channel chrome, app catalog registration, iframe lifecycle, and instance cleanup without depending on `@finos/sail-platform-api`.
- **Manual composition adopters** who may later build from `DesktopAgent` + `WCPConnector` directly and should not need to reimplement a parallel host API.

## Goal / outcome

Expose a small, typed, destructurable host-facing API on the Browser Desktop Agent preset so hosts can manage intent resolution, app channels, runtime app catalog registration, and iframe app lifecycle without reaching into WCP connector internals, while keeping FDC3 app-facing behavior standard through `@finos/fdc3` `getAgent()`.

## Relationship to other plans

| Existing plan / artifact | Current status | This PRD action |
|---|---|---|
| `plans/project-docs.md` (composable package delivered) | Package architecture **done**; core/preset split delivered. | Extend with browser-host controller API; do not reopen PKG work. |
| `plans/prd-desktop-agent-state-hardening.md` | Existing state hardening PRD with app-directory-in-state and WCP routing work. | Reuse existing app-directory selectors/mutators and instance routing state; do not duplicate cleanup/routing tasks. |
| `website/docs/packages/desktop-agent/integrator-guide.md` | Current docs describe intent resolver and channel chrome, but channel set uses advanced session transport. | Update docs to match the new package-only host API and remove the need for integrators to call WCP internals for MVP flows. |
| `packages/sail-desktop-agent/src/host-contracts/channel-control.ts` | Exported contract shape, not wired into the browser preset. | Clarify or supersede via `desktopAgent.channels` host controller. |

## In scope

1. **BHA-01 Grouped browser host controllers**: expose destructurable `intentResolver`, `channels`, and `apps` controllers on `BrowserDesktopAgent`.
2. **BHA-02 Typed subscription methods**: use typed `on...` subscription functions returning unsubscribe callbacks, not a public stringly `.on()` event bus.
3. **BHA-03 Intent resolver host API**: make `intentResolver.onRequest`, `select`, `cancel`, and `getPendingRequests` the canonical browser preset resolver surface, while preserving `intentResolverUI` as a temporary alias unless delivery confirms removal is acceptable.
4. **BHA-04 Channel host API**: expose `getUserChannels`, `getAppChannel`, `getAppChannelId`, `changeAppChannel`, and `onAppChannelChange` without requiring public consumers to use `getBrowserDesktopAgentSession().connectorTransport`.
5. **BHA-05 Apps host API**: expose runtime app catalog registration (`add`, `addAll`, `addDirectory`, `remove`), catalog reads, host-initiated `open`, connection/instance reads, lifecycle subscriptions, and `disconnect`.
6. **BHA-06 Reusable composition helper**: implement controllers as browser-host composition helpers that the preset attaches automatically and manual composition can reuse later.
7. **BHA-07 Website docs**: update website docs with examples for React plus framework-neutral unsubscribe patterns for Svelte, Vue, and vanilla JavaScript.

## Out of scope

- Changing FDC3 app-facing API behavior, `@finos/fdc3` `getAgent()` behavior, WCP wire semantics, or DACP protocol semantics.
- Moving channel chrome, resolver UI, or React/Vue/Svelte-specific concepts into `core/`.
- Building injected WCP3 intent resolver or channel selector iframe pages.
- Making `@finos/sail-platform-api` the only way to perform host channel changes.
- Fully documenting every manual `DesktopAgent` + `WCPConnector` composition path in this workload if that expands beyond the reusable helper note.
- Adding documentation contract tests for markdown or Docusaurus pages.

## Success criteria

- A package-only browser host can create `createBrowserDesktopAgent({ appLauncher })`, then register apps dynamically with `desktopAgent.apps.add(...)` or `desktopAgent.apps.addDirectory(...)`.
- A host resolver UI can subscribe to `desktopAgent.intentResolver.onRequest(...)`, render choices, and call `select` or `cancel` without direct WCP connector access.
- A host channel selector can read current channel state, observe app-driven channel changes, and call `desktopAgent.channels.changeAppChannel(instanceId, channelId | null)` for UI-driven changes.
- A host iframe dashboard can observe `apps.onConnect`, `apps.onDisconnect`, and `apps.onHandshakeFailure`, read connections/instances, open apps, and disconnect instances through the grouped `apps` controller.
- The controllers are safe to destructure because methods are closures/arrow functions and do not rely on `this` binding.
- `core/` remains protocol-pure; browser-host APIs live in preset/browser-host composition modules and delegate to existing generic core selectors, mutators, and DACP paths.
- Website docs distinguish standard FDC3 app APIs from Sail browser preset host APIs.

## BDD scenarios

```text
Scenario: Host registers apps after agent creation
  Given a browser host has created a Browser Desktop Agent with an app launcher
  When the host adds an app directory after creation
  Then the app catalog exposed by the host API includes the directory apps

Scenario: Host resolves an ambiguous intent
  Given an FDC3 app raises an ambiguous intent
  When the host subscribes to intent resolver requests and selects a choice
  Then the Desktop Agent continues the normal intent delivery path using the selected target

Scenario: Host changes an app channel
  Given an iframe app is connected with a validated instance id
  When the host changes that instance to a user channel through the channels controller
  Then the app receives the standard user channel changed event and the host receives a typed app channel change event

Scenario: App-driven channel changes update host chrome
  Given an iframe app joins a user channel through its standard FDC3 API
  When the Desktop Agent updates channel membership
  Then the host channel controller notifies subscribers with the instance id and channel id

Scenario: Host tracks iframe lifecycle
  Given a host opens an app iframe through the Browser Desktop Agent host API
  When the app completes WCP identity validation
  Then the host receives an app connect event with the canonical instance id and app id

Scenario: Destructured controllers remain usable
  Given a host destructures apps, channels, and intentResolver from the Desktop Agent
  When it calls controller methods from a framework lifecycle callback
  Then the methods work without requiring the original Desktop Agent object as `this`
```

## Architecture / implementation direction

The target host-facing API is:

```typescript
const desktopAgent = createBrowserDesktopAgent({ appLauncher })
const { intentResolver, channels, apps } = desktopAgent
```

Intent resolver controller:

```typescript
interface BrowserIntentResolverController {
  onRequest(listener: (request: IntentResolutionRequest) => void): () => void
  getPendingRequests(): IntentResolutionRequest[]
  select(requestId: string, choice: IntentResolutionChoice | IntentHandler): void
  cancel(requestId: string): void
}
```

Channels controller:

```typescript
interface BrowserChannelsController {
  getUserChannels(): Channel[]
  getAppChannel(instanceId: string): Channel | null
  getAppChannelId(instanceId: string): string | null
  changeAppChannel(instanceId: string, channelId: string | null): Promise<void>
  onAppChannelChange(listener: (event: AppChannelChangeEvent) => void): () => void
}
```

Apps controller:

```typescript
interface BrowserAppsController {
  add(app: DirectoryApp): void
  addAll(apps: DirectoryApp[]): void
  addDirectory(url: string): Promise<void>
  remove(appId: string): void
  getAll(): DirectoryApp[]
  getById(appId: string): DirectoryApp | undefined
  open(app: string | AppIdentifier, options?: BrowserAppOpenOptions): Promise<AppIdentifier>
  getInstances(): BrowserAppInstance[]
  getInstance(instanceId: string): BrowserAppInstance | undefined
  getConnections(): AppConnectionMetadata[]
  getConnection(instanceId: string): AppConnectionMetadata | undefined
  disconnect(instanceId: string): void
  onConnect(listener: (metadata: AppConnectionMetadata) => void): () => void
  onDisconnect(listener: (instanceId: string) => void): () => void
  onHandshakeFailure(listener: (event: HandshakeFailureEvent) => void): () => void
}
```

`DirectoryApp` is the package's launchable app directory shape; plain FDC3 `AppMetadata` is not enough for runtime registration because hosts need launch details. `appLauncher` remains an option callback because only the host can create iframes/windows. Constructor `apps` and `appDirectories` remain optional bootstrap conveniences, but docs should present runtime registration as the primary host-shell setup:

```typescript
const desktopAgent = createBrowserDesktopAgent({ appLauncher })

await desktopAgent.apps.addDirectory("/apps.json")
desktopAgent.apps.add(myDynamicApp)
```

Implement controller construction as a reusable browser-host helper:

```typescript
const controllers = createBrowserHostControllers({
  desktopAgent,
  wcpConnector,
  connectorTransport,
})
```

`createBrowserDesktopAgent` should attach these controllers automatically. Manual composition documentation can mention the helper as an advanced path, but the MVP is preset-first.

## Risks / unknowns

- `apps.remove(appId)` needs a clear duplicate-app policy because the current catalog query can return multiple case-insensitive matches while `addApplications` dedupes by `appId`.
- `apps.open(...)` should reuse the same DACP/open behavior as app-originated `fdc3.open()` where possible; delivery must avoid creating a second launch path that bypasses pending instance registration.
- Host-visible intent delivery success/failure after resolver selection is still not clearly available; this PRD does not require that unless delivery identifies an existing safe signal.
- `ChannelControl` may become redundant or may be retained as a picker-only type; docs and exports should avoid presenting it as the primary preset API.
- Manual composition reuse is desirable, but broad manual docs could expand the workload. Keep it to helper design plus a brief advanced note unless the follow-up is split.

## Constraints

- FDC3 app-facing behavior remains aligned with FDC3 2.2. Apps use `@finos/fdc3` `getAgent()` from iframe/window contexts.
- Browser host controllers are additive Sail APIs for host builders, not proposed additions to the FDC3 standard.
- `core/` remains UI-free and protocol-pure.
- No React-specific types in `@finos/sail-desktop-agent`; examples may show React/Svelte/Vue/vanilla usage in website docs.
- Runtime app catalog APIs should use existing app directory validation/merge behavior where possible.
- Documentation-only work items must not prescribe executable tests for markdown.

## Suggested vertical slices

| ID | Slice | Kind | Work item slug |
|---|---|---|---|
| BHA-00 | Coordinate browser preset host API delivery | epic | `epic-browser-preset-host-api` |
| BHA-01 | Add reusable browser host controller composition helper | task | `add-browser-host-controller-composition` |
| BHA-02 | Promote intent resolver controller on browser preset | task | `promote-browser-intent-resolver-controller` |
| BHA-03 | Add browser channels controller with host channel changes | task | `add-browser-channels-controller` |
| BHA-04 | Add browser apps controller for catalog and lifecycle | task | `add-browser-apps-controller` |
| BHA-05 | Document browser preset host controllers | task | `document-browser-preset-host-controllers` |

## PRD accuracy gate (2026-06-19 / v3-pre)

| ID | Claim | Evidence label | Local evidence | Work item slug |
|---|---|---|---|---|
| BHA-01 | Browser preset does not expose grouped host controllers today. | **done** — work item deleted (2026-06-20) | Grouped `intentResolver`, `channels`, `apps` via `createBrowserHostControllers` | `add-browser-host-controller-composition` |
| BHA-02 | Intent resolver UI exists but canonical property/name is not the agreed controller surface. | **done** — work item deleted (2026-06-20) | `desktopAgent.intentResolver` canonical; `BrowserIntentResolverController` = `IntentResolverUIMethods` | `promote-browser-intent-resolver-controller` |
| BHA-03 | Package-only host channel changes are not first-class. | verified-gap | Docs show `getBrowserDesktopAgentSession(...).connectorTransport.send(...)`; no `DesktopAgent.changeAppChannel` or `channels` controller exists. | `add-browser-channels-controller` |
| BHA-04 | App directory state can be mutated internally but runtime host catalog registration is not exposed as a grouped browser API. | verified-gap | `addApplications` and `loadDirectoryIntoState` exist in core state mutators; preset only accepts initial `apps` / `appDirectories` options. | `add-browser-apps-controller` |
| BHA-05 | Website docs describe broad concepts but not the agreed grouped API or runtime registration examples. | verified-gap | `integrator-guide.md` documents `intentResolverUI`, advanced channel transport, and `AppLauncher`, not `intentResolver` / `channels` / `apps` controllers. | `document-browser-preset-host-controllers` |

## Work item retention

**Policy:** Delivered work item `.md` files are **deleted**; this section is the durable record.

| Slug | Status | Delivered |
|------|--------|-----------|
| `add-browser-host-controller-composition` | done — work item deleted | 2026-06-20 — `createBrowserHostControllers`, grouped controllers on browser preset |
| `promote-browser-intent-resolver-controller` | done — work item deleted | 2026-06-20 — canonical `intentResolver` controller with full UI method surface |

## Parent context summary

Browser host developers need one obvious API on `createBrowserDesktopAgent` for host chrome and iframe orchestration. The app-facing FDC3 API remains `@finos/fdc3` `getAgent()` inside iframe/window apps. The new host API should be additive, typed, destructurable, and framework-neutral. `appLauncher` stays a host-provided option callback; returned controllers expose ongoing host actions and subscriptions. Core remains protocol-pure, while preset/browser-host composition modules connect controllers to existing Desktop Agent state, WCP connector events, DACP handlers, and app directory mutators.
