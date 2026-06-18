---
title: "User channels runtime single source of truth"
slug: user-channels-runtime-ssot
kind: task
type: chore
status: done
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
file_manifest:
  - packages/sail-desktop-agent/src/core/desktop-agent.ts
  - packages/sail-desktop-agent/src/core/state/initial-state.ts
  - packages/sail-desktop-agent/src/core/state/selectors/channel.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/channel-handlers.ts
  - packages/sail-desktop-agent/src/core/__tests__/desktop-agent-user-channels.test.ts
depends_on: []
integration_branch: v3-pre
branch: v3-pre
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - api
  - fdc3
  - user-channels
---

## Goal

Make `state.channels.user` the sole runtime source for user channel metadata; constructor config seeds once at init; handlers and host reads use state selectors only.

## User or system context

Today `DesktopAgent.userChannels` config duplicates `state.channels.user` after initialization. Divergent read paths risk host UI and DACP handlers seeing different channel lists.

## Reference docs

- `plans/prd-desktop-agent-state-hardening.md` (PRD-04g)
- `packages/sail-desktop-agent/src/core/default-user-channels.ts`

## Parent context

State hygiene slice; independent of lifecycle but should land before host reactivity audit.

## Behavior spec

Scenario: User channels readable from agent state after construction
  Given a desktop agent created with a configured user channel list
  When a handler or host API requests user channels
  Then the channel ids and metadata match those seeded into `state.channels.user`

Scenario: Config seeds state only at construction
  Given a desktop agent constructed with custom user channels
  When inspecting runtime state without mutating channels
  Then `state.channels.user` contains exactly the configured channels

## Out of scope

- Runtime add/remove user channel API (FDC3 fixed channels at DA construction)
- sail-web channel selector UI changes

## TypeScript interfaces

none — use existing `AgentState.channels.user`.

## Test guidance

RED: add test that `getUserChannels()` (or replacement API) reads from state not a separate config field. Update any tests asserting `desktopAgent.userChannels` private field. Run channel handler tests and Cucumber user-channel scenarios.

## Blocked decisions

_(empty)_

- 2026-06-18 Phase B GREEN (implement-agent, registered: yes): getUserChannels reads state via getAllUserChannels; removed duplicate field
- 2026-06-18 Phase C Verify (verifier-agent, registered: yes): PASS (scope reconciled)
- 2026-06-18 Phase D Review (code-reviewer, registered: yes): VERDICT: PASS
- 2026-06-18 staged for human review

## Staged for review

**Status:** waiting_on_user (staged 2026-06-18)

### Phase audit
| Phase | Subagent | Registered | Result |
|-------|----------|------------|--------|
| A RED | test-engineer | yes | 2/3 Vitest tests fail (expected) |
| B GREEN | implement-agent | yes | 300 Vitest + 15 Cucumber pass |
| C Verify | verifier-agent | yes | PASS (plans bookkeeping only) |
| D Review | code-reviewer | yes | VERDICT: PASS |

**ui_surface:** no

### RED evidence
- Test file: `desktop-agent-user-channels.test.ts` (new)
- Command: `npm test -w @finos/sail-desktop-agent`
- Failure: `getUserChannels()` returned constructor config copy after `state.channels.user` mutated; DACP handler already used state
- Expected: dual read path bug before fix

### Commands run
- `npm test -w @finos/sail-desktop-agent`: **300 Vitest + 15 Cucumber pass** (exit 0)

### Files changed
- `desktop-agent.ts` — removed `private userChannels`; `getUserChannels()` → `getAllUserChannels(this.state)`
- `desktop-agent-user-channels.test.ts` — 3 regression tests (seeding, SSOT, host/DACP alignment)

### Diff summary
`state.channels.user` is now the sole runtime source. Constructor `userChannels` config seeds state once at init only. Host API and DACP `getUserChannelsResponse` share the same selector path.

### Learnings proposed
- **[AGENTS.md candidate]** `DesktopAgent.getUserChannels()` and DACP `getUserChannelsResponse` both read via `getAllUserChannels(state)`; constructor `userChannels` seeds state once — no runtime instance field.

## Escalation notes

_(empty)_

- 2026-06-18 human approve — user will commit on v3-pre

## Learnings extracted

- `DesktopAgent.getUserChannels()` and DACP `getUserChannelsResponse` both read via `getAllUserChannels(state)`; constructor `userChannels` seeds `state.channels.user` once at init — no runtime instance field.
