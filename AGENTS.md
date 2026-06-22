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
- **Oxlint type-aware warnings**: root `vite.config.ts` `lint.options.typeCheck` may surface correctness warnings on legacy patterns during Vite+ migration burn-down.

### Dev server notes

- `npm run dev` starts 4 concurrent processes (desktop-agent watch, platform-api watch, server, web Vite dev). The web UI is on **port 3000**.
- Individual FDC3 apps listed in the App Directory (e.g. Portfolio Management) require their own backend servers; they will show connection errors if those servers aren't running. The core Sail desktop agent shell works independently.
- No database or Docker is required — all state is in-memory/browser.

### Testing conventions (`@finos/sail-desktop-agent`)

- **Do not add test-only methods to production types** (e.g. `DesktopAgent`, handlers, transports). No `*ForTesting` helpers, no exposing private handler context builders for Cucumber/Vitest.
- **Prefer production APIs in BDD** when exercising real behavior (e.g. `desktopAgent.disconnectInstance(instanceId)` for disconnect cleanup — same path as WCP6 goodbye / heartbeat timeout).
- **Unit / BDD harnesses** live under `src/**/__tests__/` and `packages/sail-desktop-agent/test/`:
  - `createDACPTestContext()` in `src/handlers/__tests__/test-context.ts` for isolated Vitest handler tests (`MockTransport` as `DacpResponseDispatcher` only — not on `DesktopAgent`).
  - `test/support/dacp-test-app-connection.ts` — `DacpTestAppConnection` implements the app-edge contract for Cucumber/Vitest; `createDesktopAgentWithTestConnection()` / `wireDacpTestAppConnection()` attach it via `DesktopAgent.attachAppConnection()`.
  - `test/support/agent-state.ts` — `applyDesktopAgentStateUpdate()` for Cucumber fixture setup only (not part of the public API).
  - **Cucumber config:** `cucumber.yml` only (`paths: test/features`); do not add a legacy `.cucumber` features path (duplicate path merge). **Never mock `globalThis.crypto.randomUUID` in `CustomWorld`** — Cucumber assigns test-case ids via `crypto.randomUUID`; a per-scenario counter caused duplicate ids and only ~15 of 168 scenarios to execute.
  - `test/support/dacp-handler-context.ts` — `createHandlerContextForWorld()` when a step must call DACP handlers with the agent’s real pending-intent map.
  - `CustomWorld.updateState()` delegates to `applyDesktopAgentStateUpdate`; prefer `disconnectInstance()` or DACP messages when testing production paths.
- **Test-only cleanup hooks** belong next to the code under test (e.g. `clearAllHeartbeatTimersForTesting()` in `heartbeat-runtime.ts`), not on `DesktopAgent`.
- **WCP4 handshake routing vs WCP5 instance id:** During identity validation, DACP handler `context.instanceId` may still be the handshake routing id while `startHeartbeat` and `state.heartbeats` use the validated WCP5 `instanceId`. Disconnect cleanup must resolve the validated id (see `resolveCleanupInstanceId` in `cleanup.ts`). WCP5 success registers `handshakeRoutingId` → `instanceId` on `state.wcpHandshakeRouting` via `linkHandshakeRoutingId` (required when multiple instances have active heartbeats — do not rely on the single-active-heartbeat heuristic alone). Clear routing entries on disconnect via `clearHandshakeRoutingIdsForInstance`. Coupled browser preset: `BrowserAppConnection.bindAgentState()` reads/writes the same slice. Cucumber: `DacpTestAppConnection.onHandshakeRoutingLinked` mirrors links onto agent state; use validated `instanceId` for liveness, goodbye, and disconnect steps.
- **WCP instance identity registry:** Inner `instanceIdentityRegistry` maps must be pruned in `cleanupDACPHandlers` (same paths as `removeInstance`); failed WCP4 does not add entries.
- **Host channel chrome (platform-api):** Read per-instance channel with `SailPlatform.getAppUserChannel` → `DesktopAgent.getAppUserChannelId`; set with `changeAppChannel` via typed connector transport — not `sendDACPMessageOnBehalfOf`.
- **InMemoryTransport tests:** Prefer `vi.waitFor` on observable counters over wall-clock sleeps; keep `flushAsyncDelivery()` (`setTimeout(0)`) for single-hop async.
- **DACP error enum tests:** Table-driven Vitest in `handlers/__tests__` complements Cucumber; `ListenerNotFound` is a valid conformance payload though not in `@finos/fdc3` `ChannelError` enum.
- **FDC3 default user channels** are defined once in `src/default-user-channels.ts` as `DEFAULT_FDC3_USER_CHANNELS`. Production, Vitest, and Cucumber (`generic.steps` / `CustomWorld.initializeDesktopAgent`) import that constant directly — feature files use spec IDs (`fdc3.channel.1`, …).

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
Done work item files are **deleted** after delivery; the parent PRD **Work item retention** section and `plans/project-docs.md` **Delivered work index** are the durable record. Completed PRD files are also deleted when superseded (not moved to archive folders).

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
| `@fdc3_2.0` | Scenario exercises FDC3 2.0 Desktop Agent API behavior (channels, intents, open, broadcast base cases). Often combined with `@fdc3_2.2` / `@fdc3_3.0` via feature inheritance. |
| `@fdc3_2.2` | Scenario is in scope for FDC3 2.2 (including 2.2-only APIs: `addEventListener`, `ContextMetadata`, `MalformedContext`, `PrivateChannel.addEventListener`, etc.). Apply at **feature** level when all scenarios qualify; scenarios inherit this tag. |
| `@fdc3_3.0` | Scenario is in scope for FDC3 3.0. All 2.2 API scenarios also carry this tag at feature level except `@fdc3_3.0`-only APIs (`fdc3.close()` / `closeRequest` in `close.feature`). **Multiple version tags on one scenario are supported** — e.g. `@fdc3_2.2 @fdc3_3.0` on the feature line tags every scenario for both version filters. |
| `@failing` | Known-broken; excluded by default (`cucumber.yml`: `not @failing`). Run with profile `failing` while fixing. |
| `@wip` | Incomplete scenario; exclude from CI until ready (add to default tag expression when used). |
| `@slow` | Long waits or timing-sensitive (optional filter for local runs). |

**Version filter profiles** (`cucumber.yml`): `fdc3-2.0`, `fdc3-2.2`, `fdc3-3.0` — e.g. `npx cucumber-js --profile fdc3-2.2`.

**Functional area tags** (optional, for targeted runs): `@user-channels`, `@app-channels`, `@private-channels`, `@intents`, `@broadcast`, `@heartbeat`, `@disconnect`, `@apps`, `@wcp`. Apply at feature or scenario level when you need `cucumber-js --tags '@intents'`.

**Do not use** priority-style tags (`@p0`, `@p0-cleanup`) for infrastructure — they do not describe FDC3 behavior. Cleanup assertions belong in steps (`Then no heartbeat timers are active`); process hygiene belongs in `After` hooks.

**Optional features** (when bridging or similar lands): `@optional-bridging`, aligned with `implementationMetadata.optionalFeatures` in the agent.

## Learned User Preferences

- Do not add Vitest or Cucumber tests for README, TSDoc, `website/docs/` markdown, or other documentation; no executable tests that read `.md` or Docusaurus docs as contracts. `npm test` covers FDC3 behavior and library code only. Watson `/ww-plan` and `/ww-deliver` must not prescribe RED tests or documentation contract tests for markdown-only work items (see `.cursor/skills/ww-work-items/references/docs-only-work-items.md`).
- `@finos/sail-desktop-agent` browser-first path: one `DesktopAgent` per host page owns WCP listener lifecycle and internal `BrowserAppConnection` — not a separate composable `WCPConnector`, `BrowserConnectionBackend`, or browser-path `Transport`/`BrowserDaEdgeLink`/`DaOwnedAppConnectionRouter` hop. FDC3-aligned internals: `BrowserAppConnection` (WCP1–3 + lifecycle), `AppConnectionRegistry` (`instanceId` → MessagePort); reject generic “backend” and public `WCPConnector` naming. Host entry: `createBrowserDesktopAgent` from the package root (`agent/`). Lower-level browser primitives (`BrowserAppConnection`, `MessagePortTransport`) live in `app-connection/` and `@finos/sail-desktop-agent/browser`, not host composition. Public `createWCPClient` remote-DA preset was removed (BFDA-02) — no supported server/worker-hosted DA adoption path on `v3-pre`. Grouped host controllers (`intentResolver`, `channels`, `apps`) and session wiring stay thin in `agent/`; keep `appLauncher` as a host-provided option callback, not a returned `AppLauncher` surface. Browser preset `apps.disconnect(instanceId)` for host teardown; do not add `apps.close()` — FDC3 v3.0 `fdc3.close()` stays app-initiated via optional `AppLauncher.close`. Full-agent Vitest/Cucumber use `createDesktopAgentWithTestConnection()` (`DacpTestAppConnection`); handler-only tests use `createDACPTestContext()`.
- Keep `@finos/sail-desktop-agent` aligned with FDC3 2.2 spec behavior; Sail-specific extensions (e.g. WCP origin allowlists) belong in `@finos/sail-platform-api`, not the core library. Prepare FDC3 3.0 incrementally on one DACP handler tree (optional wire fields, `@fdc3_3.0` BDD); do not split `handlers/v2` vs `v3`. npm package `3.0.0-pre.x` semver ≠ `getInfo().fdc3Version` (`"2.2"` until 3.0 conformance lands).
- FDC3-Sail product defaults live in `packages/sail-desktop-agent/src/agent/default-config.ts`; `new DesktopAgent(options)` deep-merges them in the constructor (no handler-level `??` fallbacks). `resolveDesktopAgentConfig()` stays exported for tests; app code uses `new DesktopAgent({ ... })` + `attachAppConnection`, `createBrowserDesktopAgent()`, or `SailPlatform`. Product identity (`provider`, `providerVersion`, `FDC3-Sail` branding) stays consistent across library and platform; `providerVersion` tracks `@finos/sail-desktop-agent` npm semver via TypeScript factory/config APIs, not env vars or JSON/YAML files.
- Keep `@finos/sail-desktop-agent` headless but usable on its own: FDC3 host contracts (`AppLauncher`, `IntentResolver`, `ChannelControl`, app directory, lifecycle events) belong in the core package; `@finos/sail-platform-api` implements those contracts and adds workspace, layout, config, and product shell — pure DA adopters must not need platform-api. Intent resolver UI is for DA/platform builders, not FDC3 app developers: preserve app-facing FDC3 2.2 behavior, bypass resolver UI for explicit `AppIdentifier` and unambiguous matches, and expose browser-host ergonomics as framework-agnostic `onRequest`/`select`/`cancel` style helpers over a host-control transport rather than React- or browser-connection-specific UI APIs. Official DACP/WCP wire types use `BrowserTypes` from `@finos/fdc3`; deep `@finos/fdc3-schema/dist/generated/api/BrowserTypes` only for runtime validators. Sail host UI adapter types (`HostIntentResolver*`) belong in `host-contracts/`; Sail-internal DACP resolver callbacks in `handlers/intent-resolution-callback.ts` — not in `app-connection/wcp/` or generic handler `types.ts`. Do not route host shell UI through `Fdc3UserInterfaceResolve` (injected-iframe flow); channel selector UI should follow the same host-contract controller pattern.
- **Documentation source of truth:** `website/docs/` (Docusaurus) is canonical for all package documentation; npm `README.md` files are brief summaries linking to `https://finos.github.io/FDC3-Sail/docs/...`. Edit `website/docs/packages/` only. When migrating docs off packages, delete old package doc files — do not keep "Moved" redirect stubs; backward compatibility is not required for documentation. Integrator docs use progressive disclosure: package overview = Level 0–1; [integrator guide](website/docs/packages/desktop-agent/integrator-guide.md) = host contracts, deployment fork, WCP/DACP; [composition](website/docs/packages/desktop-agent/composition.md) = Mermaid module diagrams.
- **Docs onboarding audience:** `intro.md` and `getting-started.md` target npm consumers and embedders (pathway chooser: run/host the FDC3 Sail platform vs build your own Desktop Agent in your web app); app developers get a dedicated `website/docs/add-your-app.md` path with Sail-specific setup plus links to official FDC3 API docs. Monorepo clone/`npm run dev` belongs in `development.md`. Position Sail as production-ready for FDC3 workloads; enterprise packaging (identity, governance, hardened distribution) is integrator work. De-emphasize `@finos/sail-platform-api` on adoption paths — most adopters use `@finos/sail-web`/`@finos/sail-electron` or embed `@finos/sail-desktop-agent` directly. `website/docs/architecture/` stays cross-package system maps only; package APIs and implementation detail live under `website/docs/packages/`.
- For GitHub Actions workflows, prefer official platform tools (`gh release create` with `--generate-notes`) over third-party release actions when the step only needs a title and generated notes on an existing tag; npm monorepo releases use pinned `changesets/action` (`.github/workflows/release.yml`) instead of manual scoped-tag workflows. Pin `actions/*` by full commit SHA and verify each SHA resolves from its release tag via `gh api` before merge.
- Release and Changesets workflow changes (`.changeset/`, `.github/workflows/release.yml`, maintainer publish docs) belong in the `FDC3-Sail-sync-main-infra` git worktree on branch `sync/main-infra` (merge to `main`), not in the v3-pre integration repo. Contributors do not add changesets; maintainers batch weekly on `main` via `npm run changeset` (or backfill on merge).
- When burning down FINOS toolbox failures, classify by layer (DesktopAgent/DACP oracle, WCPConnector/MessagePort routing, host launcher, platform/web/Channels UI, BDD assertion gap, or explicit deferral), establish layer attribution before approving conformance work items, and assign a regression owner before closing the epic; `@fdc3_2.2` BDD is conformance-area alignment, not toolbox oracle equivalence — assert toolbox-checked fields (often from `conformance-appd.json`) and cover browser/WCP paths where the toolbox checks runtime behavior. Classify toolbox `(GetInfo2)` as open-with-context + popup MetadataApp + app-control delivery (same cluster as `AOpensBWithContext*`); GetInfo1 green does not exculpate `getInfo` for GetInfo2. During `/ww-approve`, explain symptom, root cause, and toolbox oracle before the approve gate — do not assume the user understands why a conformance fix is needed. Block conformance implementation when official FDC3 API reference and conformance oracle conflict without a clear normative rule — seek FINOS clarification before changing agent behavior.
- On `@finos/sail-desktop-agent` v3 refactor work, backward-compatibility shims are not required unless the human explicitly asks for them — delete legacy classes/facades (e.g. removed `AppDirectoryManager`, `getAppDirectory()`), `@deprecated` re-exports, and “migration facade” APIs; no thin redirect modules “until adopters migrate”. Import and name APIs for what they are (e.g. `host-contracts/`, `app-directory-queries.ts`, `handshakeRoutingId` → `instanceId`). Test-only `*ForTesting` cleanup hooks next to the code under test remain allowed. When implementing in `packages/*/src/**`, follow `.cursor/rules/minimal-implementation.mdc` (YAGNI ladder, no unrequested abstractions); conformance/BDD/Watson/docs-only carve-outs still apply.
- All new Watson workflow skill and agent files belong in the **repo-level `.cursor/` folder** (e.g. `.cursor/skills/`, `.cursor/agents/`), not the user-root `~/.cursor/`; do not modify non-`ww-` skills without alerting the user; orchestrator skills delegate each stage to a focused sub-agent rather than loading all atomic skills in one context (`ww-prd-breakdown/SKILL.md` orchestrates; atomic `interview`/`prd`/`work-breakdown`/`bdd` skills live under `.cursor/skills/`; `architect-agent` drafts ADRs; `spec-agent` adds INVEST validation). Do not green failing tests by relaxing assertions when RED is intentional for a planned work item — fix the fixture/implementation or tag `@failing` until delivery lands. `/ww-deliver` on `v3-pre` with per-task human `approve`; repo default automation tier is `stage_only` (stage files + update work items, no agent commit/push) — human commits manually unless a workload overrides to `commit_push`/`draft_pr`. Done work item markdown files are **deleted** after delivery; durable record is PRD Work item retention + `plans/project-docs.md`. Before each staged human gate, orchestrator must pass format, lint, typecheck, and `npm run validate` (pre-review gate) — do not present staged delivery with known lint or type errors. During multi-item delivery, ship **one approved work item at a time** and pause for human review/commit before the next unless the user says done/next; run targeted tests per changed area.

## Learned Workspace Facts

- `@finos/sail-conformance-harness` is the clean-room FDC3 toolbox host (port 3001); compare against full Sail stack (`sail-web`, port 3000). Harness dev: `npm run dev -w @finos/sail-conformance-harness` runs `tsdown --watch` for `@finos/sail-desktop-agent` concurrently with Vite — no separate DA build during harness work; Vite picks up `node_modules/@finos/sail-desktop-agent/dist` changes. Layout: Conformance1 runs in an iframe; mock apps with `hostManifests.sail.forceNewWindow` open in popup tabs (correct FINOS layout). Instance lifecycle: pre-register host `instanceId` before WCP4 (`registerPendingHostInstance`); disconnect on popup close/WCP6. FINOS scenario teardown: Conformance1 broadcasts `closeWindow` on `app-control` → mock returns close context → mock calls `fdc3.close()`; FDC3 v3.0 `closeResponse` `ApiTimeout` is expected success when the app is destroyed. Harness disables channel selector UI; channel join uses app `fdc3` API. `packages/sail-conformance-harness/conformance-appd.json` is the FINOS app directory fixture; toolbox exports and attribution live under `packages/sail-conformance-harness/results/` (`conformance-report-v*.txt`, `conformance-test-failure-review.md`). Default Sail web demo app directory: `packages/sail-web/fixtures/default-app-directory.json` (not repo root). Toolbox `(GetInfo2)` is open-with-context to popup MetadataApp + app-control callback, not a standalone `getInfo` oracle — stalled opens often Mocha-timeout at 10s before agent `openContextListenerTimeoutMs` (15s) rejects with `AppTimeout`. FDC3 2.2 `findIntent` returns flat `AppIntent.apps: AppMetadata[]`; `findInstances` is separate. Toolbox enforces `apps.length === 1` for single-app-running — merge policy needs FINOS guidance, not naive same-`appId` dedupe.
- Cucumber `@fdc3_2.2` (~135 scenarios) uses `DacpTestAppConnection` with pre-registered instance ids; green BDD does not prove browser WCP. Only `wcp-desktop-agent.integration.test.ts` exercises the WCP↔DA seam today; toolbox `AppTimeout` clusters need WCP multi-app delivery tests and harness coverage, not more headless channel BDD alone. `CustomWorld.initializeDesktopAgent()` defaults `heartbeatEnabled: false` — heartbeat scenarios opt in via `A desktop agent with heartbeat checking`. Do not wire `requestIntentResolution` on default init; lazy-wire for resolver UI/cancel scenarios. Directory apps in BDD use production WCP4→WCP5; apps without app-directory entries may use direct CONNECTED.
- Avoid `import ... with { type: "json" }` in this repo: the TypeScript parser treats `with` as a legacy statement and breaks module parsing (cascading false module-not-found and `error`-typed imports). Use plain `import pkg from "../../package.json"` with `resolveJsonModule`, or `readFileSync(new URL(..., import.meta.url))` in tests.
- This monorepo uses npm workspaces (`npm install`, `npm test`), not pnpm; always install from the repo root — shared dev tooling (TypeScript, Vite, Vitest, ESLint, Prettier, React types) is hoisted in root `package.json`; workspace packages keep only package-specific devDependencies (Cucumber, Playwright); run workspace scripts with `npm run <script> -w <package>`. Vite+ (`vite-plus` local devDependency) is the contributor toolchain — root `lint`/`format`/`test` are `vp lint`, `vp fmt`, `vp test`; `npm run prepare` runs `vp config` (pre-commit hook). Staged `.ts`/`.tsx` run `vp check --fix` via `vite.config.ts` `staged`; lint/format config lives in root `vite.config.ts` (not standalone `.oxlintrc.json`). Do not require or document global `vp` CLI install (fin-services constraint).
- WCP origin allowlisting is not an FDC3 2.2 API surface; FDC3 requires responding to `WCP1Hello` with `WCP2LoadUrl` or `WCP3Handshake`, with identity validation at WCP4 — silent pre-filter reject is Sail policy, not spec behavior. Option A instance lifecycle: host pre-register stays `PENDING` until WCP5 sets `CONNECTED`; WCP6 and heartbeat timeout remove the instance independent of heartbeat enablement.
- `origin/main` retains the legacy package tree (`da-impl`, `web`, `fdc3-example-apps`) and FINOS scorecard/security workflows; `v3-pre` is the v3 refactor integration branch (`sail-*`, `website/`, `plans/`). Sync from `main` with path-scoped `git checkout origin/main -- <paths>` in a separate git worktree so feature work continues — never take `packages/`, `website/`, `plans/`, `vitest.config.ts`, or root workspace/tooling wholesale. TAKE: FINOS security workflows (OSPS, scorecard, dependency-review, CodeQL, cve-scanning, semgrep), `Meeting.md` issue template, delete `unused-workflows/` and legacy `meeting-minutes.md`. MERGE manually: `ci.yml` (rewrite jobs for v3 scripts), `.gitignore`, `.prettierignore`, README badges, lint-staged, partial root `package.json`. `FDC3-Sail-sync-main-infra` worktree (`sync/main-infra` → `main`): Changesets release infra (`.changeset/`, `release.yml` replacing tag-driven `npm-release.yml`), `docs-pages.yml` — merge separately from v3-pre feature work; do not use `sync/main-infra` for v3-pre delivery. Parallel `v3-pre` lanes: main repo + a second worktree on `v3-pre` (e.g. `fdc3-sail-dev`); merge/rebase delivery branches back to main `v3-pre` in dependency order. SKIP: root eslint/prettier configs wholesale, `package-lock.json`, `LICENSE`; legacy `unused-workflows/release.yml` was Electron installer builds, not npm publish.
- Root `vitest.config.ts` uses Vitest `test.projects` for each workspace package config; Playwright specs under `packages/sail-web/tests/` are excluded from `npm test` — run them with `npx playwright test` or `npm run test:e2e -w @finos/sail-web`.
- `@finos/sail-desktop-agent` `src/` layout is role-first at `src/` root without a `core/` wrapper: `agent/` (`DesktopAgent`, `createBrowserDesktopAgent`, browser session/controllers, `default-config`), `app-connection/` (`BrowserAppConnection`, `AppConnectionRegistry`, `wcp/` handshake and MessagePort routing — internal, not a public host API), `handlers/` (DACP dispatch 1:1 with request types; cluster subfolders like `intent-handlers/`; WCP/connection mechanics stay out of handlers), `state/` (FDC3 `AgentState`), `dacp/` (wire helpers), `host-contracts/`, `app-directory/`, `interfaces/`, `errors/`. Browser path: app → WCP/MessagePort → `BrowserAppConnection` → `DesktopAgent` (via `attachAppConnection` / `onAppMessage`) → handlers/state → `AppConnectionRegistry.sendToAppInstance()` — no browser-path `Transport` hop (`DaOwnedAppConnectionRouter` / `BrowserDaEdgeLink` removed). `AgentState` (FDC3 semantics) and `AppConnectionRegistry` (`instanceId` → MessagePort) are separate; `disconnectInstance()` is the single teardown entry (FDC3 state cleanup + port prune). WCP and DACP share the same MessagePort but are different protocols — WCP6 goodbye is WCP connection lifecycle in `app-connection/`, not DACP semantics. Reject `BrowserConnectionBackend` and public `WCPConnector` naming. `Transport` stays in `interfaces/` for handler-only dispatch recording; `DacpTestAppConnection` / `InMemoryTransport` live in test support only. App catalog on `AgentState.appDirectory`; reads via `app-directory-queries.ts`, writes via `state/mutators/app-directory.ts`. DACP handlers deliver through `DacpResponseDispatcher` on `DACPHandlerContext.responses`, not raw transport. Channel membership is per connected `instanceId`, not `appId`. User channels fixed at DA construction. DACP handlers use `resolveDacpHandlerInstanceId`: prefer MessagePort-routed instance before pending open-with-context host id.
- WCP4 over `InMemoryTransport` (browser preset, conformance harness): do not put `Window` on DACP message meta — `InMemoryTransport.send` uses `structuredClone` and throws `DataCloneError`; store WCP1Hello source windows in `handlers/dacp/wcp-pending-source-window.ts` keyed by temp `instanceId` and resolve in `handlers/dacp/wcp-handlers.ts`. `raiseIntentResultResponse` must not share the same object reference in `payload.metadata` and `intentResult.metadata` — `structuredClone` treats shared refs as cycles and breaks WCP intent-result delivery (use separate clones, e.g. `cloneIntentResultContextMetadata`).
- Browser collapsed-agent host API: `getBrowserDesktopAgentSession` throws for architecture assertions; use grouped `channels` / `intentResolver` / `apps` and `DesktopAgent.getAppConnection()` / `getAppConnections()`. Intent resolution is one host-global flow per DA (`requestId`-correlated) via `IntentResolver.resolve(request)`. InMemoryTransport is not the toolbox `AppTimeout` surface — failures point at MessagePort/`instanceId` routing.
- `website/.docusaurus` is Docusaurus-generated cache (gitignored); `website/build` via root `build`. Docs site: `npm run docs:dev` / `npm run docs:build` (`@finos/sail-docs`); default port 3000 conflicts with `npm run dev` — use `--port 3002` on `npm run start -w @finos/sail-docs`. Mermaid in `website/docs/` requires `@docusaurus/theme-mermaid`, `markdown: { mermaid: true }`, and `themes: ["@docusaurus/theme-mermaid"]` in `website/docusaurus.config.ts`.
- Browser-resident Sail supports FDC3 `getAgent()` via WCP proxy discovery (iframe parent or `window.opener` + MessagePort/DACP), not a host-page `window.fdc3` preload. The iframe/window browsing-context boundary is the micro-frontend app boundary: different teams/frameworks can ship independent apps, while same-page React/Vue components are host UI. Use `SailPlatform`/`DesktopAgent` host APIs for host UI or put FDC3 apps in iframe/window browsing contexts for standard `@finos/fdc3` `getAgent()`; a host-level `window.fdc3` facade would share one page/app identity unless Sail adds a custom component identity layer.
- npm publish for `@finos/sail-desktop-agent` and `@finos/sail-platform-api` uses Changesets on `main`: commit `.changeset/config.json`, `pre.json`, README; maintainer adds ephemeral `.changeset/*.md` → `release.yml` opens Version Packages PR → merge runs `release:publish` (build + `changeset publish`) with repo secret `NPM_TOKEN` (npm org permissions gate who can publish). Scoped git tags are still pushed on publish. Desktop Agent is in Changesets pre mode (`3.0.0-pre.x`); run `npx changeset pre exit` before stable `3.0.0`. Require CI green on Version Packages PR (branch protection) before merge. Docs deploy to per-repo GitHub Pages at `https://finos.github.io/FDC3-Sail/` via `docs-pages.yml` (not org-wide). `@finos/sail-electron` is optional (root `npm run build` skips it); preload imports `./desktop-agent-proxy` from `desktop-agent-proxy.ts` — still Rollup on v3-pre until Vite+ `vp pack` migration lands.
