# Plan: FDC3 host (A) then toolbox profile (B)

Status: A done (committed)
Current slice: parked — B when toolbox scores needed again

## Intent

- Outcome: Clear split — what any UI needs for FDC3 (A) vs FINOS toolbox extras (B)
- Constraint: Keep `@finos/sail-desktop-agent` pure FDC3; no FINOS/Sail toolbox orchestration in DA `src/`
- Out of scope for A: forceNewWindow popups, closeWindow relay, toolbox run profiles

## A vs B

### A — Any UI (FDC3 Sail Desktop Agent works)

Minimum for a real host (Dockview, custom React, etc.):

| Need | Where | Notes |
|------|--------|--------|
| One DA per page | host bootstrap | `SailDesktopAgent` / `createSailBrowserDesktopAgent` |
| App directory | host config | Real apps; not required to merge conformance catalog |
| `AppLauncher.launch` | host | Open browsing context; set identity (`iframe.name` / equivalent) to `instanceId` |
| `AppLauncher.close` (optional for 2.2) | host | Tear down container when `fdc3.close()` (3.0) |
| Disconnect on UI close | host | Panel/window closed → `apps.disconnect(instanceId)` |
| Intent resolve | host | UI modal **or** auto-pick — something must call resolve/cancel |
| Channel chrome (optional) | host UI | Use `channels.*` controllers; not required for apps to use channels |
| Heartbeat / `fdc3Version` | DA config | Product defaults OK for normal use |

**Success for A:** Apps can `getAgent()`, open, broadcast, raiseIntent, join channels with your UI. Not “toolbox green.”

### B — FINOS toolbox extras (optional profile)

Only when you want Conformance1 / mock-app suite scores:

| Need | Why (toolbox, not core FDC3) |
|------|------------------------------|
| Honor `hostManifests.sail.forceNewWindow` → **real** `window.open` popup | Mocks expect top-level window + `window.name` |
| `resolveHostIdentifier` / popup registry | Mocks clear `window.name` |
| FINOS `closeWindow` → mock `windowClosed` relay | Mocha 1s close-context handshake |
| Auto intent resolve / no blocking modal | Unattended toolbox runs |
| `heartbeatEnabled: false` | Long suites don’t kill Conformance1 |
| Conformance-only (or careful) app directory | Demo apps inflate `findIntent` |
| Matching `implementationMetadata.fdc3Version` | close / 3.0 paths |

**Success for B:** Harness-like toolbox pass on a host that opts into the profile. Lives in platform-api / harness — **not** DA core.

## Sequencing

1. **A only** — document + tighten sail-finance/DA host contract usage (close/disconnect, identity). No FINOS extract into platform-api yet.
2. **B later** — optional “toolbox host profile” kit; sail-finance opts in when measuring conformance.

## Rolled back

- `packages/sail-platform/src/browser-host/`
- SailAppLauncher close/forceNewWindow API expansion + tests
- Harness re-exports of platform-api browser-host
- Harness `@finos/sail-platform` dependency (restored)

## sail-finance A gap matrix

| A need | sail-finance | Status |
|--------|----------|--------|
| One DA per page | `main.tsx` | OK |
| `launch` + iframe `name` = instanceId | `SailAppLauncher` + `FDC3IframePanel` | OK |
| Pending register before WCP | `registerPendingHostInstance` | OK |
| Disconnect on UI panel close | `Layout` `onDidRemovePanel` | Fixed: always disconnect (pending or connected) |
| `AppLauncher.close` | was missing | Fixed: `onCloseApp` → remove panel from store → Dockview sync |
| Intent resolve | modal store | OK (blocks unattended toolbox = B) |
| Channel chrome | ChannelSelector | OK (optional) |
| Heartbeat / version | product defaults | OK for A |

## Verification Notes

- Browser smoke (chrome-devtools, localhost:3000): **PASS** Layout disconnect-on-close with `hadConnection: false`.
- Browser smoke `AppLauncher.close`: **PASS** via DEV `window.__sailAppLauncher.close(instanceId)` → `[Sail] Closed app panel …` → Dockview remove → Layout disconnect.

## Next

- Park B until you want toolbox scores again
- A committed: `1c2e75a68` (includes DEV-only `__sailAppLauncher` hook)
