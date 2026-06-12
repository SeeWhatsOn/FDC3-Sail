---
title: "Collapse AppDirectoryManager to query and mutator functions"
slug: collapse-app-directory-to-functions
kind: task
type: chore
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/app-directory/app-directory-queries.ts
  - packages/sail-desktop-agent/src/core/app-directory/fetch-app-directory.ts
  - packages/sail-desktop-agent/src/core/state/mutators/app-directory.ts
  - packages/sail-desktop-agent/src/core/state/mutators/index.ts
  - packages/sail-desktop-agent/src/core/app-directory/app-directory-manager.ts
  - packages/sail-desktop-agent/src/core/desktop-agent.ts
  - packages/sail-desktop-agent/src/core/handlers/types.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/app-handlers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/wcp-handlers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-helpers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-discovery-handlers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-raise-intent.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-raise-intent-for-context.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-raise-shared.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-directory-helpers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-resolver-helpers.ts
  - packages/sail-desktop-agent/src/core/index.ts
  - packages/sail-desktop-agent/test/world/index.ts
  - packages/sail-desktop-agent/test/support/dacp-handler-context.ts
  - packages/sail-desktop-agent/src/core/app-directory/__tests__/app-directory-manager.test.ts
  - packages/sail-desktop-agent/src/core/app-directory/__tests__/app-directory-queries.test.ts
  - packages/sail-desktop-agent/src/core/state/mutators/__tests__/app-directory.test.ts
depends_on: []
integration_branch: v3-pre
branch: cursor/collapse-app-directory-to-functions
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - api
  - fdc3
  - migration
---

## Goal

Replace the state-bound `AppDirectoryManager` class with pure query functions and `AgentState` mutators now that launchable catalog data lives on `state.appDirectory`.

## User or system context

After `move-app-directory-into-agent-state`, the manager is mostly a binding wrapper over `AgentState.appDirectory`. Maintainers want the same functional style as instances, intents, and channels: data on state, behavior as functions — without `bindToState`, standalone fallbacks, or a parallel object on `DACPHandlerContext`.

## Reference docs

- `plans/prd-desktop-agent-state-hardening.md`
- `plans/work-items/epic-desktop-agent-state-hardening.md`
- `plans/work-items/move-app-directory-into-agent-state.md` (landed on v3-pre)
- `packages/sail-desktop-agent/src/core/app-directory/app-directory-manager.ts`
- `packages/sail-desktop-agent/src/core/state/mutators/` (existing mutator pattern)
- `packages/sail-desktop-agent/src/core/state/types.ts` (`AppDirectoryState`)

## Parent context

Follow-up to state-owned app directory. Catalog slice shape stays `{ apps: DirectoryApp[]; directoryUrls: string[] }`. Runtime instances remain in `state.instances`. This item removes the class facade and updates handlers, tests, and public exports to use queries + mutators directly.

## Behavior spec

Given a desktop agent with apps seeded via `config.apps` or `initialState.appDirectory`
When a handler performs app lookup, intent lookup, or directory URL lookup
Then results match the pre-refactor behavior using `getState().appDirectory` and query helpers

Given test or harness code adds apps to the catalog
When apps are added via mutators (not a manager instance)
Then `AgentState.appDirectory.apps` updates and handlers see the same data on the next `getState()` read

Given a remote directory URL is loaded
When `fetchAppDirectory(url)` completes and a mutator merges the result
Then app and intent lookups include fetched apps with the same dedupe policy as today

Given Cucumber or Vitest constructs a desktop agent
When the scenario completes setup with directory apps
Then no `AppDirectoryManager` instance is required on `CustomWorld` or `DACPHandlerContext`

Given external code previously called `desktopAgent.getAppDirectory()`
When this refactor ships
Then a documented replacement exists (read `getState().appDirectory` + exported query/mutator functions) and package exports are updated

## Out of scope

- Changing FDC3 app directory semantics or REST fetch protocol
- Directory polling, refresh scheduling, or background sync
- Renaming `AppDirectoryState` fields
- User-facing behavior changes to findIntent, open, or raiseIntent
- sail-platform-api or sail-web launcher refactors beyond import path updates if needed

## TypeScript interfaces

Keep existing `AppDirectoryState` on `AgentState`. New modules only:

```typescript
// app-directory-queries.ts — pure reads from AppDirectoryState
function retrieveAppsById(catalog: AppDirectoryState, appId: string): DirectoryApp[]
function retrieveAllApps(catalog: AppDirectoryState): DirectoryApp[]
function retrieveIntents(catalog: AppDirectoryState, contextType: string, ...): DirectoryIntent[]

// state/mutators/app-directory.ts — immutable AgentState updates
function addApplications(state: AgentState, apps: DirectoryApp[]): AgentState
function addDirectoryUrl(state: AgentState, url: string): AgentState
function loadDirectoryIntoState(state: AgentState, url: string): Promise<AgentState>
```

Remove `AppDirectoryManager`, `AppDirectoryStateBinding`, and `bindToState` when call sites are migrated. Remove `appDirectory` from `DACPHandlerContext`; handlers use `getState().appDirectory` + queries/mutators via `setState`.

## Test guidance

RED: extend or split tests from `app-directory-manager.test.ts` into `app-directory-queries.test.ts` and `state/mutators/__tests__/app-directory.test.ts`; add handler integration tests proving DACP paths work without `context.appDirectory`. Update Cucumber world to seed via mutators or `config.apps` only.

Assert no remaining production imports of `AppDirectoryManager` except a temporary re-export shim if needed during migration (prefer none — v3 branch need not keep deprecated shims).

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
