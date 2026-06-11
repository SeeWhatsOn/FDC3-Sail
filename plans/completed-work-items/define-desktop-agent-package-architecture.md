---
title: "Define desktop-agent package architecture"
slug: define-desktop-agent-package-architecture
kind: task
type: feature
status: done
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
file_manifest:
  - packages/sail-desktop-agent/README.md
  - packages/sail-desktop-agent/src/index.ts
  - website/docs/architecture/overview.md
  - website/docs/packages/desktop-agent/overview.md
  - website/docs/packages/desktop-agent/composition.md
  - website/docs/packages/platform-api/overview.md
depends_on: []
integration_branch: v3-pre
branch: cursor/define-desktop-agent-package-architecture-ade5
pr_url: "https://github.com/SeeWhatsOn/FDC3-Sail/pull/61"
merged_pr: ""
external_tracker: ""
tags: []
---

## Goal

Document the `@finos/sail-desktop-agent` package boundary, target tree, public API modes, and `@finos/sail-platform-api` wrapper responsibility on the Docusaurus docs site.

## User or system context

Platform builders need to understand whether they should manually compose a Desktop Agent from primitives or use a preset factory. Sail product engineers need the docs to keep FDC3 Desktop Agent responsibilities separate from Sail layout, workspace, configuration, and storage features.

## Reference docs

- `plans/prd-desktop-agent-composable-package.md`
- `AGENTS.md`
- `website/docs/packages/desktop-agent/overview.md`
- `website/docs/packages/desktop-agent/integrator-guide.md`
- `website/docs/packages/desktop-agent/composition.md`
- `website/docs/architecture/overview.md`
- `website/docs/packages/platform-api/overview.md`

## Parent context

`@finos/sail-desktop-agent` should be the platform-builder package for FDC3 Desktop Agent construction. It should remain UI-free but expose the host contracts needed to complete FDC3 behaviors. Full documentation lives under `website/docs/packages/desktop-agent/`; npm README is a brief summary with links.

## Behavior spec

Given a developer wants to build a custom FDC3 Desktop Agent
When they read the package architecture docs on the website
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
- Package-local `docs/` tree (cancelled — Docusaurus is canonical).
- Updating the consume skill; that is covered by `update-consume-sail-desktop-agent-skill`.

## TypeScript interfaces

None.

## Test guidance

Docs-only: no executable tests that read `.md` or website docs. Human review + optional `npm run docs:build`.

## Blocked decisions

None.

## Loop history

- 2026-06-02: Phase A RED — 16/17 doc contract tests failing (package-architecture-docs.test.ts)
- 2026-06-02: Phase B GREEN — docs updated; minimal scaffold (connectors/browser move, presets export) to satisfy contract tests
- 2026-06-02: Committed and opened draft PR (user requested PR per work item)
- 2026-06-10: Reworked docs to `website/docs/packages/desktop-agent/*`; updated `src/index.ts` JSDoc; archived done.
- 2026-06-10: Removed `package-architecture-docs.test.ts` — no Vitest coverage of markdown/website docs.

## Staged for review

RED evidence: `package-architecture-docs.test.ts` — 16 failures before docs update (missing target folders, manual vs preset distinction, platform-api routing).

Commands: `npx vitest run src/__tests__/package-architecture-docs.test.ts` (17 pass); `npm run build -w @finos/sail-desktop-agent` (pass).

Phase audit: test-engineer yes, implement-agent yes, verifier partial (scope note), code-reviewer deferred to PR review.

Files: README.md, overview.md, sail-platform-sdk.md, package-architecture-docs.test.ts, package.json, tsdown.config.ts, src/connectors/browser/* (moved from src/browser), src/presets/index.ts, placeholder host-contracts/protocols dirs.

## Escalation notes

None.

## Learnings extracted

None.
