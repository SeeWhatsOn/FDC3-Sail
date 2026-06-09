---
title: "Emit NoAppsFound when findIntent matches intent but zero apps"
slug: fix-findintent-empty-apps-noappsfound
kind: task
type: bug
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-discovery-handlers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-helpers.ts
  - packages/sail-desktop-agent/test/features/intents/find-intent.feature
depends_on:
  - dedupe-findintent-directory-running-apps
integration_branch: v3-pre
branch: cursor/fix-findintent-empty-apps-noappsfound
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Return `ResolveError.NoAppsFound` (client `message: "NoAppsFound"`) when an intent exists in the directory but no app handles the requested context, instead of a success response that makes the toolbox assert `assert.fail()`.

## User or system context

v4 `FindIntentAppDWrongContext` expects rejection `NoAppsFound`. `handleFindIntentRequest` only checks `appIntents.length === 0`, not `appIntents[0].apps.length === 0`.

## Reference docs

- `plans/prd-toolbox-conformance-v4-follow-up.md` (TV4-02)
- `plans/completed-work-items/fdc3-error-enum-boundary-tests.md`

## Parent context

Align findIntent empty-handler path with findIntentsByContext and raiseIntent error propagation. Depends on dedupe so empty-app detection is unambiguous.

## Behavior spec

Given aTestingIntent exists in the directory for testContextX
When findIntent is called with aTestingIntent and context type that no app accepts
Then the DACP response is an error with errorType NoAppsFound
And the FDC3 client rejection message is NoAppsFound

Given findIntentsByContext returns zero apps after filtering
When the handler would previously return success with empty app lists
Then the client receives NoAppsFound consistently

## Out of scope

- raiseIntent throws matrix (separate item)
- MalformedContext paths (already covered)

## TypeScript interfaces

none

## Test guidance

RED: Vitest for `handleFindIntentRequest` wrong-context payload; Cucumber `@conformance2.2` scenario mirroring `FindIntentAppDWrongContext` with `conformance-appd.json` apps.

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
