---
title: "Remove dead instance state denormalization and unused lifecycle enums"
slug: remove-dead-instance-state-denormalization
kind: task
type: chore
status: draft
loop_count: 0
loop_limit: 3
last_agent: spec-planner
file_manifest:
  - packages/sail-desktop-agent/src/core/state/types.ts
  - packages/sail-desktop-agent/src/core/state/mutators/instance.ts
  - packages/sail-desktop-agent/src/core/state/mutators/index.ts
  - packages/sail-desktop-agent/src/core/state/selectors/instance.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-raise-shared.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-resolver-helpers.ts
depends_on:
  - wire-wcp5-connected-instance-lifecycle
integration_branch: v3-pre
branch: cursor/remove-dead-instance-state-denormalization
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - api
  - fdc3
---

## Goal

Remove `AppInstance.intentListeners` and unused `AppInstanceState` enum values; migrate any `TERMINATED` presence checks to `getInstance` null checks.

## User or system context

Intent listeners are authoritative in `state.intents.listeners` only. Unused enum states and dead arrays create drift and confuse lifecycle semantics after Option A lands.

## Reference docs

- `plans/prd-desktop-agent-state-hardening.md` (PRD-04e–f)

## Parent context

Runs after CONNECTED is wired so selectors can distinguish `PENDING` vs `CONNECTED` meaningfully.

## Behavior spec

Scenario: Intent listener discovery uses global registry only
  Given an app registers an intent listener via DACP
  When intent discovery runs for that intent name
  Then matching listeners are found from the intents listener registry keyed by instance id

Scenario: Instance records do not carry intent listener name arrays
  Given agent state after intent listener registration
  When inspecting an app instance record
  Then the instance does not contain a separate intent listener name list field

Scenario: Disconnected instances are absent not terminated
  Given a connected instance that disconnects
  When querying instance presence
  Then the instance id is not found rather than reported as a terminated state enum

## Out of scope

- Temp id resolver (separate child)
- Changing intent listener DACP protocol

## TypeScript interfaces

Remove from `AppInstance`:

```typescript
intentListeners: string[]
```

Remove from `AppInstanceState` enum (if no remaining references):

```typescript
NOT_RESPONDING, DISCONNECTING, TERMINATED
```

Remove mutators: `addIntentListener`, `removeIntentListener` on instance.

## Test guidance

RED: compile-time/type tests may fail when field removed — update fixtures. Run intent discovery tests and Cucumber intent scenarios. Grep for `TERMINATED` and `intentListeners` until zero production references.

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
