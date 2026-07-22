# Minimal Viable Delivery Plan: SailPlatform KISS entry

Status: planning
Current slice: (awaiting human "go" — no implementation yet)
Review/fix loops: 0

## Intent

- Outcome: Embedders can construct a friendly Sail host with launch/close **callbacks** (no hand-built `AppLauncher`), via `SailPlatform`, while `SailDesktopAgent` remains the standalone composable engine.
- User: Host builders embedding FDC3 Sail in their own UI (not forking sail-web).
- Success: One documented path — `new SailPlatform({ onLaunchApp, onCloseApp, apps })` (names may vary) builds `SailAppLauncher` internally, `start()` runs the DA; docs explain embed vs fork sail-web vs pure DA.
- Constraint: Keep `@finos/sail-desktop-agent` pure FDC3; no FINOS toolbox (B) profile in this work; no new `@finos/sail` package yet.
- Out of scope: sail-web dogfood of `SailPlatform`; `@finos/sail` re-export package; toolbox popup/closeWindow kit (B).

## Context (decisions already made)

- **A vs B:** This work is **A** (any-UI host). Toolbox extras stay parked.
- **Layers:**
  - `sail-web` = run/fork product UI
  - `sail-platform-api` = friendly embed SDK (`SailPlatform` is the KISS entry)
  - `sail-desktop-agent` = pure engine + host contracts (`AppLauncher`, controllers)
- **Naming:** Prefer **`SailPlatform`** (already exists), not a new top-level `Sail` / `FDC3Sail` class.
- **Standalone DA:** Experts still use `new SailDesktopAgent({ appLauncher })` or `createSailBrowserDesktopAgent` + controllers — do not remove those paths.
- **Prior A work (done):** `SailAppLauncher.close` / `onCloseApp`; sail-web Layout always disconnects — commit `1c2e75a68`. Plan: `.cursor/plans/reusable-browser-host-kit.md`.

## Simplicity Bias

- Reuse: Existing `SailPlatform`, `SailAppLauncher`, grouped controllers on `SailDesktopAgent` / platform getters
- Avoid: New meta-package `@finos/sail`; renaming DA contracts to `appManager`; forcing sail-web rewrite
- Architecture: Callbacks → internal `SailAppLauncher` → existing `appLauncher: AppLauncher` path; advanced users still pass `appLauncher` directly

## Slices

### 1. KISS config on `SailPlatform` (callbacks → SailAppLauncher)

- Goal: Accept UI launch/close callbacks on `SailPlatformConfig` and wire `SailAppLauncher` when `appLauncher` is omitted.
- Acceptance:
  - Config allows **either** `appLauncher: AppLauncher` **or** `{ onLaunchApp, onCloseApp? }` (exact field names: prefer aligning with `SailAppLauncherConfig`: `onLaunchApp`, `onCloseApp`).
  - If both provided, prefer explicit `appLauncher` (document) or throw — pick one and test it.
  - `onCloseApp` optional at type level but recommended; if missing, `close()` still fails as today when app calls `fdc3.close()`.
  - Existing `new SailPlatform({ appLauncher })` callers keep working.
  - Expose controllers clearly after `start()` (already partly there — verify `platform.channels` / `intentResolver` / `apps` or document `platform.agent.*`).
- Verify: Vitest in `@finos/sail-platform-api` — construct with callbacks only, assert launcher `close`/`launch` delegates; construct with `appLauncher` still works.
- Likely files:
  - `packages/sail-platform-api/src/sail-platform.ts`
  - `packages/sail-platform-api/src/services/app-launcher/sail-app-launcher.ts` (reuse only)
  - `packages/sail-platform-api/src/**/__tests__/` or `*.test.ts` next to platform
  - `packages/sail-platform-api/src/index.ts` if new types exported

Suggested target API shape (implementer may refine, keep KISS):

```ts
import { SailPlatform } from "@finos/sail-platform-api"

const platform = new SailPlatform({
  apps: myDirectory,
  onLaunchApp: async (app, instanceId, context) => {
    mountApp({ instanceId, url: /* from app.details */, appId: app.appId })
  },
  onCloseApp: async instanceId => {
    unmountApp(instanceId)
  },
  onAppConnected: meta => { /* optional */ },
})

platform.start()
// Host UI: platform.agent.apps.disconnect(instanceId) on tab close
// Controllers: platform.agent.channels / intentResolver / apps (or platform getters if already exposed)
```

### 2. Docs — three adoption paths

- Goal: Docs site makes the stack obvious; KISS example uses callbacks.
- Acceptance:
  - Update `website/docs/packages/platform-api/overview.md` — primary example uses `onLaunchApp` / `onCloseApp`; note advanced `appLauncher` still supported.
  - Update `website/docs/getting-started.md` (and/or integrator guide cross-links) with a short table:
    | Goal | Start here |
    |------|------------|
    | Run / fork Sail UI | `@finos/sail-web` |
    | Embed DA in your UI | `@finos/sail-platform-api` → `SailPlatform` |
    | Pure FDC3 engine only | `@finos/sail-desktop-agent` → `SailDesktopAgent` |
  - Mention A-path host duties: iframe `name` = instanceId, `registerPendingHostInstance` if using browser preset patterns, disconnect on UI close, `onCloseApp` for `fdc3.close()` (3.0).
  - Do **not** document toolbox B (popups, closeWindow relay) as required for embed.
- Verify: Docs-only — no executable markdown tests (repo preference). Human skim of rendered pages optional.
- Likely files:
  - `website/docs/packages/platform-api/overview.md`
  - `website/docs/getting-started.md`
  - Optionally a short note in `website/docs/packages/desktop-agent/integrator-guide.md` pointing to SailPlatform for Sail-branded embed

## Test Plan

- Unit: SailPlatform config resolution (callbacks vs appLauncher); launch/close delegation
- Integration: none required for MVP (no browser E2E)
- Manual/runtime: optional — not required if Vitest covers wiring
- Not testing: sail-web migration; toolbox conformance; `@finos/sail` package publish

## Review Plan

- Main-agent checks: after slice 1 (API shape + tests), after slice 2 (docs accuracy vs code)
- Fresh-context review: after slice 1 if API union types get subtle
- Loop limit: 3

## Risks

- `SailPlatformConfig` currently requires `appLauncher` — making it optional needs a clean TypeScript union (avoid `appLauncher?` + callbacks both optional with no launcher at runtime).
- Confusion with `createSailBrowserDesktopAgent` — docs must say when to use which (Platform = workspaces/events + KISS; createSail… = agent-only).
- Do not break existing SailPlatform tests / consumers that pass `appLauncher`.

## Slice Checkpoints

- [ ] Slice 1: working | verified | reviewed | blocked
- [ ] Slice 2: working | verified | reviewed | blocked

## Verification Notes

- (none yet)

## Review Notes

- Required:
- Follow-up:
- Ignore for MVP:

## Parked Follow-ups

- **sail-web dogfood** — switch `main.tsx` from `createSailBrowserDesktopAgent` to `SailPlatform` with callbacks
- **`@finos/sail` thin re-export** of platform-api happy path for npm discoverability
- Toolbox profile **B** (popup / resolveHostIdentifier / closeWindow relay) — separate plan when scores matter
- End-to-end browser smoke of callback-based SailPlatform (optional)

## Known Limitations

- KISS entry still does not include React/Dockview — host must implement mount/unmount
- `fdc3.close()` still requires host `fdc3Version` ≥ 3.0 and `onCloseApp` configured
- Workspaces/layouts on SailPlatform remain as today (stubs/localStorage) — out of scope to redesign

## Handoff notes for implementing agent

1. Read this plan + `.cursor/plans/reusable-browser-host-kit.md` (A/B context).
2. Follow `.cursor/rules/minimal-implementation.mdc` — no unrequested abstractions.
3. Do **not** put FINOS/toolbox orchestration in `sail-desktop-agent`.
4. Implement slice 1 → Vitest → pause for human if API choice is ambiguous → slice 2 docs.
5. Do not commit unless the human asks.
6. Repo: npm workspaces, Node ≥ 24; `npm test -w @finos/sail-platform-api`; docs under `website/docs/` only (not package README essays).
