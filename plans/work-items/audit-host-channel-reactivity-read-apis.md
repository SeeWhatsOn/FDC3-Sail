---
title: "Audit host channel reactivity and restrict public state reads"
slug: audit-host-channel-reactivity-read-apis
kind: task
type: chore
status: draft
loop_count: 0
loop_limit: 3
last_agent: spec-planner
file_manifest:
  - packages/sail-desktop-agent/src/core/desktop-agent.ts
  - packages/sail-platform-api/src/sail-platform.ts
  - packages/sail-web/src/stores/connection-store.ts
  - packages/sail-web/src/components/ChannelSelector.tsx
  - website/docs/packages/desktop-agent/integrator-guide.md
depends_on:
  - wire-wcp5-connected-instance-lifecycle
  - user-channels-runtime-ssot
integration_branch: v3-pre
branch: cursor/audit-host-channel-reactivity-read-apis
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - api
  - fdc3
  - user-channels
---

## Goal

Verify and document that host channel UI uses event push (`channelChanged`) plus granular pull (`getAppUserChannel`); narrow public `getState()` to tests/debug; add any missing host-facing getters needed for channel chrome.

## User or system context

Host integrators must update channel selector UI when membership changes without mutating agent state directly or polling full state snapshots.

## Reference docs

- `plans/prd-desktop-agent-state-hardening.md` (PRD-04h)
- `website/docs/architecture/channel-selection.md`
- FDC3 channel join: `joinUserChannel` + `userChannelChanged` for apps; host uses platform APIs

## Parent context

After lifecycle and user-channel SSOT so read APIs reflect truthful connected state and channel list.

## Behavior spec

Scenario: Host channel selector updates on channel change event
  Given a running Sail platform with an app tile and channel selector
  When the platform changes the app's user channel on behalf of the instance
  Then the connection store reflects the new channel id without reading raw agent state

Scenario: Host reads current channel via granular API
  Given an app instance joined to a user channel
  When the host requests the current channel for that instance id
  Then the returned channel id matches the value in agent state

Scenario: Integrators are not encouraged to mutate state via getState
  Given public desktop agent API documentation
  When an integrator needs channel membership for UI
  Then documentation directs them to platform or connector events and getters rather than mutating `getState()` results

## Out of scope

- Adding full `onStateChange` subscription to DesktopAgent
- Rewriting sail-web UI components beyond fixing incorrect read paths found in audit

## TypeScript interfaces

Consider documenting or adding:

```typescript
/** Test/debug only — do not mutate returned object. */
getState(): AgentState

getAppUserChannelId(instanceId: string): string | null
```

## Test guidance

Audit-driven: grep sail-platform-api and sail-web for `getState()` on DesktopAgent. Add regression test if gap found (e.g. platform channel read after `changeAppChannel`). No new Cucumber unless audit finds DA gap.

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
