---
title: "Consolidate temp to canonical instance id resolver"
slug: consolidate-temp-instance-id-resolver
kind: task
type: chore
status: done
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
file_manifest:
  - packages/sail-desktop-agent/src/core/instance-id-resolver.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/heartbeat-runtime.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/cleanup.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/wcp-handlers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/utils/resolve-context-listener-instance-id.ts
  - packages/sail-desktop-agent/src/app-connection/wcp-connector.ts
  - packages/sail-desktop-agent/src/app-connection/wcp/wcp-connection-management.ts
  - packages/sail-desktop-agent/test/support/mock-transport.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/__tests__/cleanup.test.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/utils/__tests__/resolve-context-listener-instance-id.test.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/heartbeat-handlers.ts
  - packages/sail-desktop-agent/test/step-definitions/generic.steps.ts
  - packages/sail-desktop-agent/test/features/channels/private-channel.feature
  - packages/sail-desktop-agent/test/features/intents/raise-intent.feature
  - packages/sail-desktop-agent/test/features/intents/raise-intent-with-context.feature
  - packages/sail-desktop-agent/src/__tests__/import-path-smoke.test.ts
  - AGENTS.md
  - .cursor/skills/consume-sail-desktop-agent/SKILL.md
  - packages/sail-desktop-agent/src/app-connection/__tests__/wcp-desktop-agent.integration.test.ts
depends_on:
  - wire-wcp5-connected-instance-lifecycle
integration_branch: v3-pre
branch: v3-pre
pr_url: ""
merged_pr: "88753b7d6"
external_tracker: ""
tags:
  - api
  - fdc3
  - wcp
---

## Goal

Replace scattered temp→canonical instance id logic with one documented resolver contract used by WCP connector (browser), DA cleanup, and DACP routing — without breaking remote-DA or MockTransport test paths.

## User or system context

WCP4 routes under `temp-{connectionAttemptUuid}`; WCP5 assigns canonical `instanceId`. Today multiple modules maintain parallel maps, increasing disconnect and adoption bug risk.

## Reference docs

- `plans/prd-desktop-agent-state-hardening.md` (PRD-04d)
- ARCH REVIEW PASS: single contract, browser + DA bindings
- `AGENTS.md` WCP4 temp vs WCP5 canonical ids

## Parent context

Depends on lifecycle slice so canonical ids and `CONNECTED` are stable before refactoring identity maps.

## Behavior spec

Scenario: Cleanup resolves temp id to canonical instance
  Given an app validated WCP5 under a temp connection id with heartbeat started
  When disconnect cleanup runs using the temp connection id as handler context
  Then cleanup targets the canonical instance id and removes that instance's state

Scenario: Browser connector migrates routing keys on WCP5
  Given a WCP connection established with a temp instance id
  When WCP5 success is sent with the canonical instance id
  Then subsequent DACP messages route using the canonical id

Scenario: MockTransport tests register temp to canonical mapping
  Given a Cucumber scenario using WCP4 validate with a temp connection id
  When WCP5 assigns a canonical instance id
  Then test harness mapping resolves temp ids the same way as production

## Out of scope

- Changing FDC3 WCP message shapes
- FIFO message queue
- Lifecycle enum work (prerequisite child)

## TypeScript interfaces

Introduce a small module or transport contract, e.g.:

```typescript
/** Resolve WCP4 temp connection id to canonical WCP5 instance id, if linked. */
function resolveCanonicalInstanceId(routingId: string): string | undefined
function linkTempToCanonical(tempId: string, canonicalId: string): void
function unlinkCanonical(canonicalId: string): void
```

Browser preset wires connector map; DA wires heartbeat link at WCP5.

## Test guidance

RED: add failing tests in `cleanup.test.ts` and `wcp-desktop-agent.integration.test.ts` that fail if temp id cleanup misses canonical instance. Preserve `MockTransport.registerWcp5Mapping` behavior via the shared contract. Run existing WCP host adoption tests.

## Blocked decisions

_(empty)_

- 2026-06-18 Phase B GREEN (implement-agent, registered: yes): instance-id-resolver.ts; link at WCP5 even heartbeat off
- 2026-06-18 Phase C Verify (verifier-agent, registered: yes): VERIFICATION: PASS
- 2026-06-18 Phase D Review (code-reviewer, registered: yes): VERDICT: PASS
- 2026-06-18 staged for human review

## Staged for review

**Status:** waiting_on_user (staged 2026-06-18)

### Phase audit
| Phase | Subagent | Registered | Result |
|-------|----------|------------|--------|
| A RED | test-engineer | yes | 5 tests fail (expected) |
| B GREEN | implement-agent | yes | 284 Vitest + 15 Cucumber pass |
| C Verify | verifier-agent | yes | VERIFICATION: PASS |
| D Review | code-reviewer | yes | VERDICT: PASS |

**ui_surface:** no

### RED evidence
- 5 new tests: 3 contract + 2 behavioral (temp cleanup/disconnect misses canonical when heartbeat off)

### Commands run
- `npm test -w @finos/sail-desktop-agent`: **284 Vitest + 15 Cucumber pass** (exit 0)

### Diff summary
- **New:** `instance-id-resolver.ts` — `linkTempToCanonical`, `resolveCanonicalInstanceId`, `unlinkCanonical`
- **WCP5:** links temp→canonical in `wcp-handlers.ts` always (not only when heartbeat starts)
- **Cleanup:** `resolveCleanupInstanceId` uses resolver + `state.instances[canonicalId]`
- **Connector:** `wcp-connection-management.ts`, `wcp-connector.ts` migrated
- **MockTransport:** `registerWcp5Mapping` delegates to shared resolver
- **No shims:** removed `@deprecated` `linkWcpTempInstanceId` / `resolveWcpTempInstanceId` and `resolveContextListenerInstanceId` alias; Cucumber `App1/a1` legacy app id format; stale backward-compat wording in tests/comments/skills
- **Feature files:** five scenarios updated to explicit `appId: …, instanceId: …` after legacy slash parsing removal (private-channel, raise-intent, raise-intent-with-context)

### Learnings proposed
- **[AGENTS.md candidate]** WCP5 temp→canonical mapping in `instance-id-resolver.ts`; link at WCP5 success always; cleanup/disconnect resolve via resolver, not heartbeat presence alone.

## Escalation notes

_(empty)_

## Learnings extracted

- WCP5 links handshake routing id → `instanceId` at validation success (not only when heartbeat starts); cleanup/disconnect must resolve via that map.

## Loop history

- 2026-06-18 staged for human review (waiting_on_user)
- 2026-06-19 Marked **done** — committed on `v3-pre` as `88753b7d6` (stacked with `move-wcp-temp-id-alias-to-agent-state`)
