---
title: "Update conformance harness desktop-agent API usage"
slug: update-conformance-harness-desktop-agent-api
kind: task
type: feature
status: pr_awaiting
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-conformance-harness/src/main.tsx
  - packages/sail-conformance-harness/src/intent-resolver-wiring.ts
  - packages/sail-conformance-harness/src/app-launcher.ts
  - packages/sail-conformance-harness/README.md
depends_on:
  - add-top-level-browser-desktop-agent-preset
  - promote-desktop-agent-host-contracts
integration_branch: v3-pre
branch: cursor/update-conformance-harness-desktop-agent-api-ade5
pr_url: "https://github.com/SeeWhatsOn/FDC3-Sail/pull/66"
merged_pr: ""
external_tracker: ""
tags: []
---

## Goal

Update `@finos/sail-conformance-harness` to consume the new top-level `@finos/sail-desktop-agent` preset and host contracts.

## User or system context

The conformance harness is a clean-room FDC3 toolbox host and should exercise the same public Desktop Agent package surface that external platform builders consume. It should validate that the top-level browser preset supports programmatic launch, App Directory seeding, user channels, and intent resolution.

## Reference docs

- `plans/prd-desktop-agent-composable-package.md`
- `plans/work-items/add-top-level-browser-desktop-agent-preset.md`
- `plans/work-items/promote-desktop-agent-host-contracts.md`
- `packages/sail-conformance-harness/src/main.tsx`
- `packages/sail-conformance-harness/src/intent-resolver-wiring.ts`
- `packages/sail-conformance-harness/src/app-launcher.ts`

## Parent context

The harness currently imports `createBrowserDesktopAgent` from `@finos/sail-desktop-agent/browser`, adds App Directory data after construction, and wires intent resolution directly through `WCPConnector` events. After the package refactor, it should use top-level exports and the new preset options where possible.

## Behavior spec

Given the conformance harness bootstraps the Desktop Agent
When it imports Sail desktop-agent APIs
Then it imports the browser preset and related types from `@finos/sail-desktop-agent` top-level exports.

Given the harness provides app launch and programmatic intent resolution
When `createBrowserDesktopAgent` is called
Then `appLauncher`, `intentResolver`, `apps`, and `userChannels` are passed through the preset API instead of manual post-construction wiring where possible.

Given the harness starts
When the Conformance1 iframe calls `getAgent()`
Then WCP/DACP behavior remains equivalent to the current harness flow.

## Out of scope

- Changing conformance assertions.
- Reworking harness UI.
- Adding new toolbox coverage unrelated to import/API migration.

## TypeScript interfaces

Expected imports should come from top-level `@finos/sail-desktop-agent` after the preset work lands:

```typescript
import { createBrowserDesktopAgent, DEFAULT_FDC3_USER_CHANNELS, type AppLauncher, type DirectoryApp } from "@finos/sail-desktop-agent"
```

Exact import grouping may vary based on the final export names.

## Test guidance

RED phase should show the harness still depends on `/browser` imports and manual App Directory/intent wiring. Delivery should run the harness package typecheck/build or the nearest available focused validation, and preserve existing harness startup behavior.

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
