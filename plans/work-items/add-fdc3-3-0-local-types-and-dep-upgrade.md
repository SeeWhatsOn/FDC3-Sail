---
title: "Add FDC3 3.0 local types and dependency upgrade strategy"
slug: add-fdc3-3-0-local-types-and-dep-upgrade
kind: task
type: feature
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/package.json
  - packages/sail-desktop-agent/src/core/handlers/dacp/app-handlers.ts
  - packages/sail-desktop-agent/src/core/dacp/
  - packages/sail-desktop-agent/src/core/__tests__/sail-default-config.test.ts
depends_on:
  - audit-fdc3-3-0-handler-delta
integration_branch: v3-pre
branch: cursor/add-fdc3-3-0-local-types-and-dep-upgrade-8a9f
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Establish typed 3.0 DACP wire shapes (following `CloseRequestMessage`) and document when to pin `@finos/fdc3` ^3.x without breaking the ^2.2.3 build today.

## User or system context

Handlers need 3.0 optional `metadata` fields before `@finos/fdc3` publishes 3.x. Local types prevent `any` and clarify dual-version boundaries for implementers.

## Reference docs

- `plans/prd-fdc3-3-0-dual-version-support.md` (F30-07)
- `packages/sail-desktop-agent/src/core/handlers/dacp/app-handlers.ts` (`CloseRequestMessage`)
- `AGENTS.md` (no `import ... with { type: "json" }`)

## Parent context

Child of `epic-fdc3-3-0-dual-version`. Blocks clean implementation of open/broadcast metadata tasks. Bump npm dep only if audit confirms stable 3.x; otherwise local types + re-export plan in module README comment or PRD note.

## Behavior spec

Scenario: Open request accepts optional metadata type
  Given audit checklist lists openRequest.metadata
  When TypeScript compiles handler signatures extended with optional metadata
  Then existing 2.2 `BrowserTypes.OpenRequest` call sites still compile without metadata

Scenario: CloseRequest pattern reused
  Given `CloseRequestMessage` local type exists
  When new 3.0-only messages are added
  Then they live colocated with handlers or under `core/dacp/` with JSDoc linking to FINOS spec section

Scenario: Dependency policy documented
  Given `@finos/fdc3` remains ^2.2.3 unless 3.x is pinned
  When integrator reads type module or PRD appendix
  Then upgrade steps and replace-local-type checklist are explicit

## Out of scope

- Implementing metadata forwarding behavior (separate wire tasks)
- Harness `@finos/fdc3` bump (F30-10)
- Changing default `fdc3Version` advertisement

## TypeScript interfaces

Extend or add local types for 3.0 wire payloads with optional `metadata`; document mapping to future `BrowserTypes` when dep bumps.

## Test guidance

RED: type-level or Vitest compile-safety test that optional metadata fields exist on extended open/broadcast request types. Run `npm run typecheck -w @finos/sail-desktop-agent`. No behavior change tests until wire tasks land.

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
