---
title: "Fix findIntent oracle and raiseIntent throws (TV5-03–05)"
slug: fix-findintent-raise-intent-oracle
kind: task
type: bug
status: blocked
loop_count: 0
loop_limit: 3
last_agent: backlog-grooming
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-helpers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-discovery-handlers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-raise-intent.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-raise-shared.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/__tests__/
  - packages/sail-desktop-agent/test/features/intents/find-intent.feature
depends_on:
  - fix-harness-finOs-session-teardown
integration_branch: v3-pre
branch: cursor/fix-findintent-raise-intent-oracle
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Align `findIntent` / `findIntentsByContext` app lists and `raiseIntent` rejection messages with FINOS toolbox oracles after harness session hygiene is trustworthy (TV5-03–05).

## User or system context

v5 `findIntent` failures (`apps.length` 4 vs 1) may be stale-instance inflation until TV5-01 manual v6 confirms teardown. Even with clean sessions, FDC3 2.2 materials disagree on whether directory + running listener should produce one or two `AppMetadata` rows per `appId`. Wrong-context `findIntent` must reject `NoAppsFound` instead of success + `assert.fail()`. raiseIntent throws rows need matrix-aligned messages (`NoAppsFound`, `IntentDeliveryFailed`, `TargetAppUnavailable`).

**Merged from (2026-06-21 grooming):** `dedupe-findintent-directory-running-apps`, `fix-findintent-empty-apps-noappsfound`, `align-raise-intent-throws-v4-matrix`.

## Reference docs

- `plans/prd-toolbox-conformance-v5-follow-up.md` (TV5-03–05)
- `conformance-appd.json`, `conformance-report-v5.txt`
- `plans/project-docs.md` (TB-02, `fdc3-error-enum-boundary-tests` delivered)

## Parent context

Child of `epic-toolbox-conformance-v5-follow-up`. Deliver in order: (1) apps[] merge policy once FINOS clarifies, (2) NoAppsFound for wrong context, (3) raiseIntent throws matrix. Do not implement dedupe before TV5-01 v6 export proves failures are not stale-state noise.

## Behavior spec

### TV5-03 — apps[] merge policy

Given intent-a is listed in the app directory for aTestingIntent with context testContextX
And a running intent-a instance has registered a listener for that intent
When a connected app calls findIntent for aTestingIntent with context testContextX
Then `appIntent.apps` length matches the FINOS-normative oracle (spec clarification required)

Given two directory apps handle sharedTestingIntent2
When findIntentsByContext is called for a context only one intent should expose
Then the response `appIntents` array length matches the toolbox oracle for that context

### TV5-04 — NoAppsFound for wrong context

Given aTestingIntent exists in the directory for testContextX
When findIntent is called with aTestingIntent and a context type no app accepts
Then the DACP response is an error with errorType NoAppsFound
And the FDC3 client rejection message is NoAppsFound

### TV5-05 — raiseIntent throws matrix

Given raiseIntent targets intent-a with context and intent that do not correlate per conformance matrix
When the raise is rejected before delivery
Then the promise rejects with message NoAppsFound (per scenario table)

Given a targeted app instance that cannot handle the intent
When raiseIntent fails at resolve time
Then the rejection message matches the toolbox expectation for that scenario

## Out of scope

- displayName mapping (TB-02 delivered)
- Harness close-context handshake (TV5-01)
- UserCancelledResolution on successful resolve paths

## TypeScript interfaces

Uses existing `AppIntent` shapes and `createAppIntents` in `intent-helpers.ts`.

## Test guidance

RED per slice: Vitest tables in `intent-handlers/__tests__/` with `conformance-appd.json` fixtures; extend Cucumber `@conformance2.2` find-intent and throws scenarios. Run after TV5-01 manual v6 attributes remaining findIntent rows to agent logic.

## Blocked decisions

**2026-06-10 — FDC3 spec vs conformance oracle for `findIntent` `apps[]` shape**

- **Question:** When an app is in the App Directory and has a running intent listener, should `findIntent` return one `AppMetadata`, or both a no-`instanceId` row (launch) and an `instanceId` row (use existing) for the same `appId`?
- **Why blocked:** API reference (`StartChat` example) and conformance/toolbox (`FindIntentAppD`, `apps.length === 1`) do not clearly agree. Sail BDD expects directory + instance rows in multi-app cases.
- **Outreach:** Kris West and Rob Moffat (FINOS FDC3) — reconcile Intents-Tests "only A `AppMetadata`" with the `StartChat` duplicate-`appId` example.
- **Also blocked on:** TV5-01 manual v6 re-run to separate stale-instance inflation from true oracle gaps.

## Loop history

- 2026-06-10: blocked — FINOS `findIntent` apps[] clarification (from `dedupe-findintent-directory-running-apps`).
- 2026-06-21: merged TV5-03–05 into single work item during backlog grooming.

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
