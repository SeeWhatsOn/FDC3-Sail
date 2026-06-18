---
title: "Collapse AppDirectoryManager to query and mutator functions"
slug: collapse-app-directory-to-functions
kind: task
type: chore
status: done
loop_count: 1
loop_limit: 3
last_agent: implement-agent
file_manifest:
  - packages/sail-desktop-agent/src/core/app-directory/app-directory-queries.ts
  - packages/sail-desktop-agent/src/core/app-directory/fetch-app-directory.ts
  - packages/sail-desktop-agent/src/core/state/mutators/app-directory.ts
  - packages/sail-desktop-agent/src/core/state/mutators/index.ts
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
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-launch-helpers.ts
  - packages/sail-desktop-agent/src/core/index.ts
  - packages/sail-desktop-agent/src/index.ts
  - packages/sail-desktop-agent/src/presets/create-browser-desktop-agent.ts
  - packages/sail-desktop-agent/test/world/index.ts
  - packages/sail-desktop-agent/test/support/dacp-handler-context.ts
  - packages/sail-desktop-agent/test/step-definitions/start-app.steps.ts
  - packages/sail-desktop-agent/src/core/app-directory/__tests__/app-directory-queries.test.ts
  - packages/sail-desktop-agent/src/core/app-directory/__tests__/app-directory-no-manager-imports.test.ts
  - packages/sail-desktop-agent/src/core/app-directory/__tests__/app-directory-agent-state.test.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/__tests__/app-directory-handler-integration.test.ts
  - packages/sail-desktop-agent/src/core/state/mutators/__tests__/app-directory.test.ts
  - packages/sail-web/src/stores/app-directory-store.ts
  - packages/sail-conformance-harness/src/__tests__/harness-instance-correlation.harness.ts
  - website/docs/architecture/channel-selection.md
  - website/docs/packages/desktop-agent/overview.md
depends_on: []
integration_branch: v3-pre
branch: v3-pre
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

- 2026-06-18 Phase B GREEN (implement-agent, registered: yes): queries + mutators; handlers migrated; 328 Vitest + 15 Cucumber pass
- 2026-06-18 Phase C Verify (verifier-agent, registered: yes): VERIFICATION: PASS
- 2026-06-18 Phase D Review (code-reviewer, registered: yes): VERDICT: PASS
- 2026-06-18 human changes: remove legacy AppDirectoryManager, getAppDirectory() facade, and DACPHandlerContext backwards-compat stubs — v3 breaking change OK
- 2026-06-19 Loop 1 GREEN (implement-agent, registered: yes): deleted AppDirectoryManager + manager tests; removed getAppDirectory() and DACPHandlerContext.appDirectory; all call sites use getState().appDirectory + queries/mutators; 279 Vitest + 15 Cucumber pass
- 2026-06-19 follow-up (implement-agent): sail-web app-directory-store → queries/mutators; conformance harness → config.apps; docs (channel-selection, overview layout); rebuild dist; 279 Vitest + 15 Cucumber pass

## Staged for review

**Status:** waiting_on_user (staged 2026-06-19)

### Phase audit
| Phase | Subagent | Registered | Result |
|-------|----------|------------|--------|
| A RED | test-engineer | yes | 5 test files fail (expected) |
| B GREEN | implement-agent | yes | 328 Vitest + 15 Cucumber pass |
| C Verify | verifier-agent | yes | VERIFICATION: PASS |
| D Review | code-reviewer | yes | VERDICT: PASS |
| Loop 1 GREEN | implement-agent | yes | 279 Vitest + 15 Cucumber pass (legacy fully removed) |
| Follow-up | implement-agent | yes | sail-web + harness + docs; 279 Vitest + 15 Cucumber pass |

**ui_surface:** no

### RED evidence
- 5 new/updated test files; missing `app-directory-queries.ts` and `state/mutators/app-directory.ts`; 6 production files still imported `AppDirectoryManager`

### Commands run
- `npm run build -w @finos/sail-desktop-agent`: **pass** (dist exports queries/mutators)
- `npm test -w @finos/sail-desktop-agent`: **279 Vitest + 15 Cucumber pass** (exit 0)

### Diff summary
- **Deleted:** `app-directory-manager.ts`, `app-directory-manager.test.ts`
- **New:** `app-directory-queries.ts`, `fetch-app-directory.ts`, `state/mutators/app-directory.ts`
- **Removed:** `DesktopAgent.getAppDirectory()`, `appDirectoryManager` constructor option, `DACPHandlerContext.appDirectory`
- **Migrated:** DACP + intent handlers, browser preset, Cucumber world/steps read `getState().appDirectory` + query helpers; writes via mutators
- **Follow-up:** `sail-web` store reads `retrieveAllApps(getState().appDirectory)`; URL loads via `replaceDirectoriesInState`; conformance harness seeds `config.apps`; docs updated
- **Exports:** `core/index.ts` exports query/mutator functions instead of `AppDirectoryManager`

### Learnings proposed
- **[AGENTS.md candidate]** App catalog: `getState().appDirectory` + `app-directory-queries` / `state/mutators/app-directory`; do not attach catalog to `DACPHandlerContext`. Cucumber seeds via `DesktopAgent({ apps })` or mutators. Host UI (sail-web) applies async mutators via internal-state pattern — no public `setState` on DesktopAgent.

## Escalation notes

_(empty)_

- 2026-06-18 human pre-approve — user commits on v3-pre

## Learnings extracted

- App catalog: `getState().appDirectory` + `app-directory-queries` / `state/mutators/app-directory`; no `AppDirectoryManager`, no `getAppDirectory()`, no `DACPHandlerContext.appDirectory`. Cucumber seeds via `DesktopAgent({ apps })` or mutators.
