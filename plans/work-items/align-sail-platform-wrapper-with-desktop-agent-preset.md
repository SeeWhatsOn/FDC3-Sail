---
title: "Align SailPlatform wrapper with desktop-agent preset"
slug: align-sail-platform-wrapper-with-desktop-agent-preset
kind: task
type: feature
status: pr_awaiting
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-platform-api/src/sail-platform.ts
  - packages/sail-platform-api/src/sail-browser-desktop-agent.ts
  - packages/sail-platform-api/src/interfaces/index.ts
  - packages/sail-platform-api/src/interfaces/intent-resolver.ts
  - packages/sail-platform-api/src/interfaces/channel-selector.ts
  - packages/sail-platform-api/src/index.ts
  - packages/sail-web/src/main.tsx
  - packages/sail-web/src/stores/intent-resolver-store.ts
depends_on:
  - add-top-level-browser-desktop-agent-preset
  - promote-desktop-agent-host-contracts
integration_branch: v3-pre
branch: cursor/align-sail-platform-wrapper-with-desktop-agent-preset-ade5
pr_url: "https://github.com/SeeWhatsOn/FDC3-Sail/pull/65"
merged_pr: ""
external_tracker: ""
tags: []
---

## Goal

Refactor `SailPlatform` to wrap the new desktop-agent preset or primitives instead of duplicating low-level DesktopAgent, WCP connector, and transport wiring.

## User or system context

`@finos/sail-platform-api` is the Sail product shell layer. It may provide layout, workspace, storage, configuration, and product convenience APIs, but should consume `@finos/sail-desktop-agent` for FDC3 engine, host contracts, connector, and preset behavior.

## Reference docs

- `plans/prd-desktop-agent-composable-package.md`
- `plans/work-items/add-top-level-browser-desktop-agent-preset.md`
- `plans/work-items/promote-desktop-agent-host-contracts.md`
- `packages/sail-platform-api/src/sail-platform.ts`
- `packages/sail-platform-api/src/sail-browser-desktop-agent.ts`
- `packages/sail-web/src/main.tsx`

## Parent context

The Desktop Agent package should become the platform-builder package. `SailPlatform` should wrap it for Sail-specific features, not re-own FDC3 host contracts or manually duplicate browser preset assembly.

## Behavior spec

Given `SailPlatform` starts
When it creates the browser Desktop Agent
Then it delegates core WCP/DesktopAgent wiring to `@finos/sail-desktop-agent`.

Given `SailPlatform` provides layout, workspace, config, or storage APIs
When those APIs are used
Then they remain in `@finos/sail-platform-api` and do not move into desktop-agent.

Given Sail UI uses intent and channel hooks
When platform-api exposes them
Then it reuses desktop-agent host contracts where applicable.

## Out of scope

- New layout manager implementation.
- Workspace storage redesign.
- React component redesign.
- Changing FDC3 app-facing semantics.

## TypeScript interfaces

Expected direction:

```typescript
import { createBrowserDesktopAgent, type IntentResolver } from "@finos/sail-desktop-agent"
```

`SailPlatformConfig` should use desktop-agent host contract types where they are generic FDC3 host integration points. Sail-specific wrapper options remain in platform-api.

## Test guidance

RED phase should identify current manual wiring in `SailPlatform.start()`. Delivery should run focused typecheck/tests for `@finos/sail-platform-api` and update Sail web imports or stores only as needed by the wrapper change.

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
