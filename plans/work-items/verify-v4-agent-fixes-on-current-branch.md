---
title: "Verify v4 agent fixes on current branch and re-run guidance"
slug: verify-v4-agent-fixes-on-current-branch
kind: task
type: chore
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - conformance-test-failure-review.md
depends_on: []
integration_branch: v3-pre
branch: cursor/verify-v4-agent-fixes-on-current-branch
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Confirm whether v4 `desktopAgent` and intent discovery failures reflect stale export vs remaining code gaps on current `v3-pre`, and record re-run steps for the harness toolbox.

## User or system context

TB-01/TB-02 merged but v4 export still shows those rows. Maintainers need a short verification note before duplicating fix work.

## Reference docs

- `plans/prd-toolbox-conformance-v4-follow-up.md` (TV4-07)
- `plans/completed-work-items/fix-app-metadata-desktop-agent-field.md`
- `plans/completed-work-items/fix-intent-discovery-displayname-dedupe.md`
- `packages/sail-desktop-agent/src/core/handlers/dacp/app-handlers.ts`

## Parent context

Pairs with `record-toolbox-v4-measured-baseline`. If code already correct, unblock dedupe/noappsfound items only; if not, file regression against merged PRs.

## Behavior spec

Given current v3-pre includes merged PRs for desktopAgent and displayName
When reviewing app-handlers and intent-helpers against v4 failure symptoms
Then document in conformance-test-failure-review.md whether each symptom is stale export, harness path gap, or open code bug
And list exact npm commands to re-run toolbox at :3001 after next agent delivery batch

## Out of scope

- Mandatory automated toolbox run in CI
- Fixing bugs found (owned by sibling work items)

## TypeScript interfaces

none

## Test guidance

Docs-only: no executable RED phase. Optional: run `npm test -w @finos/sail-desktop-agent` and cite Vitest/Cucumber green for metadata assertions added in TB-06.

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
