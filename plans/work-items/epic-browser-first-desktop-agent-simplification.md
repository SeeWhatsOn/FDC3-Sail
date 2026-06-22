---
title: "Coordinate browser-first Desktop Agent simplification"
slug: epic-browser-first-desktop-agent-simplification
kind: epic
type: chore
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - plans/prd-browser-first-desktop-agent-simplification.md
  - plans/work-items/document-browser-first-desktop-agent.md
  - plans/work-items/define-browser-da-observability-hooks.md
depends_on: []
integration_branch: v3-pre
branch: cursor/browser-first-desktop-agent-simplification
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - desktop-agent
  - architecture
---

## Goal

Coordinate the browser-first Desktop Agent simplification so implementation slices preserve WCP app connectivity while removing remote Desktop Agent deployment as a default architecture driver.

## User or system context

Maintainers need Sail to be easier to explain and reason about: one browser-resident Desktop Agent owns local FDC3 state, web apps connect through WCP `MessagePort`, native apps can later connect through a WebSocket adapter, and distributed sync is deferred to explicit bridging/relay work.

## Reference docs

- `plans/prd-browser-first-desktop-agent-simplification.md`
- `packages/sail-desktop-agent/src/presets/create-browser-desktop-agent.ts`
- `packages/sail-desktop-agent/src/app-connection/browser-da-edge-link.ts`
- `packages/sail-desktop-agent/src/app-connection/wcp-connector.ts`
- `packages/sail-platform-api/src/sail-platform.ts`
- `website/docs/packages/desktop-agent/integrator-guide.md`
- `website/docs/packages/desktop-agent/composition.md`

## Parent context

Sail should be browser-first: one browser-resident `DesktopAgent` owns local FDC3 state for a host page. Web apps still communicate through WCP and per-app `MessagePort`; that is not the complexity being removed. The complexity to remove is the public/default assumption that the Desktop Agent itself may live in a worker, server, WebSocket runtime, or other remote location.

## Child work items

| Slug | Kind | depends_on | Status |
|------|------|------------|--------|
| `spike-browser-first-transport-simplification` | spike | [] | done — work item deleted |
| `preserve-wcp-messageport-connectivity` | task | [`spike-browser-first-transport-simplification`] | done — work item deleted |
| `simplify-browser-desktop-agent-preset` | task | [`spike-browser-first-transport-simplification`, `preserve-wcp-messageport-connectivity`] | done — work item deleted |
| `simplify-dacp-handler-response-plumbing` | task | [`spike-browser-first-transport-simplification`, `preserve-wcp-messageport-connectivity`] | done — work item deleted |
| `unify-browser-host-ui-controllers` | task | [`simplify-browser-desktop-agent-preset`] | done — work item deleted |
| `document-browser-first-desktop-agent` | task | [`simplify-browser-desktop-agent-preset`] | draft |
| `define-browser-da-observability-hooks` | task | [`simplify-dacp-handler-response-plumbing`] | draft |

## Out of scope

- Delivering the epic directly.
- Implementing cross-tab/device sync, distributed state, FDC3 Agent Bridging, Redis/Kafka/database relay, or native WebSocket protocol support.

## TypeScript interfaces

None directly; child work items own interface changes.

## Test guidance

Child work items define targeted validation. Preserve existing FDC3 conformance-oriented behavior and prefer focused `@finos/sail-desktop-agent` tests before broad validation.

## Blocked decisions

None.

## Loop history

BFDA-01 through BFDA-05 delivered 2026-06-21. BFDA-04 host UI controller unification delivered same day. Remaining: BFDA-06 (docs), BFDA-07 (observability hooks).

## Staged for review

None.

## Escalation notes

None.

## Learnings extracted

- Host channel change confirmation belongs on `BrowserChannelsController.changeAppChannel`, not on each consumer.
- `platform.connector` is advanced-only; reference sail-web uses grouped controllers.
