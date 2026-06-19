---
title: "Reorganize core handlers — colocate call flow, lift state out"
slug: reorganize-core-handlers-colocate-state
kind: task
type: chore
status: draft
loop_count: 0
loop_limit: 3
last_agent: spec-planner
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/
  - packages/sail-desktop-agent/src/core/runtime/
  - packages/sail-desktop-agent/src/core/state/types.ts
  - packages/sail-desktop-agent/src/core/state/mutators/wcp-handshake-routing.ts
  - packages/sail-desktop-agent/src/core/state/selectors/wcp-handshake-routing.ts
  - packages/sail-desktop-agent/src/core/desktop-agent.ts
  - packages/sail-desktop-agent/src/core/index.ts
  - packages/sail-desktop-agent/src/app-connection/wcp-connector.ts
  - packages/sail-desktop-agent/src/app-connection/wcp/wcp-connection-management.ts
  - packages/sail-desktop-agent/test/support/mock-transport.ts
  - packages/sail-desktop-agent/src/__tests__/import-path-smoke.test.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/__tests__/
  - packages/sail-desktop-agent/src/app-connection/__tests__/wcp-desktop-agent.integration.test.ts
  - AGENTS.md
  - .cursor/skills/consume-sail-desktop-agent/SKILL.md
  - website/docs/packages/desktop-agent/composition.md
depends_on:
  - move-wcp-temp-id-alias-to-agent-state
integration_branch: v3-pre
branch: v3-pre
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - architecture
  - api
  - fdc3
  - wcp
  - migration
---

## Goal

Restructure `packages/sail-desktop-agent/src/core/` so **handlers own DACP/WCP call routing only**, durable maps live on **`AgentState` via `state/` mutators and selectors**, and **non-serializable runtime side effects** (timers, transport-scoped WeakMaps) sit in a small **`core/runtime/`** folder — without new facades or backward-compat shims.

## User or system context

Contributors currently find module-level singletons beside handlers (`instance-id-resolver.ts` at `core/` root, `heartbeat-runtime.ts`, `instance-identity-registry.ts`, `wcp-pending-source-window.ts` under `handlers/dacp/`). That blurs “handler = message in/out” with “where persistent or process-local state lives”, making cleanup and adoption paths harder to reason about.

This item is **folder and import hygiene** after handshake routing links are on `AgentState` (`move-wcp-temp-id-alias-to-agent-state`). It does not re-litigate WCP semantics.

## Reference docs

- `plans/work-items/move-wcp-temp-id-alias-to-agent-state.md` (prerequisite — deletes `instance-id-resolver.ts`, adds `state.wcpHandshakeRouting`)
- `plans/work-items/consolidate-temp-instance-id-resolver.md` (historical — module singleton introduced here)
- `plans/work-items/epic-desktop-agent-state-hardening.md`
- `AGENTS.md` (`src/` layout, WCP handshake routing vs instance id, testing conventions)
- `.cursor/skills/consume-sail-desktop-agent/SKILL.md` (integrator-facing; no monorepo paths today)

## Parent context

State-hardening epic follow-up: once WCP routing links are on `AgentState`, align physical layout with the mental model (handlers route; state mutates; runtime holds timers/WeakMaps that cannot be serialized).

## Behavior spec

Scenario: Handshake routing id resolution uses AgentState only
  Given `move-wcp-temp-id-alias-to-agent-state` is merged
  When WCP5 links a `handshakeRoutingId` to an `instanceId`
  Then no module-level `Map` at `core/instance-id-resolver.ts` exists
  And handlers call `state/selectors/wcp-handshake-routing` (or equivalent) via `DACPHandlerContext.getState()`

Scenario: Handler modules contain no new module singletons for agent data
  Given the reorganized tree
  When searching `core/handlers/**` for `new Map(` / `new WeakMap(` at module scope
  Then only test harness files under `__tests__/` contain such patterns
  And agent-scoped data maps are under `core/state/`

Scenario: Runtime side effects are grouped and documented
  Given heartbeat intervals and open-with-context timeout handles
  When cleanup runs for an instance
  Then timer modules under `core/runtime/` are imported by handlers/cleanup — not duplicated inside `*-handlers.ts`
  And each runtime module header comment states why it is **not** on `AgentState` (non-serializable or transport-scoped)

Scenario: Import paths remain stable for public package exports
  Given `npm run build -w @finos/sail-desktop-agent`
  When running `npm test -w @finos/sail-desktop-agent`
  Then all tests pass with updated internal imports only — no new public re-export shims

## Out of scope

- Backward-compatibility shims (`@deprecated` re-exports, legacy path aliases, “migration” modules) unless the human explicitly requests compat
- Moving WCP connector `connections` / `messagePortTransports` into `AgentState`
- Splitting `handlers/dacp/index.ts` router into multiple packages
- FDC3 wire or conformance behavior changes
- Refactoring `app-directory/` or `dacp/` wire helpers (unchanged unless imports break)

## Proposed folder structure

**Principle:** handlers = call flow; `state/` = durable `AgentState`; `runtime/` = process-local side effects that handlers invoke.

```text
core/
  handlers/
    types.ts                    # DACPHandlerContext, validators
    dacp/
      index.ts                  # routeDACPMessage router only
      *-handlers.ts             # message handlers (context, intent, wcp, …)
      cleanup.ts                # orchestration leaf (imports runtime + state)
      intent-handlers/          # unchanged grouping
      utils/                    # pure helpers (responses, open-with-context delivery)
  state/                        # AgentState types, initial-state, mutators, selectors
    mutators/wcp-handshake-routing.ts   # from prerequisite item
    selectors/wcp-handshake-routing.ts
  runtime/                      # NEW — non-AgentState side effects
    heartbeat-timers.ts         # was handlers/dacp/heartbeat-runtime.ts
    open-with-context-timeouts.ts  # timeout Map split from utils/open-with-context.ts
    wcp/
      transport-identity-registry.ts   # was instance-identity-registry.ts
      pending-source-window.ts       # was wcp-pending-source-window.ts
  dacp/                         # wire types, creators, errors (unchanged role)
  app-directory/                # queries + fetch (unchanged role)
  desktop-agent.ts
  sail-default-config.ts
```

**`instance-id-resolver.ts`:** Do **not** colocate under WCP handlers. Persistent handshake routing links belong on **`AgentState`** (prerequisite item). After that item, delete the root file — handlers import state selectors/mutators only.

**Transport-scoped WeakMaps** (`transport-identity-registry`, `pending-source-window`): Stay **outside** `AgentState` (Window refs, per-`Transport` lifecycle, InMemoryTransport structuredClone constraint). Colocate under `core/runtime/wcp/` because WCP handlers and `WCPConnector` both consume them — not because they are “handler state”.

**Heartbeat / open-with-context timers:** Move to `core/runtime/`; keep `state.heartbeats` and `state.open.pendingWithContext` as the durable slices.

## TypeScript interfaces

No new public APIs. Internal moves only. Expected state shape (from prerequisite):

```typescript
export interface WcpHandshakeRoutingState {
  handshakeRoutingIdToInstanceId: Record<string, string>
}
```

Handlers use existing `DACPHandlerContext` (`getState`, `setState`) — no new handler context fields.

## Test guidance

No new behavior — refactor-only. RED is optional (import-path smoke already exists).

1. Run `npm test -w @finos/sail-desktop-agent` before and after; must stay green.
2. Extend `import-path-smoke.test.ts` if new top-level folders need boundary checks (e.g. `core/runtime/` not exported from package root).
3. Keep `*ForTesting` cleanup hooks next to runtime modules (same pattern as `clearAllHeartbeatTimersForTesting`).
4. Update moved test file paths under `handlers/dacp/__tests__/` as needed — no assertion relaxation.

## Documentation scope (same delivery)

- **`AGENTS.md`:** Update `src/` layout bullet to document `core/handlers/` (call flow), `core/state/` (AgentState), `core/runtime/` (timers + transport-scoped WeakMaps); replace references to `instance-id-resolver.ts` with `state.wcpHandshakeRouting` + selector names; keep WCP4 routing vs WCP5 `instanceId` guidance.
- **`.cursor/skills/consume-sail-desktop-agent/SKILL.md`:** **No structural change required** for integrators (published `/presets` surface unchanged). Optional one-line note that monorepo contributors use `getState()` for introspection — only if AGENTS.md layout section is updated for parity.
- **`website/docs/packages/desktop-agent/composition.md`:** Update Mermaid/module diagram if it lists `handlers/dacp/*-runtime` or root `instance-id-resolver` — align with `state/` + `runtime/` split.

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
