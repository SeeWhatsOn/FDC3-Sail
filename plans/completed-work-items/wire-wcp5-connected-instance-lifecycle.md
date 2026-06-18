---
title: "Wire WCP5 CONNECTED lifecycle and heartbeat policy"
slug: wire-wcp5-connected-instance-lifecycle
kind: task
type: feature
status: done
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/wcp-handlers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/app-handlers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/event-handlers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-helpers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-raise-intent.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-raise-intent-for-context.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-raise-shared.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-resolver-helpers.ts
  - packages/sail-desktop-agent/src/app-connection/__tests__/wcp-desktop-agent.integration.test.ts
  - packages/sail-desktop-agent/test/step-definitions/start-app.steps.ts
  - packages/sail-desktop-agent/test/step-definitions/generic.steps.ts
  - packages/sail-desktop-agent/test/step-definitions/intents.steps.ts
  - packages/sail-desktop-agent/test/step-definitions/broadcast.steps.ts
  - packages/sail-desktop-agent/test/step-definitions/heartbeat.steps.ts
  - packages/sail-desktop-agent/test/step-definitions/app-channel.steps.ts
  - packages/sail-desktop-agent/test/step-definitions/event-listener.steps.ts
  - packages/sail-desktop-agent/test/step-definitions/private-channel.steps.ts
  - packages/sail-desktop-agent/test/step-definitions/user-channel.steps.ts
  - packages/sail-desktop-agent/test/world/index.ts
depends_on: []
integration_branch: v3-pre
branch: v3-pre
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - api
  - fdc3
  - wcp
---

## Goal

Implement Option A instance lifecycle: host pre-register stays `PENDING` until WCP5 success sets `CONNECTED`; WCP6 and heartbeat timeout (when enabled) remove the instance — with RED tests on the real WCP path first.

## User or system context

Production instances never leave `PENDING` today because WCP5 does not call `updateInstanceState(CONNECTED)`. Tests paper over this. Integrators and FDC3 flows need a truthful connected/disconnected model independent of optional heartbeat liveness.

## Reference docs

- `plans/prd-desktop-agent-state-hardening.md` (PRD-04a–c)
- FDC3 WCP Step 2: https://fdc3.finos.org/docs/api/specs/webConnectionProtocol#step-2-validate-app--instance-identity
- FDC3 DACP heartbeat: https://fdc3.finos.org/docs/api/specs/desktopAgentCommunicationProtocol#checking-apps-are-alive
- `website/docs/packages/desktop-agent/integrator-guide.md` (heartbeat section)

## Parent context

First slice of state-hardening epic. `PENDING` = host `open` pre-register only. `CONNECTED` = WCP5 succeeded. Heartbeat off = no liveness checks; lifecycle still applies via WCP6.

## Behavior spec

Scenario: WCP5 marks instance connected
  Given a desktop agent with a valid app in the directory
  When an app completes WCP4 validation and receives WCP5 success
  Then the instance exists in agent state with connection state `connected`

Scenario: Host pre-register remains pending until WCP5
  Given a host launcher returns an instance id from an open request
  When WCP5 has not yet succeeded for that instance
  Then the instance state is `pending`

Scenario: WCP6 disconnect removes instance
  Given a connected app instance
  When the app sends WCP6Goodbye
  Then the instance is no longer present in agent state

Scenario: Heartbeat disabled skips liveness machinery
  Given a desktop agent created with heartbeat disabled
  When WCP5 succeeds for an app
  Then no heartbeat timers are active for that instance and the instance remains until explicit disconnect

Scenario: Heartbeat timeout removes instance when enabled
  Given a desktop agent with heartbeat enabled and short test timeouts
  When a connected app stops acknowledging heartbeats beyond the configured timeout
  Then the instance is removed from agent state using the same cleanup as disconnect

## Out of scope

- Removing unused enum values (`remove-dead-instance-state-denormalization`)
- Temp id consolidation
- Changing FDC3 heartbeat wire format

## TypeScript interfaces

Use existing `AppInstanceState.PENDING` and `AppInstanceState.CONNECTED` only in this slice.

## Test guidance

RED first: extend `wcp-desktop-agent.integration.test.ts` to assert `CONNECTED` after WCP5 without manual `updateInstanceState`. Add heartbeat on/off cases (reuse Cucumber heartbeat feature patterns or Vitest with short intervals). Update `start-app.steps.ts` to stop forcing `CONNECTED` when scenarios exercise WCP validate path. Fix misleading comment in `intent-helpers.ts` that claims PENDING means WCP handshake complete.

Run: `npm test -w @finos/sail-desktop-agent`

## Blocked decisions

_(empty)_

## Loop history

- 2026-06-18 Phase B GREEN (implement-agent, registered: yes): WCP5→CONNECTED wired; loop-back fixed Cucumber harness (heartbeat default off, lazy intent resolver)
- 2026-06-18 Phase C Verify (verifier-agent, registered: yes): FAIL scope — manifest updated to match 19-file diff; tests green
- 2026-06-18 Phase D Review (code-reviewer, registered: yes): VERDICT: PASS
- 2026-06-18 staged for human review

## Staged for review

**Status:** waiting_on_user (staged 2026-06-18)

### Phase audit
| Phase | Subagent | Registered | Result |
|-------|----------|------------|--------|
| A RED | test-engineer | yes | 5 WCP integration tests fail (expected) |
| B GREEN | implement-agent | yes | 297 Vitest pass; Cucumber loop-back → all green |
| B loop-back | implement-agent | yes | Cucumber harness: heartbeat default off, lazy intent resolver |
| C Verify | verifier-agent | yes | FAIL scope (manifest reconciled); tests PASS |
| D Review | code-reviewer | yes | VERDICT: PASS |

**ui_surface:** no

### RED evidence
- Test files changed: `wcp-desktop-agent.integration.test.ts`, `start-app.steps.ts`
- Command run: `npm test -w @finos/sail-desktop-agent`
- Failure summary: 5 new Option A WCP integration tests failed — instance stayed `pending` after WCP5; Cucumber collateral from removing manual CONNECTED forcing.
- Expected reason: Production never called `updateInstanceState(CONNECTED)` on WCP5 success.
- Unrelated tests: 292/297 Vitest pass at RED time.

### Commands run
- `npm test -w @finos/sail-desktop-agent`: **297 Vitest + 15 Cucumber scenarios pass** (exit 0)

### Files changed (19)
- **Production:** `wcp-handlers.ts` (WCP5→CONNECTED, gated heartbeat), `intent-helpers.ts` (PENDING/CONNECTED semantics + launch wait), intent raise/resolver helpers (CONNECTED delivery path), `app-handlers.ts`, `event-handlers.ts`
- **Tests:** 5 new WCP integration lifecycle tests; Cucumber `start-app.steps.ts` WCP4/WCP5 path; step-definition collateral updates; `test/world/index.ts` default `heartbeatEnabled: false`, lazy intent resolver

### Diff summary
Option A lifecycle: host pre-register stays `PENDING` until WCP5 sets `CONNECTED`. Heartbeat starts only when `heartbeatEnabled`. WCP6 and heartbeat timeout removal unchanged (now reachable). Cucumber harness aligned — no manual CONNECTED hacks; default world disables heartbeat timers.

### Learnings proposed
- **[AGENTS.md candidate]** Cucumber `initializeDesktopAgent()` defaults `heartbeatEnabled: false`; heartbeat scenarios opt in via `A desktop agent with heartbeat checking`.
- **[AGENTS.md candidate]** Do not wire `requestIntentResolution` on default Cucumber init; lazy-wire for cancel scenarios so resolver UI tests assert `appIntent` payload.
- **[AGENTS.md candidate]** BDD apps without app-directory entries may use direct CONNECTED; directory apps use production WCP4→WCP5.

## Escalation notes

_(empty)_

- 2026-06-18 human approve — committed and pushed by user on v3-pre

## Learnings extracted

- Cucumber `initializeDesktopAgent()` defaults `heartbeatEnabled: false`; heartbeat scenarios opt in via `A desktop agent with heartbeat checking`.
- Do not wire `requestIntentResolution` on default Cucumber init; lazy-wire for cancel scenarios so resolver UI tests assert `appIntent` payload.
- BDD apps without app-directory entries may use direct CONNECTED; directory apps use production WCP4→WCP5.
