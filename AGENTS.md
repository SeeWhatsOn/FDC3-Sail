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
- **App directory catalog** lives on `AgentState.appDirectory` (`apps`, `directoryUrls`); `AppDirectoryManager` mutates/queries that slice via `bindToState()` when wired by `DesktopAgent`. Injected managers (Cucumber/harness) keep object identity through `bindToState()` — do not copy-replace.

### Watson workflow (`plans/`)

Local PRD and work-item queue for `/ww-plan`, `/ww-deliver`, `/ww-approve`, `/ww-reconcile`.

- **Config:** `plans/workflow-config.yaml` (repo defaults). Personal overrides: `plans/local/user-overrides.yaml` (gitignored).
- **Docs:** `plans/WORKFLOW.md` — full lifecycle diagram, skill map, automation tiers, status lifecycle.
- **Skills:** `spec-planner` (plan), `ww-approve` (approve), `ww-deliver` (deliver) in `.cursor/skills/`.
- **Integration branch:** `v3-pre`
- **Plans in git:** `repo.plans.version_in_git: true` — commit work-item status with code when automation tier commits.
- **Queue audit:** `plans/scripts/queue-status.sh`, `plans/scripts/reconcile-queue.sh` (needs `gh` for PR merge detection).

#### Delivery automation tiers

| Tier | Behaviour after Phase D passes |
|------|-------------------------------|
| `stage_only` | Stage files; update work items; **no** commit, push, or PR — human commits manually |
| `commit_push` | On human `approve`: commit + push branch; set `committed` |
| `draft_pr` | On human `approve`: commit + push + open draft PR; set `pr_awaiting` + `pr_url` |

This repo default: `commit_push`. Human chat `approve` always required before commit. Workload may override per PRD `workflow_profile` key.

#### Status lifecycle

```
draft → approved → in-progress → waiting_on_user → committed / pr_awaiting → done
                              ↘ blocked
                              ↘ escalated → dead-letter
```

Full lifecycle + frontmatter fields: `.cursor/skills/ww-work-items/references/status-lifecycle.md`.
PR reconcile procedure: `.cursor/skills/ww-work-items/references/reconcile.md`.
Done items archive to `plans/completed-work-items/`.

#### Plans / git policy

- Always update work item markdown on disk during delivery (`in-progress`, `staged`, etc.).
- Git add `plans/` only when: `repo.plans.version_in_git: true` AND tier is `commit_push` or `draft_pr` AND human approved commit.
- Do not add `plans/` to `.gitignore` automatically — versioning is a project decision.

#### First-run interview (run once if `workflow-config.yaml` missing)

Ask one cluster at a time; skip questions already answered in any partial config:

1. Confirm writing `plans/workflow-config.yaml` to the repository (team defaults).
2. Integration branch — **GUESS:** `v3-pre` (or current branch from git).
3. Version plans in git? Yes (queue state visible in PRs) or No (local only). **Recommended:** yes.
4. Default automation tier: `stage_only` | `commit_push` | `draft_pr` — **GUESS:** `commit_push`.
5. Squash to integration branch after approve? **Default:** no — keep feature branch, merge in GitHub.
6. Branch name template — **GUESS:** `cursor/<descriptive-slug>-8a9f`.
7. Subagent probe at delivery start (`verifier-agent` → `PONG`)? **GUESS:** yes.

After answers write `plans/workflow-config.yaml` then resume the command that triggered setup.

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

- Do not add Vitest or Cucumber tests for README, TSDoc, `website/docs/` markdown, or other documentation; no executable tests that read `.md` or Docusaurus docs as contracts. `npm test` covers FDC3 behavior and library code only. Watson `/ww-plan` and `/ww-deliver` must not prescribe RED tests or documentation contract tests for markdown-only work items (see `.cursor/skills/ww-work-items/references/docs-only-work-items.md`).
- `@finos/sail-desktop-agent` exposes manual composition (transports, host contracts, connectors) and high-level presets; application code imports `createBrowserDesktopAgent` from `@finos/sail-desktop-agent/presets` (top-level re-exports the same factory for convenience). Presets abstract common wiring but must not hide the composition path — returns a coupled `DesktopAgent` (browser edge started/stopped with the agent) with optional `onAppConnected`/`onAppDisconnected`/`onHandshakeFailed` for host lifecycle without exposing `wcpConnector`; docs and manual wiring keep the explicit edge + DA split (`createWCPClient` + remote `DesktopAgent` for server/worker).
- Keep `@finos/sail-desktop-agent` aligned with FDC3 2.2 spec behavior; Sail-specific extensions (e.g. WCP origin allowlists) belong in `@finos/sail-platform-api`, not the core library.
- FDC3-Sail product defaults live in `packages/sail-desktop-agent/src/core/sail-default-config.ts`; `new DesktopAgent(options)` merges them in the constructor (partial `implementationMetadata` overrides are deep-merged). Do not add handler-level `??` fallbacks for implementation metadata.
- `resolveDesktopAgentConfig()` remains exported for tests and pre-built config; app code normally uses `new DesktopAgent({ transport, ... })`, `createBrowserDesktopAgent()`, or `SailPlatform`.
- Product identity (`provider`, `providerVersion`) and branding (`FDC3-Sail`) stay consistent across library and platform layers; `providerVersion` tracks the `@finos/sail-desktop-agent` npm semver; pass overrides through TypeScript factory/config APIs, not env vars or separate JSON/YAML files.
- Keep `@finos/sail-desktop-agent` headless but usable on its own: FDC3 host contracts (`AppLauncher`, `IntentResolver`, `ChannelControl`, app directory, lifecycle events) belong in the core package; `@finos/sail-platform-api` implements those contracts and adds workspace, layout, config, and product shell — pure DA adopters must not need platform-api. Default browser preset uses host-owned intent/channel UI (`IntentResolver`; per-`instanceId` channel chrome via `getAppUserChannelId`/`changeAppChannel`/`channelChanged`); WCP3 iframe injection via `wcpOptions` URLs is optional.
- **Documentation source of truth:** `website/docs/` (Docusaurus) is canonical for all package documentation; npm `README.md` files are brief summaries linking to `https://finos.github.io/FDC3-Sail/docs/...`. Edit `website/docs/packages/` only. When migrating docs off packages, delete old package doc files — do not keep "Moved" redirect stubs; backward compatibility is not required for documentation. Integrator docs use progressive disclosure: package overview = Level 0–1; [integrator guide](website/docs/packages/desktop-agent/integrator-guide.md) = host contracts, deployment fork, WCP/DACP; [composition](website/docs/packages/desktop-agent/composition.md) = Mermaid module diagrams.
- **Docs onboarding audience:** `intro.md` and `getting-started.md` target npm consumers and embedders (pathway chooser: run/host the FDC3 Sail platform vs build your own Desktop Agent in your web app); app developers get a dedicated `website/docs/add-your-app.md` path with Sail-specific setup plus links to official FDC3 API docs. Monorepo clone/`npm run dev` belongs in `development.md`. Position Sail as production-ready for FDC3 workloads; enterprise packaging (identity, governance, hardened distribution) is integrator work. De-emphasize `@finos/sail-platform-api` on adoption paths — most adopters use `@finos/sail-web`/`@finos/sail-electron` or embed `@finos/sail-desktop-agent` directly. Docusaurus `website/sidebars.ts` uses explicit top-level menu order with autogenerated subfolders; main Packages nav lists adopters only (`sail-desktop-agent`, `sail-platform-api`, `sail-web`, `sail-electron`); `@finos/sail-ui` and `@finos/sail-conformance-harness` are linked from `development.md`. `website/docs/architecture/` stays cross-package system maps only; package APIs and implementation detail live under `website/docs/packages/`.
- When burning down FINOS toolbox failures, classify by layer (DesktopAgent/DACP oracle, WCPConnector/MessagePort routing, host launcher, platform/web/Channels UI, BDD assertion gap, or explicit deferral), establish layer attribution before approving conformance work items, and assign a regression owner before closing the epic; `@conformance2.2` BDD is conformance-area alignment, not toolbox oracle equivalence — assert toolbox-checked fields (often from `conformance-appd.json`) and cover browser/WCP paths where the toolbox checks runtime behavior. During `/ww-approve`, explain symptom, root cause, and toolbox oracle before the approve gate — do not assume the user understands why a conformance fix is needed. Block conformance implementation when official FDC3 API reference and conformance oracle conflict without a clear normative rule — seek FINOS clarification before changing agent behavior.
- On `@finos/sail-desktop-agent` v3 refactor work, backward-compatibility shims are not required; remove `@deprecated` re-exports and import from canonical paths (e.g. `host-contracts/`).
- All new Watson workflow skill and agent files belong in the **repo-level `.cursor/` folder** (e.g. `.cursor/skills/`, `.cursor/agents/`), not the user-root `~/.cursor/`; do not modify non-`ww-` skills without alerting the user; orchestrator skills delegate each stage to a focused sub-agent rather than loading all atomic skills in one context. Do not green failing tests by relaxing assertions when RED is intentional for a planned work item — fix the fixture/implementation or tag `@failing` until delivery lands.

## Learned Workspace Facts

- `@finos/sail-conformance-harness` is the clean-room FDC3 toolbox host (port 3001); compare against full Sail stack (`sail-web`, port 3000). Harness disables channel selector UI (`getChannelSelectorUrl: () => false`); channel join uses app `fdc3` API. Root `conformance-appd.json` is the FINOS conformance app directory fixture; root `conformance-report-v*.txt` is the authoritative toolbox release signal. FDC3 2.2 `findIntent` returns flat `AppIntent.apps: AppMetadata[]` (launch rows without `instanceId`, running rows with it; `findInstances` is separate — no nested `instances[]`). `DesktopAgent#findIntent` StartChat example allows duplicate `appId` rows while Intents-Tests `FindIntentAppD` / toolbox enforces `apps.length === 1` for single-app-running — merge policy needs FINOS guidance, not naive same-`appId` dedupe.
- Cucumber `@conformance2.2` (~103 scenarios) uses MockTransport with pre-registered instance ids; green BDD does not prove browser WCP. Only `wcp-desktop-agent.integration.test.ts` exercises the WCP↔DA seam today; toolbox `AppTimeout` clusters need WCP multi-app delivery tests and harness coverage, not more MockTransport channel BDD alone.
- Avoid `import ... with { type: "json" }` in this repo: the TypeScript parser treats `with` as a legacy statement and breaks module parsing (cascading false module-not-found and `error`-typed imports). Use plain `import pkg from "../../package.json"` with `resolveJsonModule`, or `readFileSync(new URL(..., import.meta.url))` in tests.
- This monorepo uses npm workspaces (`npm install`, `npm test`), not pnpm; always install from the repo root — shared dev tooling (TypeScript, Vite, Vitest, ESLint, Prettier, React types) is hoisted in root `package.json`; workspace packages keep only package-specific devDependencies (Cucumber, Playwright); run workspace scripts with `npm run <script> -w <package>`.
- WCP origin allowlisting is not an FDC3 2.2 API surface; FDC3 requires responding to `WCP1Hello` with `WCP2LoadUrl` or `WCP3Handshake`, with identity validation at WCP4 — silent pre-filter reject is Sail policy, not spec behavior.
- `origin/main` retains the legacy package tree (`da-impl`, `web`, `fdc3-example-apps`) and FINOS scorecard/security workflows; `v3-pre` is the v3 refactor integration branch (`sail-*`, `website/`, `plans/`). Sync from `main` with path-scoped `git checkout origin/main -- <paths>` — never take `packages/`, `website/`, `plans/`, or root workspace/tooling wholesale; selectively take `.github/workflows/` (OSPS, scorecard, dependency-review, CodeQL, cve-scanning, semgrep) and issue-template fixes.
- Root `vitest.config.ts` uses Vitest `test.projects` for each workspace package config; Playwright specs under `packages/sail-web/tests/` are excluded from `npm test` — run them with `npx playwright test` or `npm run test:e2e -w @finos/sail-web`.
- Browser FDC3 stack in `connectors/` (integrator guide: `website/docs/packages/desktop-agent/integrator-guide.md`, `@finos/sail-desktop-agent` scope only): `WCPConnector` is the browser edge (WCP1–3, MessagePort per iframe, DACP routing); `DesktopAgent` owns DACP + WCP4/5; `Transport` is one pipe to the DA (not a proxy — `bridgeTransports` bridges per-app MessagePorts to that pipe). `createBrowserDesktopAgent` returns a coupled `DesktopAgent`; `createWCPClient` is edge-only for remote DA; `getBrowserDesktopAgentSession` exposes edge internals for platform/tests. Intent resolution is one host-global flow per DA (`requestId`-correlated); channel membership is per connected `instanceId`, not `appId`. User channels are fixed at DA construction — no public runtime add-channel API; `ChannelControl` is a documented contract shape, not a preset wiring option yet. InMemoryTransport is not the toolbox failure surface — `AppTimeout` points at MessagePort/instanceId routing.
- WCP4 over `InMemoryTransport` (browser preset, conformance harness): do not put `Window` on DACP message meta — `InMemoryTransport.send` uses `structuredClone` and throws `DataCloneError`; store WCP1Hello source windows in `wcp-pending-source-window.ts` keyed by temp `instanceId` and resolve in `wcp-handlers.ts`.
- `website/.docusaurus` is Docusaurus-generated cache (gitignored); `website/build` via root `build`. Docs site: `npm run docs:dev` / `npm run docs:build` (`@finos/sail-docs`); default port 3000 conflicts with `npm run dev` — use `--port 3002` on `npm run start -w @finos/sail-docs`. Mermaid in `website/docs/` requires `@docusaurus/theme-mermaid`, `markdown: { mermaid: true }`, and `themes: ["@docusaurus/theme-mermaid"]` in `website/docusaurus.config.ts`.
- Browser-resident Sail supports FDC3 `getAgent()` via WCP proxy discovery (iframe parent or `window.opener` + MessagePort/DACP), not a host-page `window.fdc3` preload. The iframe/window browsing-context boundary is the micro-frontend app boundary: different teams/frameworks can ship independent apps, while same-page React/Vue components are host UI. Use `SailPlatform`/`DesktopAgent` host APIs for host UI or put FDC3 apps in iframe/window browsing contexts for standard `@finos/fdc3` `getAgent()`; a host-level `window.fdc3` facade would share one page/app identity unless Sail adds a custom component identity layer.
- Watson planning: `ww-prd-breakdown/SKILL.md` is a slim `spec-planner` orchestrator; atomic skills (`interview`, `prd`, `work-breakdown`, `bdd`) live under `.cursor/skills/`; `.cursor/agents/architect-agent.md` drafts ADRs for new services or cross-module ambiguity; `.cursor/agents/spec-agent.md` adds INVEST validation and `bdd` delegation.
