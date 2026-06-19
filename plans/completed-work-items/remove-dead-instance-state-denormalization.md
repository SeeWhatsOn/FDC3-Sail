---
title: "Remove dead instance state denormalization and unused lifecycle enums"
slug: remove-dead-instance-state-denormalization
kind: task
type: chore
status: done
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
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

- 2026-06-19 Phase A (test-engineer, registered subagent: yes): RED evidence captured — 7 Vitest failures, 3 Cucumber failures, compile-time contract failures. See ## RED evidence below.
- 2026-06-19 Human **approve** at staged gate; user will commit (automation tier `stage_only`).
- 2026-06-19 Marked **done** — user committing on `cursor/remove-dead-instance-state-denormalization`.

## Learnings extracted

- Intent listener discovery uses `state.intents.listeners` only — `getInstancesWithIntentListener` belongs in `selectors/intent.ts`, exported from `state/selectors.ts` but not `selectors/index.ts` (instance barrels stay denormalization-free).
- Option A disconnect: instances are absent (`getInstance` → `undefined`), not `TERMINATED` tombstones; use presence checks, not tombstone enum members.
- State-shape RED tests: follow `intents-shape.contract.test.ts` (runtime + compile-time contracts); for removed enum members use `Object.prototype.hasOwnProperty.call(Enum, "REMOVED")` or string literals — never reference deleted enum values in tests.

## RED evidence
- Test files changed: packages/sail-desktop-agent/src/core/state/__tests__/instance-state-hardening.contract.test.ts, packages/sail-desktop-agent/src/core/handlers/dacp/__tests__/instance-state-hardening.test.ts, packages/sail-desktop-agent/test/features/infrastructure/instance-state-hardening.feature, packages/sail-desktop-agent/test/step-definitions/instance-state.steps.ts
- Command run: npx vitest run --project @finos/sail-desktop-agent packages/sail-desktop-agent/src/core/state/__tests__/instance-state-hardening.contract.test.ts packages/sail-desktop-agent/src/core/handlers/dacp/__tests__/instance-state-hardening.test.ts; cd packages/sail-desktop-agent && npx cucumber-js --profile single test/features/infrastructure/instance-state-hardening.feature
- Failure summary: Production still has intentListeners on AppInstance, tombstone enum values (NOT_RESPONDING, DISCONNECTING, TERMINATED), denormalized mutators/selectors, and TERMINATED checks instead of getInstance null checks.
- Expected reason: Failures are correct RED until field/enum removed and checks migrated.
- Unrelated tests: healthy (intent-discovery-metadata 9/9 pass)

## Staged for review

**Branch:** `cursor/remove-dead-instance-state-denormalization` (from `v3-pre`)  
**Automation tier:** `stage_only` — **approved**; user commits manually

### Phase audit

| Phase | Subagent | Registered subagent | ui_surface | Result |
|-------|----------|---------------------|------------|--------|
| A RED | test-engineer | yes | n/a | 7 Vitest + 3 Cucumber failures (expected RED) |
| B GREEN | implement-agent | yes | no | 288 Vitest + 15 Cucumber pass |
| A′ test fix | test-engineer | yes | n/a | Fixed enum compile-time test guards after verifier FAIL |
| C Verify | verifier-agent | yes | n/a | VERIFICATION: PASS |
| D Review | code-reviewer | yes | no | VERDICT: PASS |

### Commands run

- `npx vitest run --project @finos/sail-desktop-agent` (288 tests pass)
- `npm test -w @finos/sail-desktop-agent` (288 Vitest + 15 Cucumber scenarios pass)
- `npx cucumber-js --profile single test/features/infrastructure/instance-state-hardening.feature` (3 scenarios pass)

### Files changed (staged)

**Production:** `types.ts`, `mutators/instance.ts`, `mutators/index.ts`, `selectors/instance.ts`, `selectors/intent.ts`, `selectors/index.ts`, `selectors.ts` (new), `intent-raise-shared.ts`, `intent-resolver-helpers.ts`, `intent-helpers.ts`, `intent-raise-intent.ts`

**Tests:** `instance-state-hardening.contract.test.ts`, `instance-state-hardening.test.ts`, `instance-state-hardening.feature`, `instance-state.steps.ts`

### Diff summary

- Removed `AppInstance.intentListeners` and denormalized mutators/selectors
- Trimmed `AppInstanceState` to `PENDING` | `CONNECTED` only
- Moved `getInstancesWithIntentListener` to registry-backed intent selector (exported via `selectors.ts`, not `selectors/index`)
- Migrated `TERMINATED` presence checks to `getInstance` null semantics across intent handlers

### Scope expansion (acknowledged)

Files outside original `file_manifest` required for GREEN: `selectors/intent.ts`, `selectors/index.ts`, `selectors.ts`, `intent-helpers.ts`, `intent-raise-intent.ts`

### Review follow-ups (non-blocking)

- Stale TSDoc in `intent-resolver-helpers.ts` still says "not terminated" — consider updating to "present in state.instances"

### Learnings proposed

- Intent listener discovery uses `state.intents.listeners` only; `getInstancesWithIntentListener` lives in `selectors/intent.ts`, exported from `selectors.ts` but omitted from `selectors/index`
- Option A disconnect: instances are absent (`getInstance` → undefined), not `TERMINATED` tombstones
- For string-enum contract tests, use `${Enum}` template-literal unions and `hasOwnProperty.call(Enum, "REMOVED")` — never reference removed enum members
- Follow `intents-shape.contract.test.ts` pattern for state-shape RED tests

## Escalation notes

_(empty)_
