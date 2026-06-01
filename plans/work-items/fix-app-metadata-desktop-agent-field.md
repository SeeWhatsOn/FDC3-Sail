---
title: "Always set desktopAgent on getAppMetadata responses"
slug: fix-app-metadata-desktop-agent-field
kind: task
type: bug
status: pr_awaiting
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/app-handlers.ts
  - packages/sail-desktop-agent/test/features/apps/apps.feature
depends_on: []
integration_branch: v3-pre
branch: cursor/fix-app-metadata-desktop-agent-field
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Ensure every `getAppMetadata` `AppMetadata` object includes `desktopAgent` (implementation provider), including directory-only lookups.

## User or system context

FINOS toolbox `fdc3.getAppMetadata` failures report missing `desktopAgent` on directory and instance metadata. Cucumber does not currently assert this field.

## Reference docs

- `plans/prd-toolbox-conformance-burn-down.md` (TB-01)
- `conformance-test-failure-review.md`
- `packages/sail-desktop-agent/src/core/handlers/dacp/app-handlers.ts`

## Parent context

From `plans/prd-toolbox-conformance-burn-down.md`: Agent-only fix — `convertDirectoryAppToAppMetadata` omits `desktopAgent` when no `instanceId`. High signal, no web changes.

## Behavior spec

Given chartApp is registered in the app directory but has no running instance
When a connected app requests fdc3.getAppMetadata({ appId: "chartApp" })
Then appMetadata.desktopAgent equals the agent implementationMetadata.provider

Given chartApp is running with instanceId chart-123
When a connected app requests metadata for chartApp
Then appMetadata includes both instanceId and desktopAgent

## Out of scope

- sail-web / platform-api metadata UI
- getInfo implementationMetadata changes

## TypeScript interfaces

none

## Test guidance

RED: extend `apps.feature` or Vitest handler test to assert `desktopAgent` on directory-only lookup. Run `npm test -w @finos/sail-desktop-agent`.

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
