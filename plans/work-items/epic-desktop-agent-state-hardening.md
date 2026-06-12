---
title: "Epic: Desktop Agent state hardening (Option A lifecycle)"
slug: epic-desktop-agent-state-hardening
kind: epic
type: chore
status: approved
loop_count: 0
loop_limit: 3
last_agent: spec-planner
file_manifest: []
depends_on: []
integration_branch: v3-pre
branch: cursor/epic-desktop-agent-state-hardening
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - api
  - fdc3
  - architecture
---

## Goal

Deliver a spec-aligned, single-document `AgentState` model with Option A instance lifecycle, consolidated WCP instance identity routing, pruned dead fields, app-directory function collapse, and documented host reactivity patterns.

## User or system context

Maintainers need production WCP lifecycle semantics, fewer split-brain state paths, and clear integrator guidance for singleton agents and channel selector UI — without preemptive concurrency infrastructure.

## Reference docs

- `plans/prd-desktop-agent-state-hardening.md`
- `website/docs/packages/desktop-agent/integrator-guide.md`
- `website/docs/architecture/channel-selection.md`
- `AGENTS.md` (testing conventions, WCP temp/canonical ids)

## Parent context

See PRD-13. App directory catalog already lives on `AgentState.appDirectory` (v3-pre). This epic wires lifecycle, identity, hygiene, directory collapse, host read audit, and docs as ordered child tasks.

## Behavior spec

_(Epic — see child work items.)_

## Child work items

| Slug | Kind | MoSCoW | depends_on | Status |
|------|------|--------|------------|--------|
| `wire-wcp5-connected-instance-lifecycle` | task | Must | — | approved |
| `consolidate-temp-instance-id-resolver` | task | Must | `wire-wcp5-connected-instance-lifecycle` | approved |
| `remove-dead-instance-state-denormalization` | task | Must | `wire-wcp5-connected-instance-lifecycle` | approved |
| `user-channels-runtime-ssot` | task | Should | — | approved |
| `collapse-app-directory-to-functions` | task | Must | — | approved |
| `audit-host-channel-reactivity-read-apis` | task | Should | `wire-wcp5-connected-instance-lifecycle`, `user-channels-runtime-ssot` | approved |
| `document-desktop-agent-singleton-and-reactivity` | task | Should | `audit-host-channel-reactivity-read-apis` | approved |

**Suggested delivery order:**

1. `wire-wcp5-connected-instance-lifecycle`
2. `consolidate-temp-instance-id-resolver` + `remove-dead-instance-state-denormalization` (parallel)
3. `user-channels-runtime-ssot` + `collapse-app-directory-to-functions` (parallel)
4. `audit-host-channel-reactivity-read-apis`
5. `document-desktop-agent-singleton-and-reactivity`

## Out of scope

- FIFO message queue
- Conformance toolbox burn-down
- sail-web UI redesign

## TypeScript interfaces

none

## Test guidance

Children own RED guidance. Epic validation: `npm test -w @finos/sail-desktop-agent` green after all children done.

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
