---
title: "Move WCP temp→instanceId links to AgentState"
slug: move-wcp-temp-id-alias-to-agent-state
kind: task
type: chore
status: waiting_on_user
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
file_manifest:
  - packages/sail-desktop-agent/src/core/state/types.ts
  - packages/sail-desktop-agent/src/core/state/initial-state.ts
  - packages/sail-desktop-agent/src/core/state/mutators/wcp-handshake-routing.ts
  - packages/sail-desktop-agent/src/core/state/mutators/index.ts
  - packages/sail-desktop-agent/src/core/state/selectors/wcp-handshake-routing.ts
  - packages/sail-desktop-agent/src/core/state/selectors/index.ts
  - packages/sail-desktop-agent/src/core/instance-id-resolver.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/cleanup.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/wcp-handlers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/heartbeat-runtime.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/utils/resolve-context-listener-instance-id.ts
  - packages/sail-desktop-agent/src/app-connection/wcp/wcp-connection-management.ts
  - packages/sail-desktop-agent/src/app-connection/wcp-connector.ts
  - packages/sail-desktop-agent/test/support/mock-transport.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/__tests__/cleanup.test.ts
  - packages/sail-desktop-agent/test/world/index.ts
  - packages/sail-desktop-agent/src/presets/create-browser-desktop-agent.ts
  - AGENTS.md
depends_on:
  - consolidate-temp-instance-id-resolver
integration_branch: v3-pre
branch: v3-pre
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - api
  - fdc3
  - wcp
  - migration
---

## Goal

Store WCP **handshake routing id → instanceId** links on `AgentState` (not a module singleton), and rename APIs to match what each id is — no “tempInstanceId”, no “canonical”.

## Naming (KISS — call it what it is)

FDC3 puts a string in `meta.destination.instanceId` during the handshake. That value is **not** a validated app instance yet — it is only a **routing address** for DACP/WCP until WCP5 finishes.

| Misleading (avoid) | What it actually is | Name to use |
|--------------------|---------------------|-------------|
| tempInstanceId | Routing id during WCP4 (`temp-{connectionAttemptUuid}` on mint path, or host launcher id on adopt path) | **`handshakeRoutingId`** |
| canonical instanceId | WCP5-validated id — row key in `state.instances` | **`instanceId`** |
| connectionAttemptUuid | UUID from WCP1 Hello (spec field) | **`connectionAttemptUuid`** |
| “canonical”, “temp link resolver” | Map from pre-WCP5 routing → post-WCP5 id | **`handshakeRoutingIdToInstanceId`** |

**Two handshake paths (why one word “temp” was wrong):**

1. **Mint path** — routing id is `temp-{connectionAttemptUuid}` until WCP5 assigns `instanceId`.
2. **Host-adopt path** — routing id may already be the launcher’s `instanceId` (still `PENDING` until WCP5).

So the map is not “temp → canonical”; it is **“whatever id DACP used to route this connection before validation → the validated `instanceId`”**.

**API names:**

- `linkHandshakeRoutingId(state, handshakeRoutingId, instanceId)`
- `resolveInstanceId(state, routingId)` — if `routingId` is in the map, return `instanceId`; else return `routingId` unchanged
- `clearHandshakeRoutingIdsForInstance(state, instanceId)`

**State slice:** `state.wcpHandshakeRouting.handshakeRoutingIdToInstanceId`

Wire/meta still says `instanceId` per FDC3 schema — that is the spec. Internal code should not copy that into variable names when the row does not exist yet.

## User or system context

`consolidate-temp-instance-id-resolver` introduced `instance-id-resolver.ts` as a quick module-level `Map`. Long term, temp→instanceId links belong on `AgentState` and are pruned with instance cleanup — same pattern as `appDirectory` and `channels.user`.

Browser edge (`WCPConnector`) keeps `connections` / `messagePortTransports` for MessagePort routing. This item moves only the **DA temp link table** into state.

## Reference docs

- `plans/prd-desktop-agent-state-hardening.md` (PRD-04d follow-up)
- `plans/work-items/consolidate-temp-instance-id-resolver.md`
- `AGENTS.md` WCP4 temp vs WCP5 instance ids (update wording when this lands)

## Parent context

State-hardening epic: promote temp links to `AgentState` and drop jargon from public/internal names.

## Behavior spec

Scenario: WCP5 records handshake routing link in agent state
  Given a desktop agent validating an app through WCP5
  When WCP5 succeeds with `instanceId` for a prior `handshakeRoutingId`
  Then `state.wcpHandshakeRouting.handshakeRoutingIdToInstanceId[handshakeRoutingId]` equals that `instanceId`
  And `state.instances[instanceId]` holds the instance row

Scenario: Cleanup with handshake routing id finds the real instance
  Given a routing link and a live `state.instances[instanceId]`
  When cleanup or `disconnectInstance` is called with the pre-WCP5 routing id
  Then cleanup runs against `instanceId` and clears routing entries for that instance

Scenario: Coupled browser reads links from agent state
  Given `createBrowserDesktopAgent` (shared DA + connector)
  When the connector must resolve a `tempId` after WCP5
  Then it uses agent state selectors — not a hidden module `Map`

## Out of scope

- Backward-compatibility shims (`@deprecated` re-exports, legacy facades, “migration” APIs) — v3-pre breaking change unless human requests compat
- Moving connector `connections` / `messagePortTransports` into `AgentState`
- FDC3 WCP message shape changes
- Cross-process link sync for remote DA (each DA owns its own `AgentState`)

## TypeScript interfaces

```typescript
/** Pre-WCP5 DACP routing id → validated instanceId (mint and host-adopt paths). */
export interface WcpHandshakeRoutingState {
  handshakeRoutingIdToInstanceId: Record<string, string>
}

// AgentState gains:
// wcpHandshakeRouting: WcpHandshakeRoutingState

// mutators/wcp-handshake-routing.ts
function linkHandshakeRoutingId(
  state: AgentState,
  handshakeRoutingId: string,
  instanceId: string
): AgentState
function clearHandshakeRoutingIdsForInstance(state: AgentState, instanceId: string): AgentState

// selectors/wcp-handshake-routing.ts
function resolveInstanceId(state: AgentState, routingId: string): string | undefined
```

Delete `instance-id-resolver.ts` once call sites use state selectors/mutators. **No `@deprecated` aliases, legacy re-exports, or migration facades** unless the human explicitly requests backward compatibility.

## Test guidance

RED: assert links live on `getState().wcpTempLinks` after WCP5; rename contract tests to `linkTempToInstanceId` / `resolveInstanceId`. Keep heartbeat-off temp disconnect scenarios from prior item.

Run: `npm test -w @finos/sail-desktop-agent`

## Blocked decisions

_(empty)_

## Staged for review

**Status:** waiting_on_user (staged 2026-06-19)

### Commands run
- `npm test -w @finos/sail-desktop-agent`: **284 Vitest + 15 Cucumber pass** (exit 0)

### Diff summary
- **State:** `wcpHandshakeRouting.handshakeRoutingIdToInstanceId` on `AgentState`; mutators `linkHandshakeRoutingId`, `clearHandshakeRoutingIdsForInstance`; selectors `resolveInstanceId`, `resolveLinkedInstanceId`
- **Deleted:** `core/instance-id-resolver.ts` module singleton
- **Handlers:** WCP5/heartbeat link via `setState`; cleanup clears routing entries
- **Browser:** `WCPConnector.bindAgentState()` wired from `createBrowserDesktopAgent`
- **Cucumber:** `MockTransport.onHandshakeRoutingLinked` mirrors links onto agent state
- **AGENTS.md:** handshake routing guidance updated

## Loop history

- 2026-06-19 approved by human; delivered same session (stacked on uncommitted consolidate work)

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
