---
title: "Document browser-first Desktop Agent"
slug: document-browser-first-desktop-agent
kind: task
type: chore
status: draft
last_agent: ""
file_manifest:
  - website/docs/packages/desktop-agent/integrator-guide.md
  - website/docs/packages/desktop-agent/composition.md
  - website/docs/packages/desktop-agent/overview.md
  - packages/sail-desktop-agent/README.md
depends_on:
  - collapse-browser-app-connection-into-desktop-agent
integration_branch: v3-pre
branch: cursor/document-browser-first-desktop-agent
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: []
---

## Goal

Rewrite desktop-agent documentation around `DesktopAgent` as the browser-resident DA runtime while preserving the WCP `MessagePort` app connection story and deferring remote/distributed deployment.

## User or system context

Integrators should quickly understand: create one `DesktopAgent` per browser host page, connect web apps through WCP and per-app `MessagePort`, use grouped host controllers for UI, add native app support later through an explicit adapter, and treat cross-tab/device sync as future bridge/relay/sync work.

## Reference docs

- `plans/prd-browser-first-desktop-agent-simplification.md`
- `website/docs/packages/desktop-agent/integrator-guide.md`
- `website/docs/packages/desktop-agent/composition.md`
- `packages/sail-desktop-agent/README.md`

## Parent context

Current docs and recently staged BFDA-06 wording still describe browser-first adoption through a browser preset / edge-link composition. The updated direction makes `DesktopAgent` itself the browser-resident runtime; WCP/MessagePort is the app boundary, not a separate connector product.

## Behavior spec

Given an integrator reads the desktop-agent package docs, when they choose the default integration path, then they see `DesktopAgent` as the browser-resident DA runtime with WCP `MessagePort` app communication and grouped controllers as the normal path.

Given an integrator looks for worker/server/multi-device support, when they read the docs, then remote DA deployment is absent, explicitly deferred, or redirected to future bridge/relay/sync architecture.

Given a reader asks whether native apps are still possible, when they read the architecture docs, then native WebSocket protocol support is framed as a future app-connection adapter rather than a reason to remote the core DA.

Given a reader sees WCP or app connection internals, when they read the docs, then `WCPConnector`, `BrowserDaEdgeLink`, and `Transport` are not presented as normal host composition concepts.

## Out of scope

- Implementing runtime code changes; BFDA-08 owns the runtime refactor.
- Adding executable docs contract tests.
- Documenting a full native WebSocket protocol adapter before it exists.

## TypeScript interfaces

None.

## Test guidance

Docs-only: no executable RED phase. Use human review and, if useful, `npm run docs:build -w @finos/sail-docs`.

## Blocked decisions

None. Direction updated 2026-06-22: docs should wait for BFDA-08 and describe DA-owned browser app connection, not browser preset / edge-link composition.

## Loop history

- 2026-06-22: Delivery loop 1 — code review FAIL (public export accuracy); loop 2 implement fix; verification PASS; review PASS.
- 2026-06-22: Superseded before human commit by architecture direction update. BFDA-06 reset to draft and moved after BFDA-08.

## Staged for review

Not staged. Previous staged docs delivery was superseded by the 2026-06-22 decision to make `DesktopAgent` own the browser app connection runtime.

## Escalation notes

None.

## Learnings extracted

None yet.

