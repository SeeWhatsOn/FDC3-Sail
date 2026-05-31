---
title: "Fix Cucumber raise-intent launch uuid-0 correlation"
slug: fix-cucumber-raise-intent-launch-correlation
kind: task
type: bug
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/test/features/intents/raise-intent.feature
  - packages/sail-desktop-agent/test/step-definitions/start-app.steps.ts
  - packages/sail-desktop-agent/test/support/mock-transport.ts
depends_on:
  - bind-host-instance-id-at-wcp4
integration_branch: v3-pre
branch: cursor/fix-cucumber-raise-intent-launch-correlation
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Green the failing @conformance2.2 raise-intent scenarios where "uuid-0" sends validate fails with "Did not find app instance uuid-0".

## User or system context

Cucumber currently reports 3 failures in raise-intent @conformance2.2 slice — same class of bug as toolbox AppTimeout / IntentDeliveryFailed on launch-via-raiseIntent paths.

## Reference docs

- `plans/prd-toolbox-conformance-burn-down.md` (TB-05)
- `packages/sail-desktop-agent/test/features/intents/raise-intent.feature`

## Parent context

From `plans/prd-toolbox-conformance-burn-down.md`: Automated regression for launch instance correlation after WCP/product fix from bind-host-instance-id-at-wcp4.

## Behavior spec

Given App1 raises an intent that auto-launches portfolioApp
When the open response returns instanceId uuid-0
And uuid-0 sends WCP validate
Then the agent recognizes uuid-0 and intent delivery completes

## Out of scope

- Full toolbox automation in CI
- Rewriting unrelated intent scenarios

## TypeScript interfaces

none

## Test guidance

Run `npx cucumber-js test/features/intents/raise-intent.feature --tags "@conformance2.2"`. If product fix alone greens scenarios, limit test changes to assertions; if MockTransport still needs canonical id registration, align with `mockTransport.lastWcp5ValidatedInstanceId` pattern from align-wcp-instance-id-in-tests.

## Blocked decisions

_(empty)_

## Loop history

- 2026-05-31: approved by human

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
