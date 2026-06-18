---
title: "Wire WCP5 CONNECTED lifecycle and heartbeat policy"
slug: wire-wcp5-connected-instance-lifecycle
kind: task
type: feature
status: in-progress
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/wcp-handlers.ts
  - packages/sail-desktop-agent/src/core/state/mutators/instance.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/heartbeat-handlers.ts
  - packages/sail-desktop-agent/src/app-connection/__tests__/wcp-desktop-agent.integration.test.ts
  - packages/sail-desktop-agent/test/step-definitions/start-app.steps.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-helpers.ts
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

_(empty)_

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
