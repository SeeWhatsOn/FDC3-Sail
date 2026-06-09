---
title: "Dedupe findIntent apps when directory and running instance overlap"
slug: dedupe-findintent-directory-running-apps
kind: task
type: bug
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
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

- `plans/prd-toolbox-conformance-v4-follow-up.md` (TV4-01)
- `conformance-appd.json`
- `plans/completed-work-items/fix-intent-discovery-displayname-dedupe.md`

## Parent context

FDC3 conformance expects one `AppMetadata` per logical app in `AppIntent.apps` unless multiple distinct instances are intended. Prefer the running instance row (with `instanceId`) over the directory-only row when `appId` matches.

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

_(empty)_

## Loop history

_(empty)_

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
