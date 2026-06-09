---
title: "Align package README with browser facade API"
slug: align-package-readme-browser-facade-examples
kind: task
type: chore
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/README.md
  - packages/sail-desktop-agent/src/connectors/browser/index.ts
  - packages/sail-desktop-agent/src/connectors/browser/browser-desktop-agent.ts
depends_on:
  - simplify-browser-desktop-agent-facade-api
integration_branch: v3-pre
branch: cursor/align-package-readme-browser-facade-examples
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: []
---

## Goal

Update `@finos/sail-desktop-agent` README and browser module JSDoc so all `createBrowserDesktopAgent` examples use `const desktopAgent = createBrowserDesktopAgent(...)` and link to `docs/browser-edge-and-da.md`.

## User or system context

README still documents `{ desktopAgent, wcpConnector, start }` destructuring. After the facade API lands, examples must match or integrators will copy stale patterns.

## Reference docs

- `packages/sail-desktop-agent/docs/browser-edge-and-da.md`
- `plans/work-items/simplify-browser-desktop-agent-facade-api.md`

## Parent context

Docs-only follow-up to the facade API. `update-consume-sail-desktop-agent-skill` covers the Cursor skill; this item covers the package README and inline JSDoc.

## Behavior spec

Given a reader opens `packages/sail-desktop-agent/README.md`
When they follow the browser preset quick start
Then the example assigns `const desktopAgent = createBrowserDesktopAgent({...})` with no session destructuring.

Given a reader needs the full edge/DA story
When they scan README architecture section
Then it links to `docs/browser-edge-and-da.md`.

Given JSDoc on `createBrowserDesktopAgent` in `browser-desktop-agent.ts` and `connectors/browser/index.ts`
When examples are shown
Then they match the facade return type.

## Out of scope

- Website Docusaurus docs.
- `.cursor/skills/consume-sail-desktop-agent` (separate work item).
- Runtime behavior changes.

## TypeScript interfaces

none

## Test guidance

Docs-only: no executable RED phase. Optional: extend `package-architecture-docs.test.ts` if it asserts README patterns.

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
