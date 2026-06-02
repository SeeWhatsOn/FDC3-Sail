---
title: "Remove unused intents.history dead code"
slug: cap-intents-history
merged_pr: "v3-pre@cabeb3c2 #36"
kind: task
type: chore
status: done
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/state/types.ts
  - packages/sail-desktop-agent/src/core/state/mutators/intent.ts
  - packages/sail-desktop-agent/src/core/state/mutators/index.ts
  - packages/sail-desktop-agent/src/core/state/selectors/intent.ts
  - packages/sail-desktop-agent/src/core/state/selectors/index.ts
  - packages/sail-desktop-agent/src/core/state/selectors/stats.ts
  - packages/sail-desktop-agent/src/core/state/initial-state.ts
depends_on: []
integration_branch: ""
branch: cursor/remove-intents-history-398c
pr_url: https://github.com/SeeWhatsOn/FDC3-Sail/pull/36
external_tracker: ""
tags: [fdc3]
---

## Goal

Remove `intents.history`, `IntentResolutionRecord`, `recordIntentResolution`, and related selectors — not required by FDC3 2.2 and never wired in production.

## User or system context

FDC3 returns `IntentResolution` to the raising app per call; the agent does not need a durable resolution log in `AgentState`. Observability belongs in OTEL/log pipelines, not unbounded in-memory history.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 3 — superseded by removal)
- FDC3 2.2 `api/ref/Metadata.md` (`IntentResolution`)

## Parent context

From `plans/prd-desktop-agent-conformance-gaps.md`: Close lifecycle cleanup, conformance evidence, validation boundaries, and test trust before P1 sign-off and v3 release.

## Behavior spec

Given agent state initialization and intent raise/resolve flows
When code is updated
Then `AgentState.intents` has only `listeners` and `pending`
And no exports reference `recordIntentResolution` or history selectors

## Out of scope

- OTEL instrumentation for intent resolution events (future observability work).
- Capping or persisting resolution history elsewhere.

## TypeScript interfaces

none

## Test guidance

Run `npm test -w @finos/sail-desktop-agent` and `npm run typecheck -w @finos/sail-desktop-agent`.

## Blocked decisions

None.

## Loop history

- 2026-05-29: /ww-reconcile — shipped on v3-pre (cabeb3c2 #36; feat(sail-desktop-agent): ww-deliver batch — log redaction, intents contract tests (+ #21 65e32914))

- 2026-05-27: revised from cap/TTL to full removal per human gate
- 2026-05-27: approved by human
