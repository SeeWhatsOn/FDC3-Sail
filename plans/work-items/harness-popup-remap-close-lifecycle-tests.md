---
title: "Harness popup re-key and close lifecycle regression tests"
slug: harness-popup-remap-close-lifecycle-tests
kind: task
type: feature
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-conformance-harness/src/popup-launcher.ts
  - packages/sail-conformance-harness/src/popup-launcher.test.ts
  - packages/sail-conformance-harness/src/harness-browsing-context-close.ts
  - packages/sail-conformance-harness/src/harness-browsing-context-close.test.ts
  - packages/sail-conformance-harness/src/harness-instance-lifecycle.ts
  - packages/sail-conformance-harness/src/harness-instance-lifecycle.test.ts
  - packages/sail-conformance-harness/src/harness-bootstrap.ts
depends_on: []
integration_branch: v3-pre
branch: cursor/harness-popup-remap-close-lifecycle-tests-8a9f
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Add Vitest coverage for harness **popup registry re-key** (`remapPopupByWindow`) and **close lifecycle** so `AppLauncher.close(wcpId)` destroys the browsing context after WCP5 adoption — guarding v6’s remaining ~4 close-context failures.

## User or system context

When launcher pre-registers id `L` but WCP5 adopts canonical id `C`, close paths keyed only on `L` log `"No closable browsing context found"`. `harness-bootstrap.ts` `onAppConnected` should call `remapPopupByWindow`. TV5-01 close-context handshake may still be open; these tests lock in registry + disconnect behavior independent of full toolbox run.

## Reference docs

- `plans/prd-conformance-regression-test-net.md` (RT-05)
- `plans/work-items/fix-harness-finOs-session-teardown.md` (TV5-01)
- `packages/sail-conformance-harness/src/harness-browsing-context-close.ts`
- `packages/sail-conformance-harness/src/popup-launcher.ts`
- `AGENTS.md` (harness teardown, no `window.close` override on real popups)

## Parent context

Child of `epic-conformance-regression-test-net`. **No dependency on RT-01–02** — can start in parallel. Complements TV5-01 manual v6 gate.

## Behavior spec

### Popup re-key

Given popup registered under launcher id `L` with `source` window reference `W`
When `remapPopupByWindow(W, "C")` runs
Then `closePopup("C")` closes the same browsing context
And `closePopup("L")` no longer finds a stale orphan (or is explicitly undefined per API contract)

### Close after WCP connect

Given harness bootstrap wires `onAppConnected` with remap
When mock app connects with canonical id `C` and `metadata.source` window `W`
Then subsequent `closeHarnessBrowsingContext` / `AppLauncher.close(C)` succeeds

### Disconnect on close

Given a connected mock instance `C`
When close lifecycle runs successfully
Then `desktopAgent.disconnectInstance(C)` is invoked (spy in unit test)
And popup watcher stops polling closed window

### FINOS close-context path (unit-level)

Given mock app has `app-control` listener for `closeWindow` context type
When harness broadcasts close context per FINOS teardown shape
Then close handler runs and triggers browsing context teardown hook (assert spy; full 1s budget is manual toolbox)

## Out of scope

- Overriding `window.close` on real browser popups
- sail-web launcher
- Agent DACP close handlers

## TypeScript interfaces

`PopupLauncher.remapPopupByWindow`, `closeHarnessBrowsingContext`, `disconnectHarnessInstance`.

## Test guidance

Extend existing `popup-launcher.test.ts`, `harness-browsing-context-close.test.ts`, `harness-instance-lifecycle.test.ts` — prefer extending over new files unless clarity needs split.

Use jsdom `Window` mocks; `vi.spyOn` on `disconnectInstance`.

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
