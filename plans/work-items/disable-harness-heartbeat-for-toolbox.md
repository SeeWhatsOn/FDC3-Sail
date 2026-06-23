---
title: "Disable harness heartbeat for toolbox runs"
slug: disable-harness-heartbeat-for-toolbox
kind: task
type: chore
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-conformance-harness/src/harness-bootstrap.ts
  - packages/sail-conformance-harness/src/main.test.ts
  - packages/sail-conformance-harness/README.md
depends_on: []
integration_branch: v3-pre
branch: cursor/disable-harness-heartbeat-for-toolbox-8a9f
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Set `heartbeatEnabled: false` in conformance harness `DesktopAgent` bootstrap config (matching Cucumber `CustomWorld` default) and add a unit test so toolbox runs do not kill Conformance1 mid-pack via heartbeat timeout.

## User or system context

Cucumber scenarios opt into heartbeat explicitly (`A desktop agent with heartbeat checking`). Harness bootstrap may still enable heartbeat by default, causing Conformance1 disconnect during long toolbox runs — contributing to open-with-context hangs and stale state. RT-07 is a small config guard with high operational value.

## Reference docs

- `plans/prd-conformance-regression-test-net.md` (RT-07)
- `packages/sail-conformance-harness/src/harness-bootstrap.ts`
- `packages/sail-desktop-agent/test/support/hooks.ts` / Cucumber world init
- `AGENTS.md` (heartbeat scenarios opt-in)

## Parent context

Child of `epic-conformance-regression-test-net`. Independent of RT-01–06; safe to pick up anytime.

## Behavior spec

Given conformance harness creates `DesktopAgent` via bootstrap factory
When inspecting resolved config
Then `heartbeatEnabled` is `false`

Given heartbeat is disabled in harness
When a full manual toolbox run executes
Then Conformance1 is not disconnected solely due to agent heartbeat timeout (manual verification note in PR)

## Out of scope

- Changing default heartbeat in production `default-config.ts` for non-harness adopters
- Heartbeat interval tuning
- Cucumber heartbeat scenarios (remain opt-in)

## TypeScript interfaces

`DesktopAgent` constructor options / `resolveDesktopAgentConfig`.

## Test guidance

Assert config in `main.test.ts` or dedicated bootstrap test — read `heartbeatEnabled` from agent config accessor if public, or spy constructor options.

Document in `packages/sail-conformance-harness/README.md` one line: toolbox assumes heartbeat off; enable only for dedicated heartbeat scenarios.

Run:

```bash
npm test -w @finos/sail-conformance-harness
```

## Blocked decisions

_(empty)_

## Loop history

- 2026-06-22: approved by human

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
