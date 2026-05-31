---
title: "Investigate launcher instanceId vs WCP5 canonical id"
slug: investigate-launcher-wcp-instance-id
kind: spike
type: bug
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/wcp-handlers.ts
  - packages/sail-desktop-agent/src/browser/wcp/wcp1-3-handshake.ts
  - packages/sail-conformance-harness/README.md
  - packages/sail-conformance-harness/src/app-launcher.ts
depends_on: []
integration_branch: v3-pre
branch: cursor/investigate-launcher-wcp-instance-id
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Document why AppLauncher.instanceId, iframe name, and WCP5 canonical instanceId diverge in harness/toolbox runs, and recommend the minimal fix contract for `bind-host-instance-id-at-wcp4`.

## User or system context

Largest toolbox failure cluster is AppTimeout / IntentDeliveryFailed from wrong instance routing. Cucumber fails `"uuid-0" sends validate` with "Did not find app instance uuid-0". Cross-origin conformance iframes cannot expose window.name to the host.

## Reference docs

- `plans/prd-toolbox-conformance-burn-down.md` (TB-04)
- `conformance-test-failure-review.md`
- `plans/work-items/conformance-harness-host.md`

## Parent context

From `plans/prd-toolbox-conformance-burn-down.md`: Spike before implementation; harness already sets iframe name=instanceId; WCP4 may mint unrelated UUID on first connect.

## Behavior spec

**Phase 1 — investigate**

Given the conformance harness opens an app via fdc3.open with AppLauncher returning instanceId X
When the app iframe completes WCP4/WCP5 handshake
Then logs correlate launcher X, iframe name, WCP5 instanceId, and findInstances() output

**Phase 2 — recommendation**

Given Phase 1 evidence
When the spike completes
Then `bind-host-instance-id-at-wcp4` work item has an updated behavior spec with chosen contract (pre-register, WCP4 payload, or agent change)

## Out of scope

- Implementing the fix (separate task `bind-host-instance-id-at-wcp4`)
- sail-web changes in this spike

## TypeScript interfaces

none

## Test guidance

Use harness debug logging (`logPayloadDetail: 'full'`) and optional Cucumber repro. Document findings in this work item `## Staged for review` or `## Blocked decisions`.

Deliverable via /ww-deliver: yes (spike; spawns or unblocks bind-host-instance-id-at-wcp4)

## Blocked decisions

_(empty — populate after Phase 1)_

## Loop history

- 2026-05-31: approved by human

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
