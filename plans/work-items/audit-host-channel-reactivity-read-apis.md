---
title: "Audit host channel reactivity and restrict public state reads"
slug: audit-host-channel-reactivity-read-apis
kind: task
type: chore
status: waiting_on_user
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
file_manifest:
  - packages/sail-desktop-agent/src/core/desktop-agent.ts
  - packages/sail-platform-api/src/sail-platform.ts
  - packages/sail-web/src/stores/connection-store.ts
  - packages/sail-web/src/components/ChannelSelector.tsx
  - website/docs/packages/desktop-agent/integrator-guide.md
depends_on: []
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

### 2025-06-19 — Phase A RED (test-engineer)
- Registered subagent: yes (`test-engineer`)
- Test files: `packages/sail-platform-api/src/__tests__/sail-platform-channel.test.ts`, `packages/sail-web/src/__tests__/stores/connection-store.test.ts`
- Command: `npm test -w @finos/sail-web -- src/__tests__/stores/connection-store.test.ts && npm test -w @finos/sail-platform-api -- src/__tests__/sail-platform-channel.test.ts`
- Failure: 3 platform-api tests timeout — `changeAppChannel` never resolves; WCP transport not registered for seeded instance
- Expected: RED correct — integration needs WCP-connected fixture or host-initiated channel change must emit `channelChanged` without app transport routing
- Audit: no `getState()` in channel UI paths; app-directory-store still uses it for directory only

## Staged for review

**Automation tier:** `stage_only` — staged, no commit until you `approve`.

### Phase audit

| Phase | Subagent | Registered | Result |
|-------|----------|------------|--------|
| A RED | test-engineer | yes | 3 platform-api tests RED (changeAppChannel hang); 4 sail-web tests green |
| B GREEN | implement-agent | yes | `ui_surface: yes` — 15/15 focused tests reported green |
| C Verify | verifier-agent | yes | VERIFICATION: PASS |
| D Review | code-reviewer | yes | VERDICT: PASS |

**Session probe:** `registered_subagents: yes` (verifier-agent → PONG)

### RED evidence
- Test files changed: `packages/sail-platform-api/src/__tests__/sail-platform-channel.test.ts`, `packages/sail-web/src/__tests__/stores/connection-store.test.ts`
- Command run: `npm test -w @finos/sail-web -- src/__tests__/stores/connection-store.test.ts && npm test -w @finos/sail-platform-api -- src/__tests__/sail-platform-channel.test.ts`
- Failure summary: 3 platform-api tests timed out — `changeAppChannel` never resolved without WCP transport / `channelChanged` push
- Expected reason: Host-initiated channel change must emit connector `channelChanged` without app MessagePort routing
- Unrelated tests: healthy (scoped runs)

### Audit findings
- No `getState()` in channel UI paths (`connection-store`, `ChannelSelector`, `sail-platform` channel APIs)
- `app-directory-store.ts` still uses `getState()` for app directory only (out of scope)

### Files changed
- `packages/sail-desktop-agent/src/core/desktop-agent.ts` — `changeAppUserChannel()`, host-visible `channelChangedEvent` fallback; `getState()` TSDoc narrowed to test/debug
- `packages/sail-platform-api/src/sail-platform.ts` — `changeAppChannel` calls `agent.changeAppUserChannel`
- `packages/sail-web/src/stores/connection-store.ts` — `enableMapSet()`; push-model comments
- `packages/sail-web/src/components/ChannelSelector.tsx` — `useStore` subscription; `platformRef`
- `website/docs/packages/desktop-agent/integrator-guide.md` — push + granular pull; discourage `getState()` for channel chrome
- `packages/sail-platform-api/src/__tests__/sail-platform-channel.test.ts` — +3 integration tests
- `packages/sail-web/src/__tests__/stores/connection-store.test.ts` — new (4 tests)

### Learnings proposed
- Host channel chrome: `changeAppUserChannel` / `SailPlatform.changeAppChannel` + WCP `channelChanged` push; `getState()` test/debug only
- Platform-api integration tests need WCP-connected fixture or host path must emit `channelChanged` without app transport
- `connection-store` Immer Maps need `enableMapSet()` locally
- App-initiated joins only reach host UI when apps registered `channelChanged` listeners (host-initiated path has explicit fallback)

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
