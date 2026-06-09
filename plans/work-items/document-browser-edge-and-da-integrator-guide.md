---
title: "Document browser edge and Desktop Agent integrator guide"
slug: document-browser-edge-and-da-integrator-guide
kind: task
type: feature
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/docs/browser-edge-and-da.md
  - packages/sail-desktop-agent/README.md
depends_on: []
integration_branch: v3-pre
branch: cursor/document-browser-edge-and-da-integrator-guide
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Publish `packages/sail-desktop-agent/docs/browser-edge-and-da.md` as the primary integrator guide for browser FDC3 wiring, scoped to `@finos/sail-desktop-agent` only.

## User or system context

Platform builders need one document for the two-box model (browser edge + Desktop Agent), FDC3 2.2 alignment, preset vs manual composition, and debugging instanceId chains — without reading platform-api or harness docs.

## Reference docs

- `plans/prd-desktop-agent-composable-package.md`
- `packages/sail-desktop-agent/docs/browser-edge-and-da.md`
- `packages/sail-desktop-agent/docs/conformance-traceability.md`
- FDC3 2.2: Web Connection Protocol, Browser-Resident Desktop Agents, DACP

## Parent context

Complements `define-desktop-agent-package-architecture` (README + website) with a **package-local** deep guide on WCP edge, lifecycle, `wcpOptions`, and edge-contract tests. Does not document `@finos/sail-platform-api` or `@finos/sail-conformance-harness`.

## Behavior spec

Given a platform builder opens `browser-edge-and-da.md`
When they need to wire a browser desktop
Then the doc explains edge vs DA, `createBrowserDesktopAgent`, manual composition, and `createWCPClient` remote mode.

Given the doc describes WCP3 UI fields
When it references host-controlled channel and intent UI
Then it routes to `host-contracts/` and optional `intentResolver` — not sail-platform-api.

Given the doc lists related docs
When the reader follows links
Then all links stay under `packages/sail-desktop-agent` or FDC3 spec URLs.

## Out of scope

- `website/` Docusaurus pages (covered by `define-desktop-agent-package-architecture`).
- sail-platform-api, sail-web, or harness READMEs.
- Executable tests for markdown.

## TypeScript interfaces

none

## Test guidance

Docs-only: no executable RED phase. Human review that examples match the facade API (`const desktopAgent = createBrowserDesktopAgent(...)`). Link from package README.

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
