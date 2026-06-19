---
title: "Coordinate browser preset host API delivery"
slug: epic-browser-preset-host-api
kind: epic
type: feature
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - plans/prd-browser-preset-host-api.md
depends_on: []
integration_branch: v3-pre
branch: cursor/epic-browser-preset-host-api
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - api
  - fdc3
---

## Goal

Coordinate delivery of the Browser Desktop Agent host controllers so preset users can manage resolver UI, channel chrome, app catalog, and app lifecycle without WCP internals.

## User or system context

Host-shell developers use `createBrowserDesktopAgent` to build custom browser desktops around iframe apps. The FDC3 apps remain standard `@finos/fdc3` `getAgent()` consumers, while host UI needs package-only controls for resolver requests, channel changes, dynamic app registration, and iframe lifecycle.

## Reference docs

- `plans/prd-browser-preset-host-api.md`
- `website/docs/packages/desktop-agent/integrator-guide.md`
- `packages/sail-desktop-agent/src/presets/create-browser-desktop-agent.ts`
- `packages/sail-desktop-agent/src/presets/browser-session.ts`

## Parent context

Browser host developers need one obvious API on `createBrowserDesktopAgent` for host chrome and iframe orchestration. The new host API should be additive, typed, destructurable, and framework-neutral. Core remains protocol-pure; preset/browser-host composition modules wire controllers to existing Desktop Agent state, WCP connector events, DACP handlers, and app-directory mutators.

## Behavior spec

Use child work items for behavior specs.

## Child work items

| Slug | Kind | Depends on | Status |
|---|---|---|---|
| `add-browser-host-controller-composition` | task | `epic-browser-preset-host-api` | draft |
| `promote-browser-intent-resolver-controller` | task | `add-browser-host-controller-composition` | draft |
| `add-browser-channels-controller` | task | `add-browser-host-controller-composition` | draft |
| `add-browser-apps-controller` | task | `add-browser-host-controller-composition` | draft |
| `document-browser-preset-host-controllers` | task | `promote-browser-intent-resolver-controller`, `add-browser-channels-controller`, `add-browser-apps-controller` | draft |

## Out of scope

- Delivering this epic directly with `/ww-deliver`
- Changing FDC3 app-facing WCP/DACP semantics
- Moving UI concepts into `core/`

## TypeScript interfaces

none

## Test guidance

Epic only: child work items define RED-phase guidance.

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
