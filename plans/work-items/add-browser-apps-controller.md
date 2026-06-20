---
title: "Add browser apps controller"
slug: add-browser-apps-controller
kind: task
type: feature
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/presets/create-browser-desktop-agent.ts
  - packages/sail-desktop-agent/src/presets/browser-session.ts
  - packages/sail-desktop-agent/src/core/state/mutators/app-directory.ts
  - packages/sail-desktop-agent/src/core/app-directory/app-directory-queries.ts
  - packages/sail-desktop-agent/src/core/state/selectors/instance.ts
  - packages/sail-desktop-agent/src/presets/__tests__/browser-desktop-agent-preset.test.ts
  - packages/sail-desktop-agent/src/app-connection/__tests__/wcp-desktop-agent.integration.test.ts
depends_on:
  - add-browser-host-controller-composition
integration_branch: v3-pre
branch: cursor/add-browser-apps-controller
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - api
  - fdc3
---

## Goal

Expose a browser `apps` controller for runtime app catalog registration, catalog reads, host-initiated opens, connection/instance reads, lifecycle subscriptions, and instance disconnect.

## User or system context

Browser hosts often load app metadata after shell creation, show launch menus from dynamic catalogs, create pending iframe tiles, and reconcile those tiles when WCP5 returns the canonical instance id. They should not need to seed every app before agent creation or inspect raw agent state for common host lifecycle tasks.

## Reference docs

- `plans/prd-browser-preset-host-api.md` (BHA-05)
- `plans/work-items/epic-browser-preset-host-api.md`
- `plans/work-items/add-browser-host-controller-composition.md`
- `packages/sail-desktop-agent/src/core/state/mutators/app-directory.ts`
- `packages/sail-desktop-agent/src/host-contracts/app-launcher.ts`

## Parent context

`appLauncher` remains a host-provided option callback because only the host can create iframe/window UI. The returned `apps` controller manages ongoing host interactions: dynamic catalog setup, host-initiated opens, runtime instances, connections, and disconnects.

## Behavior spec

Scenario: Host adds a directory after agent creation
  Given a Browser Desktop Agent has been created without initial app directories
  When the host adds an app directory through the apps controller
  Then the host can read the loaded apps from the same controller

Scenario: Host adds dynamic app metadata
  Given a Browser Desktop Agent has been created
  When the host adds a valid app through the apps controller
  Then the app appears in catalog reads and can participate in launch and intent discovery

Scenario: Host opens an app from catalog
  Given a launchable app exists in the app catalog
  When the host opens it through the apps controller
  Then the Desktop Agent uses the configured app launcher and returns an app identifier

Scenario: Host observes app connection
  Given a host opened an iframe app
  When the app completes WCP identity validation
  Then the apps controller notifies subscribers with connection metadata including app id and canonical instance id

Scenario: Host disconnects an app instance
  Given an app instance is connected
  When the host disconnects it through the apps controller
  Then the Desktop Agent runs the same cleanup path as WCP goodbye or heartbeat timeout

## Out of scope

- A persistent app directory database
- File-system app directory loading in the core package
- Changing the FDC3 App Directory schema
- Changing `AppLauncher.launch` responsibility for iframe/window creation
- A full manual composition guide

## TypeScript interfaces

```typescript
interface BrowserAppOpenOptions {
  context?: Context
  instanceId?: string
}

interface BrowserAppInstance {
  appId: string
  instanceId: string
  status: "pending" | "connected"
  currentUserChannel?: string | null
}

interface HandshakeFailureEvent {
  error: Error
  connectionAttemptUuid: string
}

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

`DirectoryApp` is the package's launchable app directory shape; plain FDC3 `AppMetadata` is not enough for runtime registration because hosts need launch details.

## Test guidance

RED: Add focused tests for runtime `add`, `addAll`, and `addDirectory` catalog updates, plus lifecycle subscription/unsubscribe behavior. For `open`, prefer proving the controller calls the same Desktop Agent launch/open path rather than duplicating low-level WCP handshake coverage already covered elsewhere.

## Blocked decisions

_(empty)_

## Loop history

_(empty)_

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
