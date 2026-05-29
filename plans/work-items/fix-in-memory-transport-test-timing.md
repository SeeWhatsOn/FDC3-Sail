---
title: "Replace fixed sleeps in in-memory transport tests"
slug: fix-in-memory-transport-test-timing
kind: spike
type: chore
status: waiting_on_user
branch: cursor/fix-in-memory-transport-test-timing-f2c8
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/transports/__tests__/in-memory-transport.test.ts
depends_on: []
integration_branch: ""
branch: spike/in-memory-transport-test-timing
external_tracker: ""
tags: []
---

## Goal

Investigate and replace `setTimeout(200)` (and similar) in in-memory transport tests with explicit promise-based synchronization (P2-05).

## User or system context

Fixed sleeps hide races and slow CI; compliance review flagged optional cleanup.

## Reference docs

- `plans/prd-desktop-agent-release-p2.md` (P2-05)

## Parent context

From `plans/prd-desktop-agent-release-p2.md`: Post-P1 hardening — logging redaction, README/package alignment, metadata defaults, and test hygiene.

## Behavior spec

**Phase 1 (spike)**

Given the current `in-memory-transport.test.ts` timing-dependent cases
When analyzed
Then document which cases need event hooks vs queue drain API

**Phase 2 (optional follow-up task)**

Given Phase 1 recommendation
When tests are refactored
Then no test relies on arbitrary wall-clock sleep for correctness

## Out of scope

- InMemoryTransport product behavior changes unless spike proves a bug

## TypeScript interfaces

none

## Test guidance

Spike output: short note in work item `## Loop history` or PR description; follow-up task if code change is non-trivial.

## Blocked decisions

Whether `InMemoryTransport` needs a public `flush()` or `whenIdle()` helper for tests.

## Loop history

- 2026-05-27: approved by human (validation gaps waived)
