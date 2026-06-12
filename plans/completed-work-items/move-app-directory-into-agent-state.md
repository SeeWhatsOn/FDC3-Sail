---
title: "Move app directory into agent state"
slug: move-app-directory-into-agent-state
kind: task
type: chore
status: done
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
file_manifest:
  - packages/sail-desktop-agent/src/core/state/types.ts
  - packages/sail-desktop-agent/src/core/state/initial-state.ts
  - packages/sail-desktop-agent/src/core/app-directory/app-directory-manager.ts
  - packages/sail-desktop-agent/src/core/desktop-agent.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-helpers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-discovery-handlers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-raise-intent.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/app-handlers.ts
  - packages/sail-desktop-agent/src/core/app-directory/__tests__/app-directory-manager.test.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/__tests__/intent-discovery-metadata.test.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/__tests__/app-metadata-desktop-agent.test.ts
depends_on: []
integration_branch: v3-pre
branch: cursor/move-app-directory-into-agent-state
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - api
  - fdc3
---

## Goal

Refactor the desktop agent domain model so launchable app directory data is owned by agent state while runtime app instances remain separate and keyed by `instanceId`.

## User or system context

Maintainers working on FDC3 app discovery, `open`, `raiseIntent`, and instance lifecycle logic need a clearer split between launchable application metadata and connected runtime instances.

## Reference docs

- No PRD path exists; this is a lightweight work item from confirmed chat intent.
- `AGENTS.md`
- `packages/sail-desktop-agent/src/core/app-directory/app-directory-manager.ts`
- `packages/sail-desktop-agent/src/core/state/types.ts`
- `packages/sail-desktop-agent/src/core/state/initial-state.ts`
- `packages/sail-desktop-agent/src/core/desktop-agent.ts`

## Parent context

App directory data should live in desktop agent state, while running app instances stay separate runtime state keyed by `instanceId`. `AppDirectoryManager` should become a helper/service over state-owned app directory data. Intent and open flows should derive targets from directory apps plus running instances without treating launchable app metadata as runtime instance data.

## Behavior spec

Given a desktop agent is created with configured application metadata
When an app lookup or intent lookup is requested
Then the configured application metadata is returned from the same app directory used by runtime handlers

Given a desktop agent app directory has one or more configured directory URLs
When a directory is loaded or replaced
Then app lookups, intent lookups, and directory URL lookups continue to return the same results as before the refactor

Given an application is present in the app directory but has not connected
When a running-instance lookup is requested
Then no app instance is reported until that application connects and receives an instance id

Given multiple directory inputs include the same app id
When those inputs are added or loaded
Then the existing deterministic duplicate policy is preserved for app and intent lookups

Given one app can be launched from the app directory and another matching app is already running
When an intent or open flow asks for available targets
Then launchable apps and running instances can be derived without treating directory apps as runtime instances

## Out of scope

- User-facing behavior changes.
- Directory polling, refresh scheduling, or background synchronization.
- Modeling multiple named app directories unless required by current code.
- Large performance indexing beyond simple app lookup support.
- Broad unrelated FDC3 discovery, intent, open, channel, or lifecycle behavior changes.

## TypeScript interfaces

Expected interface work is limited to the desktop agent state model and app-directory helper boundary.

Likely state shape:

```typescript
interface AgentState {
  appDirectory: AppDirectoryState
  instances: Record<string, AppInstance>
}

interface AppDirectoryState {
  apps: DirectoryApp[]
  directoryUrls: string[]
}
```

## Test guidance

Use focused RED coverage around existing app-directory, app metadata, and intent discovery behavior. Tests should prove that seeded apps, loaded directory URLs, duplicate app ids, app lookup, intent lookup, and running-instance lookup behavior remain externally unchanged after the refactor.

## Blocked decisions

_(empty)_

## Loop history

- 2026-06-12: human approve — implementation committed on `v3-pre` as `2e5f992f3`; archived to completed-work-items.

## Staged for review

**Status:** waiting_on_user (staged 2026-06-12)

### Phase audit
| Phase | Subagent | Registered | Result |
|-------|----------|------------|--------|
| A RED | test-engineer | yes | 12 failing contract tests (expected) |
| B GREEN | implement-agent | yes | 281 Vitest + 25 Cucumber pass |
| B loop-back | implement-agent | yes | bindToState fix for injected manager identity |
| C Verify | verifier-agent | yes | PASS |
| D Review | code-reviewer | yes | VERDICT: PASS |

**ui_surface:** no

### RED evidence
- Test files changed: `app-directory-manager.test.ts`, `app-metadata-desktop-agent.test.ts`, `intent-discovery-metadata.test.ts`
- Command run: `npm test -w @finos/sail-desktop-agent -- src/core/app-directory/__tests__/app-directory-manager.test.ts src/core/handlers/dacp/__tests__/app-metadata-desktop-agent.test.ts src/core/handlers/dacp/__tests__/intent-discovery-metadata.test.ts`
- Failure summary: 12 tests failed asserting `AgentState.appDirectory` missing; 5 behavioral separation tests passed.
- Expected reason: Catalog still owned by standalone `AppDirectoryManager`, not agent state.
- Unrelated tests: healthy

### Commands run
- `npx vitest run` in `@finos/sail-desktop-agent`: **281/281 pass**
- `npx cucumber-js`: **25 scenarios, 312 steps pass** (exit code 1 — pre-existing JUnit/open-handle issue)

### Files changed
- `state/types.ts` — `AppDirectoryState`, `AgentState.appDirectory`
- `state/initial-state.ts` — initialize empty slice
- `app-directory-manager.ts` — state binding + `bindToState()`
- `desktop-agent.ts` — wire manager to state; rebind injected manager
- 3 test files — ownership contract + separation regression tests

### Diff summary
Launchable app catalog (`apps`, `directoryUrls`) now lives on `AgentState.appDirectory`. `AppDirectoryManager` mutates that slice via binding. Injected managers (Cucumber/harness) keep object identity through `bindToState()`. Runtime instances unchanged in `state.instances`.

### Learnings proposed
- **[AGENTS.md candidate]** Launchable app catalog lives on `AgentState.appDirectory`; `AppDirectoryManager` is a mutator/query helper over that slice when bound by `DesktopAgent`. Injected managers must be rebound via `bindToState()`, not copy-replaced.
- **[AGENTS.md candidate]** Cucumber/test harnesses holding a pre-construction `AppDirectoryManager` reference remain valid after `bindToState()` — same object, now backed by agent state.

## Escalation notes

_(empty)_

## Learnings extracted

- Launchable app catalog lives on `AgentState.appDirectory`; `AppDirectoryManager` is a mutator/query helper over that slice when bound by `DesktopAgent`. Injected managers must be rebound via `bindToState()`, not copy-replaced.
- Cucumber/test harnesses holding a pre-construction `AppDirectoryManager` reference remain valid after `bindToState()` — same object, now backed by agent state.
