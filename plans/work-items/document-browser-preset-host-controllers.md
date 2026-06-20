---
title: "Document browser preset host controllers"
slug: document-browser-preset-host-controllers
kind: task
type: chore
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - website/docs/packages/desktop-agent/integrator-guide.md
  - website/docs/packages/desktop-agent/overview.md
  - website/docs/packages/desktop-agent/composition.md
  - website/docs/getting-started.md
  - website/docs/architecture/channel-selection.md
depends_on:
  - promote-browser-intent-resolver-controller
  - add-browser-channels-controller
  - add-browser-apps-controller
integration_branch: v3-pre
branch: cursor/document-browser-preset-host-controllers
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - api
  - fdc3
---

## Goal

Update website documentation so Browser Desktop Agent preset users can build host resolver UI, channel chrome, runtime app catalog registration, and iframe lifecycle using the grouped host controllers.

## User or system context

New integrators currently have to infer React-style host wiring from `sail-web` source or use advanced WCP session access for channel changes. The docs should present the additive browser-host API clearly while preserving the distinction between FDC3 app code and host-shell code.

## Reference docs

- `plans/prd-browser-preset-host-api.md` (BHA-07)
- `plans/work-items/epic-browser-preset-host-api.md`
- `website/docs/packages/desktop-agent/integrator-guide.md`
- `website/docs/architecture/channel-selection.md`

## Parent context

The browser preset host API is additive Sail API for host builders. Apps continue to use `@finos/fdc3` `getAgent()` in iframe/window contexts. Docs should show `desktopAgent.intentResolver`, `desktopAgent.channels`, and `desktopAgent.apps`, not WCP connector internals, as the MVP package-only integration path.

## Behavior spec

Scenario: Integrator finds the grouped host API
  Given a developer reads the desktop agent integrator guide
  When they look for Browser Desktop Agent preset host wiring
  Then they find `intentResolver`, `channels`, and `apps` controller examples

Scenario: Integrator sees runtime catalog registration
  Given a developer wants to load apps after shell creation
  When they read the preset setup example
  Then they see `desktopAgent.apps.addDirectory(...)` and `desktopAgent.apps.add(...)` as the primary pattern

Scenario: Integrator wires channel chrome without WCP internals
  Given a developer builds per-iframe channel UI
  When they read channel selector documentation
  Then they see `channels.getAppChannel`, `channels.changeAppChannel`, and `channels.onAppChannelChange`

Scenario: Integrator understands framework-neutral subscriptions
  Given a developer uses React, Svelte, Vue, or vanilla JavaScript
  When they read subscription examples
  Then they see the same typed `on...` API returning an unsubscribe function

Scenario: Integrator understands FDC3 boundary
  Given a developer is deciding what belongs in app code versus host code
  When they read the docs
  Then they understand apps use `@finos/fdc3` `getAgent()` and host controllers are Sail browser preset APIs

## Out of scope

- Executable tests that read markdown or Docusaurus docs as contracts
- Full manual composition tutorial beyond a concise advanced note
- Changing package README beyond pointing to the website docs if necessary

## TypeScript interfaces

Use the interfaces delivered by the controller implementation work items. Do not invent separate docs-only type names.

## Test guidance

Docs-only: no executable RED phase. Human review should check that examples match the delivered TypeScript API; optional docs build is `npm run docs:build -w @finos/sail-docs`.

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
