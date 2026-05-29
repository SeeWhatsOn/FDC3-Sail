---
title: "Align README, package name, and validation documentation"
slug: align-readme-package-and-validation-docs
merged_pr: "v3-pre@91986574 #20"
kind: task
type: chore
status: done
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/README.md
  - packages/sail-desktop-agent/src/index.ts
depends_on: []
integration_branch: ""
branch: docs/align-readme-package-validation
external_tracker: ""
tags: [fdc3]
---

## Goal

Align public docs and examples with `@finos/sail-desktop-agent`, current file layout, and injectable validation (remediation Task 5 / P2-02).

## User or system context

Integrators copy README examples; wrong package names and “Zod validation” claims cause onboarding friction and misconfigured hosts.

## Reference docs

- `plans/prd-desktop-agent-release-p2.md` (P2-02)
- `FDC3_2_2_REMEDIATION_PLAN.MD` Task 5

## Parent context

From `plans/prd-desktop-agent-release-p2.md`: Post-P1 hardening — logging redaction, README/package alignment, metadata defaults, and test hygiene.

## Behavior spec

Given a new integrator reads `packages/sail-desktop-agent/README.md`
When they follow install and import examples
Then examples use `@finos/sail-desktop-agent` and `/browser` / `/transports` subpaths as appropriate
And validation is described as injectable, not built-in Zod

## Out of scope

- Docusaurus website (`website/`)
- Other workspace packages' READMEs

## TypeScript interfaces

none

## Test guidance

Run `npm run validate -w @finos/sail-desktop-agent` after edits.

## Blocked decisions

None.

## Loop history

- 2026-05-29: /ww-reconcile — shipped on v3-pre (91986574 #20; docs(sail-desktop-agent): align README with injectable validation and -w examples)

- 2026-05-27: approved by human
