---
title: "Bind host-assigned instanceId at WCP4 as canonical WCP5 id"
slug: bind-host-instance-id-at-wcp4
kind: task
type: bug
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
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

_(Updated from `investigate-launcher-wcp-instance-id` spike — 2026-05-31)_

**Contract: pre-register at open + adopt claimed id at WCP4 first connect**

Given AppLauncher.launch returns { appId, instanceId: "uuid-0" }
When openRequest completes successfully
Then agent state pre-registers instance "uuid-0" for appId (pending WCP validation, not yet heartbeating)

Given a pre-registered host instance "uuid-0"
And the host renders iframe name="uuid-0"
When the app sends WCP4 with instanceId "uuid-0" and matching app directory identity
Then WCP5 responds with instanceId "uuid-0" (no unrelated UUID from createAppInstance)
And findInstances() for that app includes "uuid-0"

Given open-with-context pending for uuid-0
When the target app adds a context listener on uuid-0
Then launch context is delivered without AppTimeout

**Reconnect path (unchanged):** When instance already live, `canReuseInstanceIdentity` continues to gate reuse on instanceUuid, origin, and sourceWindow.

**Out of scope for this item:** cross-origin iframe name / fdc3.finos.org proxy (separate if toolbox still cannot claim host id).

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

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
