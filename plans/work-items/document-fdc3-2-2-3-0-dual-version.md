---
title: "Document FDC3 2.2 and 3.0 dual-version strategy"
slug: document-fdc3-2-2-3-0-dual-version
kind: task
type: chore
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - website/docs/packages/desktop-agent/integrator-guide.md
  - website/docs/packages/desktop-agent/conformance.md
depends_on:
  - audit-fdc3-3-0-handler-delta
integration_branch: v3-pre
branch: cursor/document-fdc3-2-2-3-0-dual-version-8a9f
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Publish integrator-facing documentation explaining how Sail supports FDC3 2.2 and 3.0 on one agent, when to bump `fdc3Version`, and what app developers must migrate.

## User or system context

PRD answers "can we support both?" for maintainers; adopters need the same clarity in canonical Docusaurus docs. npm README stays a brief link per AGENTS.md.

## Reference docs

- `plans/prd-fdc3-3-0-dual-version-support.md` (F30-11)
- `website/docs/packages/desktop-agent/integrator-guide.md`
- `AGENTS.md` (documentation source of truth)

## Parent context

Child of `epic-fdc3-3-0-dual-version`. Docs-only slice; can land after audit spike even before all handlers ship (document strategy + current status table).

## Behavior spec

Scenario: Integrator finds version policy
  Given a developer reading the integrator guide
  When they search for FDC3 3.0 or dual version
  Then they find one section explaining single handler tree, default `"2.2"`, and override path

Scenario: App developer migration list
  Given deprecated 2.2 APIs removed in 3.0
  When reader reviews migration subsection
  Then they see which APIs Sail never implemented vs which require app client upgrade

Scenario: Conformance tagging
  Given maintainer running BDD
  When they open conformance doc
  Then `@conformance2.2` vs `@conformance3.0` purpose and run commands are documented

## Out of scope

- Full FDC3 spec tutorial (link to FINOS)
- sail-web app developer path (`add-your-app.md`) unless one cross-link
- Executable documentation contract tests

## TypeScript interfaces

none

## Test guidance

Docs-only: no executable RED phase. Verification: human review; optional `npm run docs:build -w @finos/sail-docs` on `--port 3002` if env allows.

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
