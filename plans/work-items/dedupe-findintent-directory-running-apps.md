---
title: "Dedupe findIntent apps when directory and running instance overlap"
slug: dedupe-findintent-directory-running-apps
kind: task
type: bug
status: blocked
loop_count: 0
loop_limit: 3
last_agent: top-level-approval-workflow
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-helpers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-discovery-handlers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/__tests__/
depends_on: []
integration_branch: v3-pre
branch: cursor/dedupe-findintent-directory-running-apps
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Make `findIntent` and `findIntentsByContext` return a single app entry per `appId` when both directory metadata and a running listener exist, matching FINOS toolbox `AppIntent.apps.length` expectations.

## User or system context

v4 reports `FindIntentAppD` and `FindIntentByContextSingleContext` with length 2 vs 1. TB-02 fixed displayName and intent-list dedupe but `createAppIntents` still appends directory row plus instance row for the same app.

## Reference docs

- `plans/prd-toolbox-conformance-v5-follow-up.md` (TV5-03)
- `conformance-appd.json`
- `plans/project-docs.md` (TB-02 delivered)

## Parent context

v4 `FindIntentAppD` fails with `apps.length` 2 vs 1 when `createAppIntents` emits both a directory row (no `instanceId`) and a running listener row (with `instanceId`) for the same `appId`. **Blocked pending FINOS clarification:** FDC3 2.2 materials appear inconsistent — [DesktopAgent#findIntent `StartChat` example](https://fdc3.finos.org/docs/api/ref/DesktopAgent#findintent) illustrates duplicate `appId` rows (launch + existing instance), while [Intents-Tests `2.0-FindIntentAppD`](https://fdc3.finos.org/docs/api/conformance/Intents-Tests) says "only A `AppMetadata`" and the toolbox enforces `apps.length === 1`. Sail BDD (`find-intent.feature` "include both the app and running instances") expects directory + instance rows in multi-app cases. A naive same-`appId` dedupe may be the wrong fix; merge policy needs a spec-backed rule (single-app-running vs multi-app chooser) before delivery.

## Behavior spec

Given intent-a is listed in the app directory for aTestingIntent with context testContextX
And a running intent-a instance has registered a listener for that intent
When a connected app calls findIntent for aTestingIntent with context testContextX
Then appIntent.apps has length 1
And the entry includes instanceId when the instance is connected

Given two directory apps handle sharedTestingIntent2
When findIntentsByContext is called for a context only one intent should expose
Then the response appIntents array length matches the toolbox oracle for that context (no duplicate AppIntent for the same intent name)

## Out of scope

- displayName mapping (already delivered in TB-02)
- WCP delivery timeouts
- raiseIntent resolver UI

## TypeScript interfaces

Uses existing `AppIntent` / directory listener shapes from `@finos/fdc3` and `createAppIntents` return type in `intent-helpers.ts`.

## Test guidance

RED: Vitest table in `intent-handlers/__tests__/` loading `conformance-appd.json` fixture slice for intent-a; assert `apps.length === 1` with running listener registered in test state. Extend Cucumber `find-intent.feature` with toolbox `apps.length` assertion when one app is running.

## Blocked decisions

**2026-06-10 — FDC3 spec vs conformance oracle for `findIntent` `apps[]` shape**

- **Question:** When an app is in the App Directory and has a running intent listener, should `findIntent` return one `AppMetadata`, or both a no-`instanceId` row (launch) and an `instanceId` row (use existing) for the same `appId`?
- **Why blocked:** API reference (`StartChat` example) and conformance/toolbox (`FindIntentAppD`, `apps.length === 1`) do not clearly agree for the single-app-already-running case. Implementing dedupe now risks fixing the toolbox while contradicting the documented API example and Sail multi-app BDD.
- **Outreach:** Reach out to **Kris West** and **Rob Moffat** (FINOS FDC3) for normative guidance — clarify whether conformance text "only A `AppMetadata`" means exactly one array entry or only app A (no B/C/D), and how that reconciles with the `StartChat` duplicate-`appId` example.
- **References to share:**
  - Call: `fdc3.findIntent("aTestingIntent")` ([Intents-Tests](https://fdc3.finos.org/docs/api/conformance/Intents-Tests))
  - API example: `findIntent("StartChat")` with Symphony listed twice ([DesktopAgent#findIntent](https://fdc3.finos.org/docs/api/ref/DesktopAgent#findintent))
  - Sail failure: `conformance-report-v4.txt` — `Unexpected AppIntent.apps.length. Expected 1, got 2`
  - Sail code: `createAppIntents` in `intent-helpers.ts` (directory pass + running listener pass)

## Loop history

- 2026-06-10: blocked — pending FINOS clarification (Kris West, Rob Moffat) on spec vs conformance for `findIntent` apps merge policy.

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
