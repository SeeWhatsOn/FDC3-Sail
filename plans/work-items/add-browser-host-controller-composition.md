---
title: "Add browser host controller composition"
slug: add-browser-host-controller-composition
kind: task
type: feature
status: waiting_on_user
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
file_manifest:
  - packages/sail-desktop-agent/src/presets/create-browser-desktop-agent.ts
  - packages/sail-desktop-agent/src/presets/browser-session.ts
  - packages/sail-desktop-agent/src/presets/index.ts
  - packages/sail-desktop-agent/src/presets/__tests__/browser-desktop-agent-preset.test.ts
depends_on:
  - epic-browser-preset-host-api
integration_branch: v3-pre
branch: cursor/add-browser-host-controller-composition
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - api
  - fdc3
---

## Goal

Add a reusable browser-host controller composition helper and attach destructurable `intentResolver`, `channels`, and `apps` controller placeholders to `BrowserDesktopAgent`.

## User or system context

This is the foundation slice for the Browser preset host API. The preset should attach grouped controllers automatically, but the construction should be reusable by advanced manual `DesktopAgent` + `WCPConnector` composition later. Controller methods must be closure-based so framework users can destructure them safely.

## Reference docs

- `plans/prd-browser-preset-host-api.md` (BHA-01, BHA-06)
- `plans/work-items/epic-browser-preset-host-api.md`
- `packages/sail-desktop-agent/src/presets/create-browser-desktop-agent.ts`
- `packages/sail-desktop-agent/src/presets/browser-session.ts`

## Parent context

Browser host developers need one obvious API on `createBrowserDesktopAgent` for host chrome and iframe orchestration. This work item creates the composition boundary without filling every controller behavior. Follow-up slices implement resolver, channel, and app-specific methods.

## Behavior spec

Scenario: Browser preset exposes grouped controllers
  Given a host creates a Browser Desktop Agent preset
  When the host reads the returned agent handle
  Then it exposes `intentResolver`, `channels`, and `apps` controller objects

Scenario: Controllers are safe to destructure
  Given a host destructures the grouped controllers from the Desktop Agent
  When the host calls available controller methods from the destructured objects
  Then those methods do not require the original Desktop Agent object as `this`

Scenario: Manual composition remains possible later
  Given an advanced host wires `DesktopAgent`, `WCPConnector`, and connector transport manually
  When it imports the browser host controller composition helper
  Then it can construct the same controller shape without using `createBrowserDesktopAgent`

## Out of scope

- Implementing full channel-change behavior
- Implementing runtime app directory registration
- Removing existing `intentResolverUI`
- Full manual composition guide in website docs

## TypeScript interfaces

```typescript
interface BrowserHostControllers {
  intentResolver: BrowserIntentResolverController
  channels: BrowserChannelsController
  apps: BrowserAppsController
}

interface BrowserHostControllerOptions {
  desktopAgent: DesktopAgent
  wcpConnector: WCPConnector
  connectorTransport: Transport
  intentResolverUI?: IntentResolverUIMethods
}
```

## Test guidance

RED: Add focused preset tests that fail because the returned browser agent does not expose grouped controllers and because destructured controller methods are not yet available. Keep tests at the preset/API surface; behavior-heavy tests belong to child slices.

## Blocked decisions

_(empty)_

## Loop history

- 2026-06-20: approved by human (batch approve all PRD items; sequential delivery)
- 2026-06-20: delivery RED → GREEN → verify → review PASS; staged for human review

## Staged for review

**Work item:** add-browser-host-controller-composition  
**Status:** waiting_on_user  
**Automation tier:** stage_only

### RED evidence
- Test file: `packages/sail-desktop-agent/src/presets/__tests__/browser-desktop-agent-preset.test.ts`
- Command: `npx vitest run src/presets/__tests__/browser-desktop-agent-preset.test.ts`
- 4 new tests failed before implementation (missing grouped controllers + export)

### Commands run
- `npx vitest run packages/sail-desktop-agent/src/presets/__tests__/browser-desktop-agent-preset.test.ts` — 10 passed
- Root vitest — 392 passed

### Files changed
- `packages/sail-desktop-agent/src/presets/browser-session.ts` — `createBrowserHostControllers` + controller interfaces
- `packages/sail-desktop-agent/src/presets/create-browser-desktop-agent.ts` — attach controllers to preset handle
- `packages/sail-desktop-agent/src/presets/index.ts` — export helper and types
- `packages/sail-desktop-agent/src/presets/__tests__/browser-desktop-agent-preset.test.ts` — 4 RED tests

### Phase audit
| Phase | Subagent | Registered subagent | Result |
|-------|----------|---------------------|--------|
| A RED | test-engineer | yes | 4 failing tests |
| B GREEN | implement-agent | yes | 10 passing |
| C Verify | verifier-agent | yes | VERIFICATION: PASS |
| D Review | code-reviewer | yes | VERDICT: PASS |

### Learnings proposed
- `createBrowserHostControllers` in `presets/browser-session.ts`; attach grouped `intentResolver`, `channels`, `apps` on browser preset

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
