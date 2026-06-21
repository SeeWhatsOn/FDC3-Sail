---
title: "Document browser-first Desktop Agent"
slug: document-browser-first-desktop-agent
kind: task
type: chore
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - website/docs/packages/desktop-agent/integrator-guide.md
  - website/docs/packages/desktop-agent/composition.md
  - website/docs/packages/desktop-agent/overview.md
  - packages/sail-desktop-agent/README.md
depends_on:
  - simplify-browser-desktop-agent-preset
integration_branch: v3-pre
branch: cursor/document-browser-first-desktop-agent
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - docs
  - desktop-agent
---

## Goal

Rewrite desktop-agent documentation around browser-first adoption while preserving the WCP `MessagePort` app connection story and deferring remote/distributed deployment.

## User or system context

Integrators should quickly understand: create one browser Desktop Agent per host page, connect web apps through WCP, use grouped host controllers for UI, add native WebSocket support later through an adapter, and treat cross-tab/device sync as future bridge/relay/sync work.

## Reference docs

- `plans/prd-browser-first-desktop-agent-simplification.md`
- `website/docs/packages/desktop-agent/integrator-guide.md`
- `website/docs/packages/desktop-agent/composition.md`
- `packages/sail-desktop-agent/README.md`

## Parent context

Current docs still include remote/server singleton examples and a `createWCPClient` remote DA pattern. The new product direction makes browser-first the default and removes remote Desktop Agent as a normal adoption path.

## Behavior spec

Given an integrator reads the desktop-agent package docs, when they choose the default integration path, then they see `createBrowserDesktopAgent`, WCP `MessagePort` app communication, and grouped controllers as the normal path.

Given an integrator looks for worker/server/multi-device support, when they read the docs, then remote DA deployment is absent, explicitly deferred, or redirected to future bridge/relay/sync architecture.

Given a reader asks whether native apps are still possible, when they read the architecture docs, then native WebSocket protocol support is framed as a future app-connection adapter rather than a reason to remote the core DA.

## Out of scope

- Implementing runtime code changes.
- Adding executable docs contract tests.
- Documenting a full native WebSocket protocol adapter before it exists.

## TypeScript interfaces

None.

## Test guidance

Docs-only: no executable RED phase. Use human review and, if useful, `npm run docs:build -w @finos/sail-docs`.

## Blocked decisions

- Depends on `simplify-browser-desktop-agent-preset` for whether `createWCPClient` is deleted, moved, or described as deferred.

## Loop history

Not started.

## Staged for review

Not staged.

## Escalation notes

None.

## Learnings extracted

None yet.

