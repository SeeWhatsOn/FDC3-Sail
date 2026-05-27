---
title: "Align README, package name, and validation documentation"
slug: align-readme-package-and-validation-docs
kind: task
type: chore
status: draft
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

## Behavior spec

Given a new integrator reads `packages/sail-desktop-agent/README.md`
When they follow install and import examples
Then examples use `@finos/sail-desktop-agent` and `/browser` / `/transports` subpaths as appropriate
And validation is described as injectable, not built-in Zod

## Out of scope

- Docusaurus website (`website/`)
- Other workspace packages' READMEs

## Test guidance

Run `npm run validate -w @finos/sail-desktop-agent` after edits.

## Blocked decisions

None.
