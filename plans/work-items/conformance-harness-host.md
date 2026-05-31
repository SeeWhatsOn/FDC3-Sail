---
title: "Conformance harness host (React + sail-desktop-agent only)"
slug: conformance-harness-host
kind: task
type: feature
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-conformance-harness/
  - packages/sail-conformance-harness/package.json
  - packages/sail-conformance-harness/vite.config.ts
  - packages/sail-conformance-harness/index.html
  - packages/sail-conformance-harness/src/main.tsx
  - packages/sail-conformance-harness/src/App.tsx
  - packages/sail-conformance-harness/src/app-launcher.ts
  - packages/sail-conformance-harness/src/intent-resolution.ts
  - packages/sail-conformance-harness/src/types.ts
  - conformance-appd.json
  - conformance-test-failure-review.md
  - package.json
depends_on: []
integration_branch: v3-pre
branch: feature/conformance-harness-host
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3, ui]
---

## Goal

Add a minimal React host that wires **only** `@finos/sail-desktop-agent` (browser agent + WCP) to run the **full FINOS FDC3 conformance toolbox**, so failures can be attributed to the agent/WCP path vs `@finos/sail-web` / `@finos/sail-platform-api` without product UI pollution.

## User or system context

**Who:** Maintainer debugging toolbox results locally (not CI for v1).

**Why now:** `conformance-report-v2.txt` shows 18 pass / 56 fail on the full Sail stack; in-repo Cucumber (`@conformance2.2`) is largely green on `MockTransport`. The gap points at browser integration (WCP, launcher `instanceId`, intent UI, launch context), documented in `conformance-test-failure-review.md`.

**How it is used:**

1. Start harness dev server (fixed port, document in package README).
2. Harness auto-loads **Conformance1** in the first iframe.
3. Run the toolbox inside Conformance1 as today on sail-web.
4. Compare export/results with a sail-web run — same `conformance-appd.json`.

**Confirmed intent (2026-05-31, interview-me):** Diagnostic clean room only; no CI gate yet; no sail-platform-api; no channel selector UI; logic-only intent resolution (picker UI later); context delivery via agent open-with-context only (no URL/postMessage context hack in v1).

## Reference docs

- `conformance-test-failure-review.md` — failure attribution and resolution directions
- `conformance-appd.json` — conformance app directory (shared with sail-web)
- `packages/sail-web/src/main.tsx` — anti-patterns to avoid (`void context`, SailPlatform)
- `packages/sail-desktop-agent/src/browser/browser-desktop-agent.ts` — `createBrowserDesktopAgent`
- `packages/sail-desktop-agent/src/core/interfaces/app-launcher.ts` — `AppLauncher` contract
- `packages/sail-desktop-agent/src/core/handlers/dacp/utils/open-with-context.ts` — agent delivers launch context (no URL required)
- `packages/sail-desktop-agent/src/browser/wcp/wcp1-3-handshake.ts` — cross-origin `window.name` / `hostIdentifier` limits
- `packages/sail-desktop-agent/docs/conformance-traceability.md` — BDD coverage vs toolbox
- Related (not blocking): `plans/work-items/bdd-wcp-integration-scenario.md` — in-package WCP Vitest; harness is **manual toolbox over real browser**

## Parent context

This work item implements the **harness** recommendation from `conformance-test-failure-review.md` §5–6. It does **not** replace fixing sail-web or agent bugs; it isolates them.

**Success for the workload:**

| Harness | sail-web | Interpretation |
|---------|----------|----------------|
| Pass | Fail | Integration layer (web / platform launcher glue) |
| Fail | Fail | Likely agent, WCP, or shared appd/instance-id issue |
| Pass | Pass | Area healthy end-to-end |

## Architecture (v1)

```text
┌─────────────────────────────────────────────────────────┐
│  packages/sail-conformance-harness (Vite + React)       │
│  - createBrowserDesktopAgent() on load                │
│  - Inline AppLauncher → append {instanceId,appId,url}   │
│  - Programmatic requestIntentResolution callback        │
│  - React state: panels[] → div + iframe(name=instanceId)│
│  - No @finos/sail-platform-api                        │
│  - No @finos/sail-web / @finos/sail-ui                │
└──────────────────────────┬──────────────────────────────┘
                           │ WCP postMessage / MessagePort
                           ▼
┌─────────────────────────────────────────────────────────┐
│  @finos/sail-desktop-agent (DesktopAgent + WCPConnector)│
└──────────────────────────┬──────────────────────────────┘
                           │ DACP
                           ▼
┌─────────────────────────────────────────────────────────┐
│  iframes: Conformance1 + apps opened via fdc3.open/     │
│  raiseIntent (URLs from conformance-appd.json)          │
└─────────────────────────────────────────────────────────┘
```

### Dependency boundary

| Package | Allowed in harness? |
|---------|---------------------|
| `@finos/sail-desktop-agent` | **Yes** (only production dep) |
| `@finos/sail-platform-api` | **No** |
| `@finos/sail-web` | **No** |
| `@finos/sail-ui` | **No** |
| `conformance-appd.json` | **Yes** (import/copy at build; same file as sail-web) |

### Instance identity (critical path)

FDC3 open-with-context registers pending delivery on the **`instanceId` returned by `AppLauncher.launch()`**. WCP4 may assign a **new** UUID on first connect unless reconnect reuse succeeds (`wcp-handlers.ts`).

Harness **must** ensure launcher `instanceId`, iframe `name`, and WCP5 canonical `instanceId` align. Document chosen approach in package README. Candidate strategies (pick one, verify with open-with-context toolbox tests):

1. **Pre-register** pending instance in agent state before iframe `src` loads (if API allows without violating “no test-only production APIs”).
2. **WCP4 reconnect:** app sends `instanceId` / `instanceUuid` in WCP4 payload matching launcher id (depends on get-agent + host; cross-origin may not read `window.name` — see `wcp1-3-handshake.ts`).
3. **Agent/host contract change** (separate work item if harness proves need): host-assigned id becomes canonical at WCP5.

Do **not** mask misalignment with URL context or parent `postMessage` context injection in v1.

### Launch context

Per `AppLauncher` interface, **desktop agent delivers** launch context after the app adds `addContextListener`. Harness creates iframe only; does not implement a parallel context channel.

### Intent resolution (logic only)

Wire `requestIntentResolution` on `DesktopAgent` / `createBrowserDesktopAgent` options:

1. If request includes an unambiguous **target** (`appId` / `instanceId`) → select it.
2. If exactly **one** valid handler → auto-select.
3. If **multiple** handlers → deterministic tie-break **documented in harness** (e.g. prefer running instance, then directory order); log choice to console for debugging.
4. **No modal UI in v1** — optional picker is future work.

Goal: automated toolbox is not blocked by `UserCancelledResolution` from an unresolved picker. Align with FDC3 conformance expectations per test (targeted raise vs multi-app). Fail loudly in console when tie-break is ambiguous if that helps attribution.

## Behavior spec

### Bootstrap

Given the harness dev server is running  
When the user opens the harness root URL  
Then `createBrowserDesktopAgent` has started and is listening for WCP1Hello  
And exactly one iframe is mounted for **Conformance1** (`conformance-appd.json`)  
And no other app iframes exist until opened by the framework  

### Dynamic open

Given Conformance1 or another connected app calls `fdc3.open` (with or without context)  
When the desktop agent invokes `AppLauncher.launch`  
Then the harness appends a panel to React state `{ instanceId, appId, url, title? }`  
And renders a new `div` containing an `iframe` with `src` from app directory and `name={instanceId}`  
And does **not** pre-open a fixed grid of apps  

### No platform-api / web shell

Given the harness package manifest  
When inspecting `dependencies`  
Then only `@finos/sail-desktop-agent` (and dev tooling: react, vite, etc.) are used for FDC3 wiring  
And `@finos/sail-platform-api` and `@finos/sail-web` are absent  

### App directory

Given `conformance-appd.json` at repo root  
When the harness starts  
Then all conformance applications are registered on the desktop agent app directory (same set sail-web merges today)  

### Intent resolution

Given a `raiseIntent` / `raiseIntentForContext` path that requires user resolution in sail-web  
When the harness handles `requestIntentResolution`  
Then resolution completes without a visible UI using the logic rules in **Intent resolution** above  
And the toolbox is not left waiting indefinitely for a human click  

### Styling

Given the harness UI  
When rendered  
Then layout is unstyled/minimal (bare divs, iframes, optional debug text listing open panels)  
And no sail-ui or Tailwind product chrome is required  

### Channel selector

Given conformance tests for user/app channels  
When run from the toolbox  
Then no harness channel-selector UI is shown (channels exercised via FDC3 API inside conformance apps only)  

### Close / cleanup (minimal v1)

Given a panel iframe is removed from React state (optional: manual “close” debug control or app disconnect)  
When the instance disconnects via WCP  
Then agent cleanup runs as today; harness removes stale panel from state if applicable  

## Implementation phases (suggested order)

| Phase | Deliverable | Toolbox signal |
|-------|-------------|----------------|
| **A — Scaffold** | `packages/sail-conformance-harness`, workspace entry, `npm run dev`, agent starts | Conformance1 loads, `getAgent` works |
| **B — Launcher + panels** | `AppLauncher`, dynamic iframes, instance id strategy documented | `fdc3.open` tests start passing vs v2 |
| **C — Intent resolve** | Programmatic `requestIntentResolution` | `basicRI*`, raiseIntent resolver tests improve |
| **D — Burn-down** | Fix agent/harness issues revealed; update `conformance-test-failure-review.md` notes | Compare v3 report to v2 |

Phases A–B may land in one PR if small; do not claim “done” until full toolbox has been run once and results recorded (filename optional: `conformance-report-harness-v1.txt` in repo root or artifact in `## Staged for review`).

## Out of scope

- CI job or PR gate running the toolbox against harness
- Replacing sail-web as the product shell
- `@finos/sail-platform-api` (including `SailPlatform`, `SailAppLauncher`, origin allowlist wiring)
- Channel selector / intent resolver **UI** (future enhancement)
- URL hash / query / `postMessage` launch-context shortcuts
- Same-origin proxy of `fdc3.finos.org` apps (unless required to unblock WCP; if so, spin **child spike**)
- Electron / `sail-electron`
- Fixing all toolbox failures in one work item (harness may expose follow-up agent tasks)

## TypeScript interfaces

Harness-local (not exported as public API):

```typescript
/** Single hosted conformance app surface */
export type HarnessPanel = {
  instanceId: string
  appId: string
  url: string
  title?: string
}

/** React state shape */
export type HarnessState = {
  panels: HarnessPanel[]
}
```

Implement `AppLauncher` from `@finos/sail-desktop-agent` in `app-launcher.ts` (signature per `AppLauncher.launch(request, appMetadata)`).

Intent resolution callback type: use `IntentResolutionCallback` / payload types from desktop-agent browser or core exports (no duplicate schema).

## Test guidance

**Primary acceptance:** Manual FINOS FDC3 conformance toolbox run against harness URL; capture pass/fail summary comparable to `conformance-report-v2.txt`.

**Optional (later):**

- Playwright smoke: Conformance1 iframe loads, `window.fdc3` or getAgent handshake completes
- Vitest unit tests for tie-break logic in `intent-resolution.ts` (pure functions)

**Not required for v1:** Cucumber scenarios in `sail-desktop-agent` (remain MockTransport); duplicate of `bdd-wcp-integration-scenario.md`.

**RED phase (if automating tie-break):** table-driven cases — single handler, targeted instance, two handlers with one running.

## Dev ergonomics

- Script at repo root or package: `npm run dev -w @finos/sail-conformance-harness` (or documented equivalent)
- Fixed port (e.g. 3001) to avoid clashing with sail-web `3000`
- Console logging: panel add/remove, intent resolution choice, WCP connect/disconnect (`debug: true` on agent)
- README section: “Attribution workflow” linking to `conformance-test-failure-review.md`

## Blocked decisions

| # | Question | Default if no answer |
|---|----------|----------------------|
| 1 | Package name: `sail-conformance-harness` vs `sail-fdc3-harness`? | `@finos/sail-conformance-harness` |
| 2 | Dev port | `3001` |
| 3 | Instance-id strategy when cross-origin blocks `window.name` | Implement B with logging; file spike if toolbox still AppTimeout-heavy |
| 4 | Commit `conformance-report-harness-*.txt` to repo? | No — paste summary in work item `## Staged for review` only |

## Relationship to other work items

| Slug | Relationship |
|------|----------------|
| `bdd-wcp-integration-scenario` | Complementary — automated Vitest WCP in agent package; harness is manual toolbox |
| `conformance-traceability-map` | BDD map; harness exercises real browser path |
| `extend-cleanup-source-and-open-with-context` | Agent cleanup; harness stress-tests open-with-context |
| Agent fixes from `conformance-test-failure-review.md` (metadata, displayName, errors) | May be done in parallel; harness validates independently of sail-web |

## Loop history

- 2026-05-31: approved by human (/ww-approve conformance-harness-host)

## Staged for review

_(empty — populate after delivery with: dev command, port, instance-id approach chosen, toolbox pass/fail counts vs v2, sample attribution conclusions)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty — after delivery, consider AGENTS.md note on conformance harness port and attribution workflow)_
