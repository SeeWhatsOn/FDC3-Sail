---
title: "Centralize implementation metadata version defaults for getInfo"
slug: centralize-implementation-metadata-defaults
merged_pr: "v3-pre@3b5d2d16 #35"
kind: task
type: chore
status: done
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/desktop-agent.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/app-handlers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/wcp-handlers.ts
depends_on: []
integration_branch: ""
branch: chore/centralize-implementation-metadata
pr_url: https://github.com/SeeWhatsOn/FDC3-Sail/pull/31
external_tracker: ""
tags: [fdc3]
---

## Goal

Single source of truth for `implementationMetadata` defaults so `getInfo` and WCP5 responses do not disagree on `providerVersion` (P2-03).

## User or system context

Compliance review notes `3.0.0` vs `0.0.1` vs `0.0.0` fallbacks across `desktop-agent.ts`, `wcp-handlers.ts`, and `app-handlers.ts`.

## Reference docs

- `plans/prd-desktop-agent-release-p2.md` (P2-03)
- `FDC3_2_2_COMPLIANCE_REVIEW.MD` (getInfo metadata)

## Parent context

From `plans/prd-desktop-agent-release-p2.md`: Post-P1 hardening — logging redaction, README/package alignment, metadata defaults, and test hygiene.

## Behavior spec

Given a Desktop Agent constructed with default config
When an app calls getInfo
Then `implementationMetadata.providerVersion` matches the agent config default
And WCP5 responses use the same default when app metadata is merged

## Out of scope

- Changing FDC3 optional feature flags semantics
- Platform-api metadata

## TypeScript interfaces

none

## Test guidance

Extend or add Vitest for `handleGetInfoRequest` and WCP5 metadata merge; align existing Cucumber getInfo scenarios if defaults change.

## Blocked decisions

Canonical default for `providerVersion` when host omits config (product decision).

## Loop history

- 2026-05-29: /ww-reconcile — shipped on v3-pre (3b5d2d16 #35; feat(sail-desktop-agent): align with FDC3 2.2 and enhance configuration management)

- 2026-05-27: approved by human (validation gaps waived)
