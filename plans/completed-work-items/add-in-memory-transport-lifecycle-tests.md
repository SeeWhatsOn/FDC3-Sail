---
title: "Add InMemoryTransport peer lifecycle test coverage"
slug: add-in-memory-transport-lifecycle-tests
merged_pr: "v3-pre@49258ef7 #33"
type: chore
status: done
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/transports/__tests__/in-memory-transport.test.ts
  - packages/sail-desktop-agent/src/browser/browser-desktop-agent.ts
  - packages/sail-desktop-agent/src/browser/__tests__/
depends_on:
  - fix-in-memory-transport-half-open-disconnect
integration_branch: ""
branch: chore/in-memory-transport-lifecycle-tests
pr_url: https://github.com/SeeWhatsOn/FDC3-Sail/pull/33
external_tracker: ""
tags: [fdc3]
---

## Goal

Lock in peer disconnect, post-notification state, and browser agent reuse behavior so transport lifecycle regressions are caught in CI.

## User or system context

Tests still note peer notification as unimplemented while implementation partially notifies without updating peer state. Coverage gaps: peer `onDisconnect`, peer `isConnected()`, sends after disconnect, `createBrowserDesktopAgent()` stop/start.

## Reference docs

- `plans/project-docs.md`
- Depends on disconnect fix behavior from `fix-in-memory-transport-half-open-disconnect`

## Parent context

From `plans/prd-transport-platform-hardening.md`: Harden InMemory/MessagePort transports and replace platform DACP impersonation for reliable disconnect and authority-safe APIs.

## Behavior spec

Given a pair where A disconnects
When tests query B's `isConnected()` and attempt `send` from B
Then B reports disconnected and send fails or is rejected per transport contract

Given `createBrowserDesktopAgent()` started and stopped
When a second agent is created and started
Then DACP handshake or minimal health check succeeds without stale transport state

## Out of scope

- Implementing production fixes (covered by disconnect/send work items).
- Cucumber conformance pack changes unless a scenario already exists.

## TypeScript interfaces

none

## Test guidance

RED: add Vitest cases only; run `npm test -w @finos/sail-desktop-agent` focused on transport and browser-agent test files.

## Blocked decisions

(none)

## Loop history

- 2026-05-29: /ww-reconcile — shipped on v3-pre (49258ef7 #33; test(sail-desktop-agent): InMemoryTransport lifecycle and browser reuse coverage)

- 2026-05-27: approved by human (validation gaps waived)

## Staged for review

## Escalation notes

## Learnings extracted
