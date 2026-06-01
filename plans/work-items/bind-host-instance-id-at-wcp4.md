---
title: "Bind host-assigned instanceId at WCP4 as canonical WCP5 id"
slug: bind-host-instance-id-at-wcp4
kind: task
type: bug
status: pr_awaiting
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/wcp-handlers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/utils/open-with-context.ts
  - packages/sail-conformance-harness/src/app-launcher.ts
  - packages/sail-desktop-agent/src/browser/wcp/wcp-connector.ts
depends_on:
  - investigate-launcher-wcp-instance-id
integration_branch: v3-pre
branch: cursor/bind-host-instance-id-at-wcp4
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

When AppLauncher returns an instanceId and the host sets iframe name to match, WCP5 must use that id as the canonical instance (no unrelated UUID on first connect).

## User or system context

Open-with-context registers pending delivery on launcher instanceId; WCP4 createAppInstance may issue a new UUID unless reconnect reuse succeeds. This causes toolbox AppTimeout on channels, open-with-context, and raiseIntent delivery.

## Reference docs

- `plans/prd-toolbox-conformance-burn-down.md` (TB-04b)
- `plans/work-items/investigate-launcher-wcp-instance-id.md` (spike outcome)
- `AGENTS.md` (WCP4 temp vs WCP5 canonical ids)

## Parent context

From `plans/prd-toolbox-conformance-burn-down.md`: Core integration fix; unblocks Cucumber uuid-0 path, bdd-wcp-integration-scenario, and harness toolbox re-run.

## Behavior spec

Given AppLauncher.launch returns { appId, instanceId: "uuid-0" }
And the host renders iframe name="uuid-0"
When the app completes WCP identity validation
Then agent state registers instanceId uuid-0 and routes DACP to that id

Given open-with-context pending for uuid-0
When the target app adds a context listener on uuid-0
Then launch context is delivered without AppTimeout

## Out of scope

- Same-origin proxy of fdc3.finos.org (unless spike mandates)
- sail-platform-api SailAppLauncher (separate workload if sail-web needs same contract)

## TypeScript interfaces

none

## Test guidance

Implement per spike recommendation. Verify with harness open-with-context toolbox slice and Cucumber launch+validate. May require Vitest in wcp-handlers or browser integration test.

## Blocked decisions

Depends on spike outcome from `investigate-launcher-wcp-instance-id`.

## Loop history

- 2026-05-31: approved by human
- 2026-05-31: RED — 4 Vitest tests in `wcp-host-instance-id.test.ts` fail (openRequest no pre-register, findInstances empty, WCP5 mints random UUID vs uuid-0, open-with-context missing host instance)
- 2026-05-31: Review FAIL — wcpSourceWindow not set in production connector; loop-back fix committed

## RED evidence

- Test files changed: `packages/sail-desktop-agent/src/core/handlers/dacp/__tests__/wcp-host-instance-id.test.ts`
- Command run: `npx vitest run src/core/handlers/dacp/__tests__/wcp-host-instance-id.test.ts` (from `@finos/sail-desktop-agent`)
- Failure summary: All 4 tests fail. `handleOpenRequest` does not register launcher `uuid-0` in agent state, so `findInstances` returns `[]`. With a pending host instance pre-seeded, WCP4 still returns WCP5 `instanceId` `470c8458-…` instead of `uuid-0`. Open-with-context cannot bind delivery to the host id because the instance never exists after launch.
- Expected reason: Production `createAppInstance` always mints `crypto.randomUUID()` on first connect; reconnect reuse requires an identity record. Host-assigned ids from `AppLauncher.launch()` are not adopted at WCP4 yet.
- Unrelated tests: healthy (targeted file only; full suite not re-run)

## Staged for review

- RED: `wcp-host-instance-id.test.ts` (4 tests)
- GREEN: `app-handlers.ts` pre-register on open; `wcp-handlers.ts` adopt pending host id at WCP4; `wcp-connector.ts` sets `wcpSourceWindow` from WCP1 source on WCP4
- Tests: vitest wcp-host (4 pass), wcp-connector wcpSourceWindow, desktop-agent-wcp-routing (10 pass)
- Review loop 1: FAIL (missing connector wcpSourceWindow) → fixed → PASS

## Phase audit

| Phase | Subagent | Registered | Result |
| A | test-engineer | yes | RED |
| B | implement-agent | yes | GREEN |
| B′ | implement-agent | yes | Loop-back: wcp-connector wcpSourceWindow |
| D | code-reviewer | yes | PASS |

## Escalation notes

_(empty)_

## Learnings extracted

- [AGENTS.md candidate] Host bind: `openRequest` pre-registers launcher id as PENDING; WCP4 adoption needs `meta.wcpSourceWindow` from `WCPConnector.enrichMessageWithSource` (WCP1 `event.source`), not only test-injected meta.
