---
title: "Add top-level browser Desktop Agent preset"
slug: add-top-level-browser-desktop-agent-preset
kind: task
type: feature
status: done
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/presets/browser-desktop-agent.ts
  - packages/sail-desktop-agent/src/index.ts
  - packages/sail-desktop-agent/src/browser/browser-desktop-agent.ts
  - packages/sail-desktop-agent/src/browser/index.ts
  - packages/sail-desktop-agent/src/browser/__tests__/wcp-desktop-agent.integration.test.ts
  - packages/sail-desktop-agent/src/browser/__tests__/wcp-connector.test.ts
  - packages/sail-desktop-agent/package.json
depends_on:
  - promote-desktop-agent-host-contracts
integration_branch: v3-pre
branch: cursor/add-top-level-browser-desktop-agent-preset-ade5
pr_url: "https://github.com/SeeWhatsOn/FDC3-Sail/pull/63"
merged_pr: ""
external_tracker: ""
tags: []
---

## Goal

Make `createBrowserDesktopAgent({ appLauncher, intentResolver, apps, userChannels })` work from the top-level `@finos/sail-desktop-agent` package.

## User or system context

Platform builders need a ready-made browser Desktop Agent path that hides WCP, in-memory transport pairing, and common browser connector setup. Advanced consumers should still be able to inspect or access the underlying composed controller pieces.

## Reference docs

- `plans/prd-desktop-agent-composable-package.md`
- `plans/work-items/promote-desktop-agent-host-contracts.md`
- `packages/sail-desktop-agent/src/browser/browser-desktop-agent.ts`
- `packages/sail-desktop-agent/src/index.ts`
- `packages/sail-desktop-agent/package.json`

## Parent context

The preset path is the high-level counterpart to manual composition. It should create the Desktop Agent, browser connector, transport pair, App Directory seeding, user channels, and intent resolver wiring from one factory call while keeping lifecycle methods available.

## Behavior spec

Given a consumer imports `createBrowserDesktopAgent` from `@finos/sail-desktop-agent`
When they pass `appLauncher`, `intentResolver`, `apps`, and `userChannels`
Then the factory creates a browser Desktop Agent controller with those capabilities wired.

Given apps are passed directly
When the factory creates the Desktop Agent
Then the App Directory is populated without requiring `appDirectories` URLs.

Given multiple intent handlers require user choice
When an `intentResolver` is provided
Then the preset uses it to resolve the valid handler selection.

Given a consumer needs lower-level access
When the factory returns
Then the result exposes lifecycle methods and access to the core Desktop Agent and browser connector.

## Out of scope

- Full source tree move; that is covered by `reorganize-desktop-agent-runtime-folders`.
- Sail layout, workspace, or storage behavior.
- Maintaining `/browser` as a compatibility requirement.

## TypeScript interfaces

Expected shape or equivalent:

```typescript
export interface BrowserDesktopAgentOptions {
  appLauncher?: AppLauncher
  intentResolver?: IntentResolver
  apps?: DirectoryApp[]
  userChannels?: BrowserTypes.Channel[]
}

export interface BrowserDesktopAgent {
  desktopAgent: DesktopAgent
  browserConnector: unknown
  start(): void
  stop(): void
}
```

The connector property name may be finalized during implementation; if `wcpConnector` remains, document why.

## Test guidance

RED phase should cover imports from the top-level package, direct `apps` seeding, and `intentResolver` wiring. Run `npm run typecheck -w @finos/sail-desktop-agent` and focused Vitest coverage for the browser factory.

## Blocked decisions

None.

## Loop history

None.

## Staged for review

None.

## Escalation notes

None.

## Learnings extracted

None.
- 2026-06-02: reconcile-queue.sh — PR merged
