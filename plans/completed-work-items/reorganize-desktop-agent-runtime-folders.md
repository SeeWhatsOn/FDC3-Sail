---
title: "Reorganize desktop-agent runtime folders"
slug: reorganize-desktop-agent-runtime-folders
kind: task
type: chore
status: done
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/protocols/dacp/
  - packages/sail-desktop-agent/src/protocols/wcp/
  - packages/sail-desktop-agent/src/connectors/browser/
  - packages/sail-desktop-agent/src/transports/
  - packages/sail-desktop-agent/src/core/
  - packages/sail-desktop-agent/src/index.ts
  - packages/sail-desktop-agent/src/**/__tests__/*.ts
depends_on:
  - add-top-level-browser-desktop-agent-preset
integration_branch: v3-pre
branch: cursor/reorganize-desktop-agent-runtime-folders-ade5
pr_url: "https://github.com/SeeWhatsOn/FDC3-Sail/pull/64"
merged_pr: ""
external_tracker: ""
tags: []
---

## Goal

Move WCP, DACP, transport, and browser runtime files into the new source structure with top-level exports updated.

## User or system context

Maintainers currently have to infer whether `src/browser` means browser UI, WCP protocol, MessagePort transport, or a ready-made Desktop Agent preset. The new structure should make protocols, transports, connectors, presets, and core behavior discoverable.

## Reference docs

- `plans/prd-desktop-agent-composable-package.md`
- `plans/work-items/define-desktop-agent-package-architecture.md`
- `plans/work-items/add-top-level-browser-desktop-agent-preset.md`
- `packages/sail-desktop-agent/src/browser/wcp/*`
- `packages/sail-desktop-agent/src/core/dacp-protocol/*`
- `packages/sail-desktop-agent/src/core/handlers/dacp/*`
- `packages/sail-desktop-agent/src/transports/*`

## Parent context

The target tree is `core`, `host-contracts`, `protocols`, `transports`, `connectors`, and `presets`. Backward compatibility with existing subpath exports is not required, but the package should remain buildable and tests should be updated to the new import paths.

## Behavior spec

Given a maintainer browses `src/protocols`
When they inspect `dacp` and `wcp`
Then protocol-specific message shapes and protocol handling are clearly separated from presets.

Given a maintainer browses `src/connectors/browser`
When they inspect browser runtime code
Then browser window, iframe, and MessageChannel connection behavior is grouped there.

Given existing tests run
When imports are updated for the new folders
Then the package still typechecks and relevant tests pass.

## Out of scope

- Changing protocol behavior beyond import/path updates.
- Preserving `/browser` and `/transports` compatibility.
- Moving Sail product platform code.

## TypeScript interfaces

None expected beyond import/export path updates. If moved files expose clearer names, keep behavior equivalent and document name changes in package docs.

## Test guidance

RED phase should show current folder names blur responsibilities or import paths do not match the target tree. Delivery should rely on typecheck and focused existing tests to catch broken imports and accidental behavior changes.

## Blocked decisions

None.

## Loop history

- 2026-06-10: Archived done — `core/`, `protocols/`, `connectors/browser/`, `presets/` layout landed; verified on v3-pre (PR #64).

## Staged for review

None.

## Escalation notes

None.

## Learnings extracted

None.
