---
title: "Document InMemoryTransport runtime and usage constraints"
slug: document-in-memory-transport-constraints
merged_pr: "v3-pre@b1a4dbdf #32"
type: chore
status: done
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/transports/in-memory-transport.ts
  - packages/sail-desktop-agent/src/core/desktop-agent.ts
  - packages/sail-desktop-agent/README.md
depends_on:
  - fix-in-memory-transport-half-open-disconnect
integration_branch: ""
branch: chore/document-in-memory-transport-constraints
pr_url: https://github.com/SeeWhatsOn/FDC3-Sail/pull/32
external_tracker: ""
tags: [fdc3, api]
---

## Goal

Align comments and docs with actual runtime requirements (structuredClone, paired transport, FDC3 control-plane-only) so integrators do not misuse defaults.

## User or system context

File claims "any JS runtime" but requires `structuredClone`. `DesktopAgent` defaults to unpaired `InMemoryTransport()` which cannot send responses; browser factory uses pairs correctly but docs are misleading. Custom guidance: OK for ~30 widgets on control plane; not for market-data fanout.

## Reference docs

- `plans/project-docs.md`
- `plans/prd-transport-platform-hardening.md`

## Parent context

From `plans/prd-transport-platform-hardening.md`: Harden InMemory/MessagePort transports and replace platform DACP impersonation for reliable disconnect and authority-safe APIs.

## Behavior spec

Given a developer reads sail-desktop-agent transport documentation
When they configure DesktopAgent for browser vs. tests
Then docs state: requires structuredClone; browser must use `createInMemoryTransportPair()`; default constructor transport is not for production browser bridge

Given an integrator evaluates Custom-style dashboards
When they read transport guidance
Then FDC3 is described as coordination/control plane, not high-frequency data streaming

## Out of scope

- Code changes to default constructor behavior (docs only unless human expands scope at delivery).
- Performance implementation (batching/backpressure).

## TypeScript interfaces

none

## Test guidance

No new tests required unless docs claim behavior that should be asserted; optional README link check only.

## Blocked decisions

(none)

## Loop history

- 2026-05-29: /ww-reconcile — shipped on v3-pre (b1a4dbdf #32; docs(sail-desktop-agent): document InMemoryTransport runtime constraints)

- 2026-05-27: approved by human (validation gaps waived)

## Staged for review

## Escalation notes

## Learnings extracted
