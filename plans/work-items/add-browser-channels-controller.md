---
title: "Add browser channels controller"
slug: add-browser-channels-controller
kind: task
type: feature
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/presets/create-browser-desktop-agent.ts
  - packages/sail-desktop-agent/src/presets/browser-session.ts
  - packages/sail-desktop-agent/src/core/desktop-agent.ts
  - packages/sail-desktop-agent/src/app-connection/wcp-connector-events.ts
  - packages/sail-desktop-agent/src/presets/__tests__/browser-desktop-agent-preset.test.ts
  - packages/sail-desktop-agent/src/app-connection/__tests__/wcp-desktop-agent.integration.test.ts
depends_on:
  - add-browser-host-controller-composition
integration_branch: v3-pre
branch: cursor/add-browser-channels-controller
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - api
  - fdc3
---

## Goal

Expose first-class browser host channel controls so package-only hosts can read, observe, and change per-instance user channel membership without using WCP connector internals.

## User or system context

Host channel chrome lives outside iframe apps. Apps still use standard FDC3 channel APIs inside their browsing context, but the host needs to render per-tile channel UI and initiate user channel changes on behalf of a validated instance id.

## Reference docs

- `plans/prd-browser-preset-host-api.md` (BHA-04)
- `plans/work-items/epic-browser-preset-host-api.md`
- `plans/work-items/add-browser-host-controller-composition.md`
- `website/docs/architecture/channel-selection.md`
- `packages/sail-desktop-agent/src/core/handlers/dacp/channel-handlers.ts`

## Parent context

Current docs show a package-only `connectorTransport.send(...)` helper for host-driven channel changes. This work item turns that into a supported `desktopAgent.channels` controller while keeping the underlying behavior on the same DACP join/leave handler path apps use.

## Behavior spec

Scenario: Host reads current app channel
  Given an iframe app is connected with a validated instance id
  When the host calls the channels controller for that instance
  Then it receives the current user channel or null

Scenario: Host changes app channel
  Given an iframe app is connected with a validated instance id
  When the host changes that instance to a user channel through the channels controller
  Then the app receives the standard user channel changed event

Scenario: Host leaves current app channel
  Given an iframe app is joined to a user channel
  When the host changes that instance channel to null
  Then the app leaves its current user channel and the host observes a null channel change

Scenario: App-driven channel change updates host
  Given an iframe app joins a user channel through its standard FDC3 API
  When the Desktop Agent updates membership
  Then the host channel controller notifies subscribers with the changed instance id and channel id

Scenario: Channel listener unsubscribes
  Given a host subscribed to app channel changes
  When it calls the returned unsubscribe function
  Then later channel changes no longer invoke that listener

## Out of scope

- Runtime creation of new user channels
- Injected WCP3 channel selector iframe pages
- React-specific channel selector components
- Direct writes to agent state that bypass DACP handlers

## TypeScript interfaces

```typescript
interface AppChannelChangeEvent {
  instanceId: string
  channelId: string | null
  channel: Channel | null
}

interface BrowserChannelsController {
  getUserChannels(): Channel[]
  getAppChannel(instanceId: string): Channel | null
  getAppChannelId(instanceId: string): string | null
  changeAppChannel(instanceId: string, channelId: string | null): Promise<void>
  onAppChannelChange(listener: (event: AppChannelChangeEvent) => void): () => void
}
```

## Test guidance

RED: Add tests at the browser preset or WCP integration layer proving host-driven `changeAppChannel` uses the same observable path as app-driven joins: agent state changes, app receives `channelChangedEvent`, and host subscribers receive `onAppChannelChange`. Avoid wall-clock sleeps; use observable counters and existing async flush/wait helpers.

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
