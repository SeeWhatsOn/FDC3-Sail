---
title: "Document desktop agent singleton and host reactivity patterns"
slug: document-desktop-agent-singleton-and-reactivity
kind: task
type: chore
status: draft
loop_count: 0
loop_limit: 3
last_agent: spec-planner
file_manifest:
  - website/docs/packages/desktop-agent/integrator-guide.md
  - website/docs/architecture/channel-selection.md
depends_on:
  - audit-host-channel-reactivity-read-apis
integration_branch: v3-pre
branch: cursor/document-desktop-agent-singleton-and-reactivity
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - docs
  - fdc3
---

## Goal

Document that one desktop agent per user/browsing context is expected; provide browser (`window`) and Node module singleton examples; document channel UI event+getter reactivity pattern.

## User or system context

Integrators embedding `@finos/sail-desktop-agent` need clear guidance: core allows multiple instances for tests, hosts must enforce singleton; channel chrome must not use mutable `getState()`.

## Reference docs

- `plans/prd-desktop-agent-state-hardening.md` (PRD-04j)
- `website/docs/architecture/channel-selection.md`

## Parent context

Final docs slice after audit confirms actual read/event paths in platform and sail-web.

## Behavior spec

Scenario: Integrator guide describes singleton expectation
  Given a developer reading the desktop agent integrator guide
  When they look for deployment guidance for browser and Node hosts
  Then they find one-agent-per-context guidance with example singleton patterns

Scenario: Integrator guide describes host channel UI consumption
  Given a developer building host channel chrome
  When they read the integrator guide
  Then they find the event push plus granular getter pattern for channel updates

## Out of scope

- Executable documentation tests
- npm README changes beyond brief link to docs site (optional)

## TypeScript interfaces

none

## Test guidance

Docs-only: no executable RED phase. Human review: `npm run docs:build -w @finos/sail-docs` optional.

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
