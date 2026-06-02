---
title: "Promote desktop-agent host contracts"
slug: promote-desktop-agent-host-contracts
kind: task
type: feature
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/host-contracts/app-launcher.ts
  - packages/sail-desktop-agent/src/host-contracts/intent-resolver.ts
  - packages/sail-desktop-agent/src/host-contracts/channel-control.ts
  - packages/sail-desktop-agent/src/host-contracts/index.ts
  - packages/sail-desktop-agent/src/index.ts
  - packages/sail-platform-api/src/interfaces/index.ts
  - packages/sail-platform-api/src/interfaces/intent-resolver.ts
  - packages/sail-platform-api/src/interfaces/channel-selector.ts
depends_on:
  - define-desktop-agent-package-architecture
integration_branch: v3-pre
branch: cursor/promote-desktop-agent-host-contracts-8a9f
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: []
---

## Goal

Move or define UI-free host contracts in `@finos/sail-desktop-agent` for app launch, intent resolver, and host channel control.

## User or system context

Consumers should be able to build a usable headless Desktop Agent directly from `@finos/sail-desktop-agent` without depending on Sail product shell packages. `@finos/sail-platform-api` may re-export or wrap these contracts, but it should not be the owner of FDC3 host integration contracts that non-Sail platform builders also need.

## Reference docs

- `plans/prd-desktop-agent-composable-package.md`
- `plans/work-items/define-desktop-agent-package-architecture.md`
- `packages/sail-desktop-agent/src/core/interfaces/app-launcher.ts`
- `packages/sail-desktop-agent/src/core/handlers/types.ts`
- `packages/sail-platform-api/src/interfaces/intent-resolver.ts`
- `packages/sail-platform-api/src/interfaces/channel-selector.ts`

## Parent context

`@finos/sail-desktop-agent` remains UI-free but needs first-class host contracts for FDC3 behaviors that require environment or user/platform choice. App launching and intent resolution belong in the Desktop Agent package as headless capabilities. Sail layout, workspaces, and configuration remain platform-api concerns.

## Behavior spec

Given a platform builder imports from `@finos/sail-desktop-agent`
When they need to provide launch or intent resolver behavior
Then the relevant contracts are available from the top-level package.

Given `@finos/sail-platform-api` needs UI-facing wrappers
When it imports these contracts
Then it reuses desktop-agent types instead of defining parallel equivalents.

Given channel chrome is host-owned
When host channel-control types are exposed
Then they describe UI-free channel read/change requests without moving Sail-specific UI into desktop-agent.

## Out of scope

- Implementing a new layout manager.
- Moving React components or Zustand stores.
- Changing FDC3 channel or intent semantics.

## TypeScript interfaces

Expected interfaces or equivalent names:

```typescript
export interface AppLauncher { /* existing launch contract */ }
export interface IntentResolver { /* host selection contract */ }
export interface ChannelControl { /* host channel read/change contract, if needed */ }
```

Exact names may be refined during delivery, but the ownership boundary must remain in `@finos/sail-desktop-agent`.

## Test guidance

RED phase should prove that current contracts are split across packages or not top-level exported as desired. Add or update type-level/export tests where this repo already uses them, and run focused typecheck for `@finos/sail-desktop-agent` and `@finos/sail-platform-api`.

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
