# Website Docs — Defect Register

Companion to `.cursor/plans/website-docs-blueprint.md`. This is the working material for slice 1
(truth pass) and slice 3 (package pages).

**Audited:** 2026-07-30 against `wip/v3-local` @ `83eee8261` + working tree.
**Sources:** full read of all 13 pages under `website/docs/`, plus `README.md` and `AGENTS.md`,
each claim checked against `packages/`. Overlaps independently confirmed against
`FDC3-SAIL-REVIEW.md` (2026-07-28) are marked ✔.

---

## How to use this

1. **Re-verify before you delete.** Every row below must be re-checked at the time you act on it —
   this tree moves fast, and two findings in the parent review were already stale within 48 hours.
   Each row gives you the grep or file to check. Do not delete a claim because it *looks* stale.
2. **Severity:**
   - **WRONG** — contradicts the code. A reader acting on it fails.
   - **STALE** — was true, no longer is.
   - **OVERSTATED** — technically defensible, materially misleading.
   - **ORPHANED** — correct but unreachable (not in the sidebar, not linked).
3. **Do not add new claims in slice 1.** Deletion and correction only. New content is slices 2–4.
4. Line numbers drift. Locate by the quoted string, not the number.

> ⚠ **Recently invalidated by code changes — check these first.** Slice 11 of the remediation plan
> removed `intentResolverUI` and `BrowserIntentResolverController` from the public API. Any doc
> mentioning either is *newly* wrong as of this week. `grep -rn "intentResolverUI\|BrowserIntentResolverController" website/`

---

## A. The structural defect — a middle layer with no consumers

`SailPlatform` has **zero consumers** outside its own two tests.
Verify: `grep -rn "SailPlatform" packages/ --include=*.ts --include=*.tsx -l | grep -v sail-platform/`
→ no results. ✔ (matches `FDC3-SAIL-REVIEW.md` §Final Verdict ¶2)

What `sail-finance` actually does: `packages/sail-finance/src/main.tsx:35` constructs `SailAppLauncher`;
`:110` calls `createSailBrowserDesktopAgent({ debug, appLauncher, apps })`; `:128` passes the
`SailDesktopAgent` into React.

**This is the one defect that blocks pages rather than lines.** Four pages are wrong *because* it is
open. Do not rewrite them until blueprint slice 0 lands.

| # | Page:line | Claim | Reality | Sev |
|---|---|---|---|---|
| A1 | `packages/sail-finance/overview.md:13` | "Hosts `SailPlatform` in the browser main window" | `main.tsx:110` calls `createSailBrowserDesktopAgent`; `SailPlatform` never constructed | WRONG |
| A2 | `packages/sail-finance/overview.md:16`, diagram `:32-37` | Workspaces/layouts managed via `SailPlatform` | Zustand `persist` + raw `localStorage` — `sail-finance/src/stores/workspace-store.ts:4,114,192,204`. `platform.workspaces` / `platform.layouts` / `SailPlatformClient` / `LocalStorageBackend` never called | WRONG |
| A3 | `packages/sail-finance/overview.md:32-37` | ASCII: `sail-finance → sail-platform (SailPlatform, launcher, middleware) → sail-desktop-agent` | Real edge is `sail-finance → createSailBrowserDesktopAgent + SailAppLauncher → SailDesktopAgent`. Middleware pipeline created but never wired — `sail-platform/src/sail-browser-desktop-agent.ts:80-88`, comment at `:88` | WRONG |
| A4 | `packages/sail-finance/overview.md:41` | "`SailDesktopAgentContext.tsx` — platform provider" | It is a `SailDesktopAgent` provider — `sail-finance/src/contexts/SailDesktopAgentContext.tsx:11` | STALE |
| A5 | `architecture/overview.md:35-58` | 3-box stack with "Sail platform services" as mandatory middle layer | No host in this repo goes through it | WRONG |
| A6 | `architecture/deployment-targets.md:11-25` | Same 3-layer diagram, "Layer 2: Platform SDK" | ditto | WRONG |
| A7 | `architecture/deployment-targets.md:72` | "Three-layer architecture" | Effectively two in the shipped product | WRONG |
| A8 | `architecture/channel-selection.md:16-17,43,69,105-109` | `sail-finance` calls `SailPlatform.changeAppChannel` / `platform.start({ onChannelChanged })` | `sail-finance/src/components/ChannelSelector.tsx:57` calls `agentRef.current.channels.changeAppChannel(...)` | WRONG |
| A9 | `packages/desktop-agent/integrator-guide.md:419-436` | "With `SailPlatform` (reference stack)… uses `SailPlatform.changeAppChannel`" | As A8. `ChannelSelector.tsx:23` reads `useConnectionStore`, created from the **agent** (`SailDesktopAgentContext.tsx:17`) | WRONG |
| A10 | `packages/desktop-agent/integrator-guide.md:447-457` | Bootstrap `SailPlatform.start() → new SailDesktopAgent(...)` | `main.tsx:110` `createSailBrowserDesktopAgent(...)` | WRONG |
| A11 | `run-sail.md:75` | Workspace/layout persistence "provided through `@finos/sail-platform`" | See A2 | WRONG |
| A12 | `getting-started.md:51`; `integrator-guide.md:269,298-307` | Recommends `new SailPlatform({...}); platform.start()` as *the* same-page answer | API exists (`sail-platform/src/sail-platform.ts:192`) but is unexercised by any shipping host | OVERSTATED |
| A13 | `packages/desktop-agent/integrator-guide.md:423` | `await platform.start()` | `sail-platform/src/sail-platform.ts:222` — `start(): void`, not a Promise | WRONG |

---

## B. `DesktopAgent` presented as a public construction path

`packages/sail-desktop-agent/src/index.ts:24-29` exports `DesktopAgent` as **`export type`** only,
with the TSDoc: *"`@internal` Base class of `SailDesktopAgent`. Exported because TypeScript
declaration emit requires it to be nameable — not an entry point."*

**These samples cannot compile.** This is the most mechanically detectable defect class in the set and
the one blueprint slice 6 exists to prevent recurring.

| # | Page:line | Claim | Sev |
|---|---|---|---|
| B1 | `packages/desktop-agent/integrator-guide.md:548-555` | Runnable `import { DesktopAgent } … new DesktopAgent({ appLauncher, heartbeatEnabled: false })` | WRONG |
| B2 | `packages/desktop-agent/integrator-guide.md:613-616` | "Manual composition … `new DesktopAgent()` → `attachAppConnection(customConnection)`" — `attachAppConnection` is `@internal` (`src/agent/desktop-agent.ts:464`); `AgentAppConnection` is not exported | WRONG |
| B3 | `packages/desktop-agent/integrator-guide.md:102,624-625` | `MockTransport` + `DesktopAgent` as a testing entry — `MockTransport` lives in `test/support/`, not shipped | WRONG |
| B4 | `getting-started.md:24,38,154`; `intro.md:84,88` | Flowcharts/tables offering "Manual — `DesktopAgent` + app connection" as a second npm entry point | WRONG |
| B5 | `architecture/overview.md:21,53` | Lists `DesktopAgent` as a co-equal owned API. Note `composition.md:61-63` states the truth well ("not an assembly of parts you can swap… a bare `DesktopAgent` throws") — reuse that wording | STALE |
| B6 | `packages/platform/overview.md:99-104` | "`DesktopAgent`" re-exported from `@finos/sail-platform` | WRONG — `sail-platform/src/index.ts:65-76` re-exports `SailDesktopAgent` and types, not `DesktopAgent` |
| B7 | `packages/platform/overview.md:91-92` | "`validateDACPMessage` / `safeParseDACPMessage` — Zod-based DACP validation" | WRONG — neither exists; validation is `@finos/fdc3-schema` guards |

---

## C. Publication and readiness claims

`npm view @finos/sail-desktop-agent` → **E404**. `npm view @finos/sail-platform` → **E404**.
Neither has ever been published. ✔ (`FDC3-SAIL-REVIEW.md` BLOCK-D)

| # | Page:line | Claim | Sev |
|---|---|---|---|
| C1 | `getting-started.md:70` | `npm install @finos/sail-desktop-agent @finos/fdc3` — the quickstart's first step 404s | WRONG |
| C2 | `getting-started.md:17` | "Both paths below use `@finos/sail-desktop-agent` **from npm**" | WRONG |
| C3 | `development.md:207` | "Public npm packages: …" — correct as *intent* (`publishConfig` present) but nothing has shipped | OVERSTATED |
| C4 | `README.md:163-171` | Release via per-package git tags | STALE — `.github/workflows/release.yml:44` uses `changesets/action`. `development.md:209-239` describes it correctly ✔ (D-6) |
| C5 | `README.md:184` vs `intro.md:65`, `run-sail.md:68` | "not yet ready for production use" vs "a **production-ready product**" | OVERSTATED — flat contradiction ✔ (BLOCK-C, D-1) |

---

## D. Dead commands, scripts and paths

| # | Page:line | Claim | Reality | Sev |
|---|---|---|---|---|
| D1 | `development.md:39,74`; `packages/conformance-harness/overview.md:19` | `npm run dev:harness` | No such script. Root `package.json:15` is `dev:conformance`. (`npm run dev -w @finos/sail-conformance-harness` at `overview.md:24` **is** correct) | WRONG ✔ (D-5) |
| D2 | `development.md:55` | Tree lists `sail-server/ # Node.js backend server` | Removed in `f5570ad60` | STALE ✔ (D-7) |
| D3 | `architecture/channel-selection.md:117` | "`plans/work-items/replace-dacp-impersonation-with-channel-api.md`" | `plans/` does not exist; ad-hoc plans live in `.cursor/plans/` | WRONG |
| D4 | `run-sail.md:46`; `development.md:36` | `npm run dev` starts agent, platform API, **server stub**, web UI | Root `package.json:13` starts three (`-n agent,api,web`). No server stub | STALE |
| D5 | `development.md:197` | Key Technologies lists "**Socket.IO**" | Not a dependency anywhere | STALE |
| D6 | `README.md:151` | `npm run generate:schemas --workspace=@finos/sail-desktop-agent` | No such script | WRONG ✔ (D-2) |
| D7 | `README.md:141,154` | "Zod schemas auto-generated"; file at `src/handlers/validation/dacp-schemas.ts` | No Zod in the repo; path does not exist. Validation is `src/dacp/validate-dacp-message.ts` using `@finos/fdc3-schema` `isValid*` guards, default mode `warn`. `packages/desktop-agent/overview.md:98-99` describes this correctly — reuse it | WRONG ✔ (BLOCK-B, D-3/D-4) |
| D8 | `packages/desktop-agent/integrator-guide.md:594` | "`app-connection/message-port-transport.ts`" | Actual: `app-connection/message-port.ts`. `composition.md:154` gets it right | WRONG |
| D9 | `development.md:152` | validate "runs Prettier, ESLint, TypeScript, build, docs build, Vitest, Cucumber" | Also runs `lint:boundaries` (`.oxlintrc.json`), matching `ci.yml:39-40`. Omission only | STALE |
| D10 | `website/sidebars.ts:19-30` | — | `packages/conformance-harness/overview.md` has a `_category_.json` and is linked from `development.md:63` but is **not in the sidebar** | ORPHANED |

---

## E. Conformance page — regenerate, don't patch

`packages/desktop-agent/conformance.md` is wrong **because it is hand-maintained**. Actual tree:
`packages/sail-desktop-agent/test/features/{apps,channels,context,intents}/`. There is no `basic/`
and no `infrastructure/`.

| Doc line | Claim | Actual |
|---|---|---|
| `:11,33` | `test/features/basic/basic.feature` — 10 scenarios | **File does not exist** |
| `:27` | `test/features/infrastructure/heartbeat.feature` | **Does not exist** |
| `:24` | `test/features/apps/disconnect-cleanup-p0.feature` | **Does not exist** |
| `:34` | user-channels — 14 | 20 |
| `:35` | app-channels — 11 | 16 |
| `:36` | private-channel — 4 | 13 |
| `:37` | broadcast — 4 | 7 |
| `:38` | event-listeners — 2 | 8 |
| `:39` | raise-intent — 13 | 16 |
| `:40` | raise-intent-with-context — 9 | 10 |
| `:41` | find-intent — 12 | 20 |
| `:43` | apps — 16 | 17 |
| `:46` | "**Total: 103** tagged scenarios across 12 feature files" | 11 `@fdc3_2.2`-tagged files, **136** scenarios |
| `:48` | "`close.feature` is `@fdc3_3.0` only" | **Six** `@fdc3_3.0`-only files, all undocumented: `apps/close.feature` (2), `context/context-metadata.feature` (2), `intents/intent-context-metadata.feature` (2), `intents/intent-listener-conflict.feature` (7), `intents/intent-metadata-performance.feature` (2), `intents/intent-result-metadata.feature` (3) |

Also `:11-27` carries ~20 work-item owner slugs pointing at the retired queue (see D3).

`composition.md:233` and `integrator-guide.md:776` say "~135 `@fdc3_2.2`" — **correct, keep.**

The page must also stop implying a conformance figure: the committed baseline is stale
(`FDC3-SAIL-REVIEW.md` BLOCK-E — newest export predates ~10 conformance-affecting commits) and
`results/conformance-test-failure-review.md:3` names an even older one. State it as unmeasured.

---

## F. Pages that check out — use as the rewrite base

Verified correct. **Do not rewrite these.**

- **`packages/desktop-agent/overview.md`** — strongest page in the set. Validation table `:101-105`
  matches `agent/default-config.ts:38` (`validation: "warn"`); package layout `:38-45` matches the real
  `src/` tree; "no subpath exports" `:89` matches `src/index.ts`.
- **Host-controller API surface** — every method in `integrator-guide.md:225-227` and
  `channel-selection.md:56-60` exists verbatim: `agent/sail-desktop-agent.ts:50-56`
  (`SailDesktopAgentChannels`) and `:58-77` (`SailDesktopAgentApps`) — including correctly having **no**
  `apps.close`.
- **Heartbeat section** `integrator-guide.md:517-562` — `heartbeatEnabled: true`, `30_000`, `60_000`
  all match `agent/default-config.ts:40-42`. Only the `new DesktopAgent` sample at `:548-555` is broken
  (B1).
- **`autoStart`** `integrator-guide.md:208,650` — matches `sail-desktop-agent.ts:101,257`.
- **Intent resolver request shape** — `request.handlers` (`getting-started.md:106`) and
  `request.choices` (`integrator-guide.md:338`) both exist: `host-contracts/intent-resolver.ts:56,64`.
- **`composition.md` source-tree and ownership tables** `:100-158` — all 14 cited paths exist. Only the
  platform/channel framing at `:225` needs the A8 fix.
- **`add-your-app.md`** — entirely app-developer-facing, no internal claims. Only `:162` understates the
  dev directory (finance merges `sail-finance/fixtures/default-app-directory.json` **and** the
  conformance fixture — `main.tsx:11,101,113-116`).
- **`deployment-targets.md:64-68`** — the "Future: native shell adapter" framing is honest and matches
  reality: zero Electron/native code in `packages/`. **Salvage this section verbatim** when rewriting
  the rest of the page.
- **`conformance-harness/overview.md:32-36`** — accurate: `harness-bootstrap.ts:156`
  `new SailDesktopAgent({...})` with no `SailPlatform`, `intentResolver` at `:159`,
  `heartbeatEnabled: false` at `:161`, both selector URLs `false` at `:168-169`. Port 3001 matches
  `vite.config.ts:10`. Only `:19` (`dev:harness`) is broken.
- **`getting-started.md:44-59`** — `getAgent()` discovery table and micro-frontend framing match the
  `window.fdc3`-free design.

---

## G. Architecture that exists but is documented nowhere

Input for blueprint slice 4. Each is load-bearing and currently undiscoverable.

| # | Thing | Where it lives | Why it matters |
|---|---|---|---|
| G1 | `@finos/sail-theme` | Root `package.json:54`; referenced in `README.md:38,79`, `AGENTS.md:31`; owns the README logo | A real workspace package mentioned in **no** docs page |
| G2 | `createSailBrowserDesktopAgent` | `sail-platform/src/sail-browser-desktop-agent.ts` | **The actual production entry point.** `platform/overview.md:69-87` files it under "(advanced)" and says "prefer `SailPlatform`" — the exact inversion of `main.tsx:110` |
| G3 | `SailAppLauncher` + `onLaunchApp`/`onCloseApp` | `sail-platform/src/services/app-launcher/sail-app-launcher.ts`; used `main.tsx:35-99`; exported `sail-platform/src/index.ts:48` | The real host-integration seam. Every doc teaches the raw `AppLauncher` interface instead |
| G4 | WCP4 origin allowlist | `sail-platform/src/wcp4-origin-allowlist.ts`; `wireWcp4OriginAllowlist` at `sail-browser-desktop-agent.ts:76-78` | The one genuinely Sail-specific security control. One passing mention at `platform/overview.md:79`, no threat model. **Document that it fails open and ships unwired** — `FDC3-SAIL-REVIEW.md` Security #2 |
| G5 | Dockview panel model + popout relay shell | `sail-finance/src/utils/dockview-popout.ts`; `bootstrapDockviewPopoutShell` (`main.tsx:12,22-23`); Zustand stores (`workspace`, `panel`, `connection`, `app-directory`, `intent-resolver`, `fdc3`, `ui`) | This **is** the product architecture. No doc describes it |
| G6 | Workspace/layout persistence contract | `sail-finance/src/stores/workspace-store.ts:114-195` (custom serializer) | Docs point readers at a `sail-platform` storage layer that isn't wired |
| G7 | `@fdc3_3.0` Cucumber suite | 6 files, 18 scenarios | `conformance.md` acknowledges only `close.feature` |
| G8 | `@fdc3_2.0` tag + profile | `cucumber.yml:59-70`; documented in `AGENTS.md:125` | One-line mention at `conformance.md:7` |
| G9 | `toolbox-local` / `VITE_CONFORMANCE_TOOLBOX` | Root `package.json:14` (`dev:local`); `--mode toolbox-local`; `loadConformanceApplications({ localOrigin })` at `main.tsx:101-104` | Load-bearing for conformance work; undocumented |
| G10 | `lint:boundaries` / `.oxlintrc.json` | CI gate at `ci.yml:39-40` | **Already encodes the layering rules the docs describe in prose.** Cite it as the executable contract |
| G11 | One Desktop Agent per browsing context | Enforced in practice; justifies module-scoped timer registries | Maintainer decision 2026-07-30. Currently unwritten, so a reader auditing the code files it as a bug |
| G12 | `sail-finance` → harness cross-package import | `sail-finance/src/main.tsx:10` imports `conformance-app-directory` by relative path | The one `lint:boundaries` exception; couples the product app to a test fixture ✔ |

---

## H. Verification commands

```bash
npm run docs:build
npm view @finos/sail-desktop-agent
grep -rn "SailPlatform" packages/ --include=*.ts --include=*.tsx -l | grep -v sail-platform/
grep -rn "intentResolverUI\|BrowserIntentResolverController" website/
grep -rn "new DesktopAgent" website/
grep -rn "dev:harness\|generate:schemas\|sail-server\|Socket.IO\|dacp-schemas" website/ README.md
grep -rc "three-layer\|Layer 2" website/docs
```

---

## Out of scope for this register

Product defects from `FDC3-SAIL-REVIEW.md` that the docs should stop *claiming* around but must not
attempt to fix: BLOCK-A (no iframe `sandbox`), BLOCK-D (unpublished), BLOCK-E (stale conformance
baseline), Security #2 (allowlist fails open), C-5 (`createAppIntents` double-count), C-6 (30 s
pending-intent timeout with no `delivered` guard), NEW-2 (dangling `sail-ui` tsconfig reference),
NEW-4 (`exports` condition order). These were **not** re-verified for this register — check before
citing.

OSS hygiene, different surface: stale CoC project name (D-8), boilerplate `SECURITY.md` routing
vulnerabilities to public issues (D-9), `AGENTS.md` branch references (D-10).
