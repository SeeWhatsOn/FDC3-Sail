---
title: "Map intent displayName from directory and dedupe findIntentsByContext"
slug: fix-intent-discovery-displayname-dedupe
kind: task
type: bug
status: done
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-helpers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/
depends_on: []
integration_branch: v3-pre
branch: cursor/fix-intent-discovery-displayname-dedupe
pr_url: https://github.com/SeeWhatsOn/FDC3-Sail/pull/47
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Fix findIntent / findIntentsByContext responses so displayName comes from app directory definitions and appIntent lists match conformance expectations (no duplicate entries).

## User or system context

All toolbox findIntent scenarios fail deep-equal because `createAppIntents` uses `displayName: intentName` instead of directory values like `"A Testing Intent"` in `conformance-appd.json`. findIntentsByContext returns wrong counts (v2: 7 vs 6; v3: 3 vs 1).

## Reference docs

- `plans/prd-toolbox-conformance-burn-down.md` (TB-02)
- `conformance-appd.json`
- `packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-helpers.ts`

## Parent context

From `plans/prd-toolbox-conformance-burn-down.md`: Agent library fix in intent-helpers; Cucumber passes today because test apps use displayName equal to intent name.

## Behavior spec

Given intent-a in conformance-appd declares displayName "A Testing Intent" for aTestingIntent
When findIntent is called for aTestingIntent
Then appIntent.intent.displayName is "A Testing Intent"

Given multiple apps listen for the same context type
When findIntentsByContext is called for that context
Then each intent appears once per conformance rules (no duplicate appIntent from directory plus running listener double-count)

## Out of scope

- Intent resolver UI / harness tie-break logic
- Changing conformance-appd.json

## TypeScript interfaces

none

## Test guidance

RED: Vitest table in `dacp/__tests__` with explicit displayName from fixture, or extend find-intent.feature with directory displayName distinct from name. Pair with `toolbox-bdd-metadata-assertions`.

## Blocked decisions

_(empty)_

## Loop history

- 2026-05-31: approved by human

## Staged for review

- RED: `intent-discovery-metadata.test.ts` (6 tests)
- GREEN: `intent-helpers.ts` — directory displayName + dedupe
- Tests: `npx vitest run .../intent-discovery-metadata.test.ts` — 6 passed
- Review: VERDICT PASS

## Phase audit

| Phase | Subagent | Registered | Result |
| A | test-engineer | yes | RED |
| B | implement-agent | yes | GREEN |
| D | code-reviewer | yes | PASS |

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
- 2026-06-01: reconcile — PR merged (batch 1)
