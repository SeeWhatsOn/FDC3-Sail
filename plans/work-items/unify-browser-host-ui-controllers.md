---
title: "Unify browser host UI controllers"
slug: unify-browser-host-ui-controllers
kind: task
type: feature
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/presets/browser-session.ts
  - packages/sail-desktop-agent/src/host-contracts/intent-resolver.ts
  - packages/sail-desktop-agent/src/host-contracts/channel-control.ts
  - packages/sail-platform-api/src/sail-platform.ts
  - packages/sail-web/src/stores/intent-resolver-store.ts
  - packages/sail-web/src/stores/connection-store.ts
  - packages/sail-web/src/components/ChannelSelector.tsx
depends_on:
  - simplify-browser-desktop-agent-preset
integration_branch: v3-pre
branch: cursor/unify-browser-host-ui-controllers
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - desktop-agent
  - platform-api
  - host-ui
---

## Goal

Route browser host UI through grouped controllers for channels, intent resolver, and app lifecycle instead of normal application code using raw `WCPConnector` events or transport/session internals.

## User or system context

Channel selector UI and intent resolver UI should become easier once the Desktop Agent is treated as browser-local state. Host code should read and mutate through `channels`, `intentResolver`, and `apps`, while the connector remains an app-connection implementation detail.

## Reference docs

- `plans/prd-browser-first-desktop-agent-simplification.md`
- `packages/sail-desktop-agent/src/presets/browser-session.ts`
- `packages/sail-platform-api/src/sail-platform.ts`
- `packages/sail-web/src/stores/intent-resolver-store.ts`
- `packages/sail-web/src/components/ChannelSelector.tsx`

## Parent context

The browser preset already exposes grouped controllers, but parts of the reference stack still expose or use raw connector/session state. This task makes the grouped controller path the normal host UI path.

## Behavior spec

Given an app instance is connected, when host channel chrome changes its user channel through the grouped channels controller, then the Desktop Agent state changes and the host can read the current channel immediately.

Given an app raises an intent with multiple handlers, when the host UI subscribes through the grouped intent resolver controller, then it receives the request and can select or cancel without calling raw connector APIs.

Given app lifecycle changes occur, when the host subscribes through the grouped apps controller or SailPlatform equivalent, then app connected, disconnected, and handshake failure events reach UI state without exposing connector internals.

## Out of scope

- Replacing WCP `MessagePort` routing.
- Implementing a new visual design for channel selector or intent resolver UI.
- Adding docs-only tests.

## TypeScript interfaces

Likely affected: `BrowserChannelsController`, `BrowserIntentResolverController`, `BrowserAppsController`, and SailPlatform public API types that re-export or wrap those controllers.

## Test guidance

Use focused unit/integration tests for controller behavior where runtime code changes. For docs-only or wiring examples, rely on human review and optional docs build, not markdown contract tests.

## Blocked decisions

- Decide whether `ChannelControl.selectChannel` is wired into the browser preset or removed from the active configuration surface.

## Loop history

Not started.

## Staged for review

Not staged.

## Escalation notes

None.

## Learnings extracted

None yet.

