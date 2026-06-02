# AGENTS.md

## Cursor Cloud specific instructions

### Overview

FDC3 Sail v3 is an npm workspaces monorepo implementing the FDC3 financial desktop interoperability standard. It provides a browser-based desktop agent for FDC3 app discovery, context sharing, intent resolution, and channel management.

### Node.js version

The project requires **Node.js >= 24** and **npm >= 11** (see `engines` in root `package.json`). Use `nvm use 24` before running any commands.

### Key commands

All commands from the repo root — see `package.json` `scripts` for the full list:

- **Install**: `npm install`
- **Build**: `npm run build`
- **Dev server**: `npm run dev` (starts desktop-agent, platform-api, server, and web concurrently on port 3000)
- **Tests**: `npm test` (runs Vitest; Cucumber BDD tests in `sail-desktop-agent` run via `npm test -w @finos/sail-desktop-agent`)
- **Lint**: `npm run lint`
- **Format check**: `npm run format`
- **Type check**: `npm run typecheck`
- **Full validation**: `npm run validate`

### Workspace packages

| Package | Path | Purpose |
|---|---|---|
| `@finos/sail-desktop-agent` | `packages/sail-desktop-agent` | Core FDC3 Desktop Agent logic (library) |
| `@finos/sail-ui` | `packages/sail-ui` | Shared React/Tailwind UI component library |
| `@finos/sail-platform-api` | `packages/sail-platform-api` | Sail platform middleware (library) |
| `@finos/sail-web` | `packages/sail-web` | Main Vite+React web application (port 3000) |
| `@finos/sail-server` | `packages/sail-server` | Backend server (stub/WIP) |
| `@finos/sail-electron` | `packages/sail-electron` | Electron desktop wrapper (optional, requires GUI) |
| `@finos/sail-docs` | `website` | Docusaurus documentation site |

### Known pre-existing issues on v3-pre branch

- **Electron build fails**: `sail-electron` has an unresolved import (`./sail-desktop-agent-proxy`). This package is optional and not needed for web-based development.
- **Playwright tests fail in Vitest**: Two Playwright spec files under `packages/sail-web/tests/` get picked up by Vitest and fail. These are meant to be run by Playwright separately (`npx playwright test`), not Vitest.
- **ESLint has many pre-existing errors**: ~9400+ errors mostly from `import/order` rule due to `eslint-import-resolver-typescript` misconfiguration (resolves against wrong path `apps/sail-web` instead of `packages/sail-web`).
- **Prettier has pre-existing formatting issues**: ~250 files, mostly in `website/.docusaurus/` generated files.

### Dev server notes

- `npm run dev` starts 4 concurrent processes (desktop-agent watch, platform-api watch, server, web Vite dev). The web UI is on **port 3000**.
- Individual FDC3 apps listed in the App Directory (e.g. Portfolio Management) require their own backend servers; they will show connection errors if those servers aren't running. The core Sail desktop agent shell works independently.
- No database or Docker is required — all state is in-memory/browser.

### Testing conventions (`@finos/sail-desktop-agent`)

- **Do not add test-only methods to production types** (e.g. `DesktopAgent`, handlers, transports). No `*ForTesting` helpers, no exposing private handler context builders for Cucumber/Vitest.
- **Prefer production APIs in BDD** when exercising real behavior (e.g. `desktopAgent.disconnectInstance(instanceId)` for disconnect cleanup — same path as WCP6 goodbye / heartbeat timeout).
- **Unit / BDD harnesses** live under `src/**/__tests__/` and `packages/sail-desktop-agent/test/`:
  - `createDACPTestContext()` in `src/core/handlers/dacp/__tests__/test-context.ts` for isolated Vitest handler tests.
  - `test/support/agent-state.ts` — `applyDesktopAgentStateUpdate()` for Cucumber fixture setup only (not part of the public API).
  - `test/support/dacp-handler-context.ts` — `createHandlerContextForWorld()` when a step must call DACP handlers with the agent’s real pending-intent map.
  - `CustomWorld.updateState()` delegates to `applyDesktopAgentStateUpdate`; prefer `disconnectInstance()` or DACP messages when testing production paths.
- **Test-only cleanup hooks** belong next to the code under test (e.g. `clearAllHeartbeatTimersForTesting()` in `heartbeat-runtime.ts`), not on `DesktopAgent`.
- **WCP4 temp vs WCP5 canonical ids:** During identity validation, DACP handler `context.instanceId` may still be the temp connection id while `startHeartbeat` and `state.heartbeats` use the canonical WCP5 `instanceId`. Disconnect cleanup must resolve the canonical id (see `resolveCleanupInstanceId` in `cleanup.ts`). `startHeartbeat` registers `temp-{uuid}` → canonical via `linkWcpTempInstanceId` in `heartbeat-runtime.ts` (required when multiple instances have active heartbeats — do not rely on the single-active-heartbeat heuristic alone). Unlink on `stopHeartbeat`. Cucumber: register `connectionId → lastWcp5ValidatedInstanceId` on `MockTransport` after WCP validate; use canonical id for liveness, goodbye, and disconnect steps.
- **WCP instance identity registry:** Inner `instanceIdentityRegistry` maps must be pruned in `cleanupDACPHandlers` (same paths as `removeInstance`); failed WCP4 does not add entries.
- **Host channel chrome (platform-api):** Read per-instance channel with `SailPlatform.getAppUserChannel` → `DesktopAgent.getAppUserChannelId`; set with `changeAppChannel` via typed connector transport — not `sendDACPMessageOnBehalfOf`.
- **InMemoryTransport tests:** Prefer `vi.waitFor` on observable counters over wall-clock sleeps; keep `flushAsyncDelivery()` (`setTimeout(0)`) for single-hop async.
- **DACP error enum tests:** Table-driven Vitest in `dacp/__tests__` complements Cucumber; `ListenerNotFound` is a valid conformance payload though not in `@finos/fdc3` `ChannelError` enum.
- **FDC3 default user channels** are defined once in `src/core/default-user-channels.ts` as `DEFAULT_FDC3_USER_CHANNELS`. Production, Vitest, and Cucumber (`generic.steps` / `CustomWorld.initializeDesktopAgent`) import that constant directly — feature files use spec IDs (`fdc3.channel.1`, …).

### Watson workflow (`plans/`)

Local PRD and work-item queue for `/ww-plan`, `/ww-deliver`, `/ww-approve`, `/ww-reconcile`.

- **Config:** `plans/workflow-config.yaml` (repo defaults). Load via skill `ww-workflow-config` before any ww command. Personal overrides: `plans/local/user-overrides.yaml` (gitignored).
- **Docs:** `plans/WORKFLOW.md` — automation tiers, status lifecycle, reconcile.
- **Queue audit:** `plans/scripts/queue-status.sh`, `plans/scripts/reconcile-queue.sh` (needs `gh` for PR merge detection).
- **Delivery tiers:** `stage_only` (no commit/PR) | `commit_push` | `draft_pr`. Plans and code follow the same tier; when `repo.plans.version_in_git: true`, commit work-item status with code.
- **Statuses:** `approved` → `in-progress` → `staged` / `waiting_on_user` → `committed` / `pr_awaiting` → `done`. Run `/ww-reconcile` after merging PRs so `pr_awaiting` becomes `done`; done items move to `plans/completed-work-items/`.
- **First run:** If `workflow-config.yaml` is missing, the agent runs a short interview once, writes the file, then continues.

### Cucumber tags (`packages/sail-desktop-agent`)

Tags are for **filtering and classification**, not for wiring hooks. Global teardown (timer reset) lives in `test/support/hooks.ts` and runs after every scenario.

| Tag | Use |
|-----|-----|
| `@conformance2.2` | Scenario maps to the FDC3 2.2 conformance / interop test pack for that API area. Prefer this over inventing new version tags unless a **2.3+** pack appears. |
| `@failing` | Known-broken; excluded by default (`cucumber.yml`: `not @failing`). Run with profile `failing` while fixing. |
| `@wip` | Incomplete scenario; exclude from CI until ready (add to default tag expression when used). |
| `@slow` | Long waits or timing-sensitive (optional filter for local runs). |

**Functional area tags** (optional, for targeted runs): `@user-channels`, `@app-channels`, `@private-channels`, `@intents`, `@broadcast`, `@heartbeat`, `@disconnect`, `@apps`, `@wcp`. Apply at feature or scenario level when you need `cucumber-js --tags '@intents'`.

**Do not use** priority-style tags (`@p0`, `@p0-cleanup`) for infrastructure — they do not describe FDC3 behavior. Cleanup assertions belong in steps (`Then no heartbeat timers are active`); process hygiene belongs in `After` hooks.

**Optional features** (when bridging or similar lands): `@optional-bridging`, aligned with `implementationMetadata.optionalFeatures` in the agent.

## Learned User Preferences

- Do not add Vitest or Cucumber tests for README, TSDoc, or other documentation; `npm test` covers FDC3 behavior and library code only. Watson `/ww-plan` and `/ww-deliver` must not prescribe RED tests or documentation contract tests for markdown-only work items (see `.cursor/skills/ww-work-items/references/docs-only-work-items.md`).
- `@finos/sail-desktop-agent` exposes both manual composition (transports, host contracts, connectors) and high-level presets (e.g. browser desktop agent); presets abstract common wiring but must not hide the composition path.
- Keep `@finos/sail-desktop-agent` aligned with FDC3 2.2 spec behavior; Sail-specific extensions (e.g. WCP origin allowlists) belong in `@finos/sail-platform-api`, not the core library.
- FDC3-Sail product defaults live in `packages/sail-desktop-agent/src/core/sail-default-config.ts`; `new DesktopAgent(options)` merges them in the constructor (partial `implementationMetadata` overrides are deep-merged). Do not add handler-level `??` fallbacks for implementation metadata.
- `resolveDesktopAgentConfig()` remains exported for tests and pre-built config; app code normally uses `new DesktopAgent({ transport, ... })` or `createBrowserDesktopAgent()` / `SailPlatform`.
- Product identity (`provider`, `providerVersion`) should not use a separate JSON/YAML config file or CI env override; pass overrides through TypeScript factory/config APIs.
- `providerVersion` tracks `@finos/sail-desktop-agent` `package.json` version so deployed npm semver and `getInfo()` stay in lock step.
- Provider branding stays `FDC3-Sail` across library and platform layers unless a caller explicitly overrides metadata in config.
- Keep `@finos/sail-desktop-agent` headless but usable on its own: FDC3-required host capabilities such as app launch, intent resolution, app directory access, channel state, and instance/connection registry belong as core package contracts; broader layout, workspace, configuration, storage, and product shell concerns belong in `@finos/sail-platform-api`.
- When burning down FINOS toolbox failures, classify each category (product bug, BDD assertion gap, MockTransport/WCP integration gap, platform/web gap, or explicit deferral) and assign a regression owner before closing the epic — product fixes alone are insufficient.
- `@conformance2.2` BDD means conformance-area alignment, not FINOS toolbox oracle equivalence; assert toolbox-checked fields (often from `conformance-appd.json`) and cover browser/WCP paths where the toolbox checks runtime behavior.
- On `@finos/sail-desktop-agent` v3 refactor work, backward-compatibility shims are not required; remove `@deprecated` re-exports and import from canonical paths (e.g. `host-contracts/`).

## Learned Workspace Facts

- `@finos/sail-conformance-harness` is the clean-room FDC3 toolbox host (port 3001); compare its runs against the full Sail stack (`sail-web`, port 3000) to separate desktop-agent bugs from platform/web UI.
- Root `conformance-appd.json` is the FINOS conformance app directory fixture loaded by the harness for toolbox runs.
- Cucumber `@conformance2.2` scenarios use MockTransport with pre-registered instance ids; green BDD does not prove real browser WCP or cross-origin iframe identity — toolbox `AppTimeout` / launch→validate failures need harness or bdd-wcp integration coverage.
- Avoid `import ... with { type: "json" }` in this repo: the TypeScript parser treats `with` as a legacy statement and breaks module parsing (cascading false module-not-found and `error`-typed imports). Use plain `import pkg from "../../package.json"` with `resolveJsonModule`, or `readFileSync(new URL(..., import.meta.url))` in tests.
- This monorepo uses npm workspaces (`npm install`, `npm test`), not pnpm; docs and scripts should match npm.
- WCP origin allowlisting is not an FDC3 2.2 API surface; FDC3 requires responding to `WCP1Hello` with `WCP2LoadUrl` or `WCP3Handshake`, with identity validation at WCP4 — silent pre-filter reject is Sail policy, not spec behavior.
- Completed Watson work items move to `plans/completed-work-items/` when status is `done` (ww-work-items archive flow).
- Root `vitest.config.ts` uses Vitest `test.projects` for each workspace package config; Playwright specs under `packages/sail-web/tests/` are excluded from `npm test` — run them with `npx playwright test` or `npm run test:e2e -w @finos/sail-web`.
- `@finos/sail-desktop-agent` target `src/` top-level folders: `core`, `host-contracts`, `protocols`, `transports`, `connectors`, `presets`; browser WCP integration belongs under `connectors/`, not a top-level `browser/` folder.
- WCP4 over `InMemoryTransport` (browser preset, conformance harness): do not put `Window` on DACP message meta — `InMemoryTransport.send` uses `structuredClone` and throws `DataCloneError`; store WCP1Hello source windows in `wcp-pending-source-window.ts` keyed by temp `instanceId` and resolve in `wcp-handlers.ts`.
