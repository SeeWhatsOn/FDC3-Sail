---
title: "User channels runtime single source of truth"
slug: user-channels-runtime-ssot
kind: task
type: chore
status: approved
loop_count: 0
loop_limit: 3
last_agent: spec-planner
file_manifest:
  - packages/sail-desktop-agent/src/core/desktop-agent.ts
  - packages/sail-desktop-agent/src/core/state/initial-state.ts
  - packages/sail-desktop-agent/src/core/state/selectors/channel.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/channel-handlers.ts
depends_on: []
integration_branch: v3-pre
branch: cursor/user-channels-runtime-ssot
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

## Loop history

_(empty)_

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
