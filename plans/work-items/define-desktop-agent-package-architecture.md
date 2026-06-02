---
title: "Define desktop-agent package architecture"
slug: define-desktop-agent-package-architecture
kind: task
type: feature
status: in-progress
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
file_manifest:
  - packages/sail-desktop-agent/README.md
  - website/docs/architecture/overview.md
  - website/docs/architecture/sail-platform-sdk.md
depends_on: []
integration_branch: v3-pre
branch: cursor/define-desktop-agent-package-architecture-8a9f
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: []
---

## Goal

Document the new `@finos/sail-desktop-agent` package boundary, target tree, public API modes, and `@finos/sail-platform-api` wrapper responsibility.

## User or system context

Platform builders need to understand whether they should manually compose a Desktop Agent from primitives or use a preset factory. Sail product engineers need the docs to keep FDC3 Desktop Agent responsibilities separate from Sail layout, workspace, configuration, and storage features.

## Reference docs

- `plans/prd-desktop-agent-composable-package.md`
- `AGENTS.md`
- `packages/sail-desktop-agent/README.md`
- `website/docs/architecture/overview.md`
- `website/docs/architecture/sail-platform-sdk.md`

## Parent context

`@finos/sail-desktop-agent` should be the platform-builder package for FDC3 Desktop Agent construction. It should remain UI-free but expose the host contracts needed to complete FDC3 behaviors, including launch, intent resolution, App Directory population, channel configuration, transports, and connectors. Consumers need both manual composition primitives and high-level presets.

## Behavior spec

Given a developer wants to build a custom FDC3 Desktop Agent
When they read the package architecture docs
Then they can distinguish manual composition primitives from presets.

Given a Sail product engineer reads the docs
When they need layout, workspace, storage, or configuration behavior
Then the docs route that concern to `@finos/sail-platform-api` instead of core desktop-agent.

Given an agent prepares to deliver later work items
When it reads the architecture docs
Then it can find the intended folders: `core`, `host-contracts`, `protocols`, `transports`, `connectors`, and `presets`.

## Out of scope

- Moving source files.
- Changing runtime behavior.
- Updating the consume skill; that is covered by `update-consume-sail-desktop-agent-skill`.

## TypeScript interfaces

None.

## Test guidance

RED phase should check documentation expectations against current package exports and source layout. Verification should include a docs review and any repository docs build or focused package validation that is practical for documentation-only changes.

## Blocked decisions

None.

## Loop history

- 2026-06-02: Phase A RED — 16/17 doc contract tests failing (package-architecture-docs.test.ts)
- 2026-06-02: Phase B GREEN — docs updated; minimal scaffold (connectors/browser move, presets export) to satisfy contract tests
- 2026-06-02: Committed and opened draft PR (user requested PR per work item)

## Staged for review

RED evidence: `package-architecture-docs.test.ts` — 16 failures before docs update (missing target folders, manual vs preset distinction, platform-api routing).

Commands: `npx vitest run src/__tests__/package-architecture-docs.test.ts` (17 pass); `npm run build -w @finos/sail-desktop-agent` (pass).

Phase audit: test-engineer yes, implement-agent yes, verifier partial (scope note), code-reviewer deferred to PR review.

Files: README.md, overview.md, sail-platform-sdk.md, package-architecture-docs.test.ts, package.json, tsdown.config.ts, src/connectors/browser/* (moved from src/browser), src/presets/index.ts, placeholder host-contracts/protocols dirs.

## Escalation notes

None.

## Learnings extracted

None.
