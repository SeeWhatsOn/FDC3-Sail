# AGENTS.md — `@finos/sail-conformance-harness`

Clean-room host for the official FINOS FDC3 conformance toolbox. Private, not published.
Repo-wide rules are in the root `AGENTS.md`.

## Conformance1 is not a universal oracle

Green requires a **toolbox-shaped host**. An architecturally correct Dockview/iframe host
can fail the toolbox without that being a Desktop Agent purity bug. Split the two profiles:

- **A — any UI.** Launch plus browsing-context identity (`iframe.name` / `instanceId`),
  close and disconnect on teardown, intent resolve, optional channel chrome, normal
  heartbeat defaults. Success is *real apps work*, not toolbox green.
- **B — FINOS toolbox profile.** Real `forceNewWindow` popups, popup `resolveHostIdentifier`,
  `closeWindow` → `windowClosed` relay, auto-resolve, heartbeat off, conformance catalog.
  Optional, and it lives here — not a requirement for every new UI.

`sail-finance` has A. It does **not** have B. Harness green plus `sail-finance` toolbox red
is usually that gap, or session poison — not a second `DesktopAgent`.

This harness hosts the agent directly (`new SailDesktopAgent`, no workspace layer) with the
full B kit. It targets FDC3 3.0 via `HARNESS_FDC3_TARGET_VERSION` in `harness-bootstrap.ts`,
while the product default stays `"2.2"`.

## Teardown is toolbox convention, not FDC3

FINOS mock teardown — `closeWindow` / `windowClosed` on `app-control`, keyed by `testId` —
is **toolbox convention, not normative FDC3**. The Desktop Agent only fans out channel
contexts; it does not special-case `app-control` and does not close panels on `windowClosed`.

- **Path A (2.x):** host/harness relay plus deferred disconnect, so Conformance1 receives
  `windowClosed` before the port dies. 2.x close blockers are Path A *host* work.
- **Path B (3.0):** app `fdc3.close()` → DACP `closeRequest` → optional `AppLauncher.close`
  → `disconnectInstance`, gated on advertised ≥ 3.0, with no success response — failures only.

`collectHarnessCloseInstanceIds` must not treat unrelated connections as close targets.

## Session poison

**`waitForContext` in Conformance1 never unsubscribes its `windowClosed` listeners.** Ears
accumulate across tests and across suite re-runs on the same page. The tell is
`Wrong test id expected…` in host logs; a second run without a hard refresh degrades toward
`App didn't return close context within 1 sec`.

Treat warm-page / same-session collapse with those symptoms as **toolbox session poison**,
not a Desktop Agent channel bug. The mitigation is reloading Conformance1 on suite Run,
or a toolbox unsubscribe patch — never a channel fix in the agent. Any alternative harness
still needs the `closeWindow` → `windowClosed` relay plus Conformance1 freshness.

Failed scenarios leave orphan popups and stale instances that poison later adoption.
`findIntent` returning `apps.length === 1` usually means incomplete teardown, not a case
for naive dedupe.

## Host identity

Core WCP host-id resolution (`resolveHostIdentifierFromSource` in `wcp-host-identifier.ts`)
prefers `window.name`, then the optional host `resolveHostIdentifier(sourceWindow)`.
**FINOS mock apps clear `window.name` before WCP1**, so this harness supplies the launcher
id from its popup registry (`findInstanceIdForPopup`) through
`appConnectionOptions.resolveHostIdentifier`. Mock apps with
`hostManifests.sail.forceNewWindow` open in popup tabs — pre-register the host `instanceId`
before WCP4, and disconnect on popup close or WCP6.

## Where the logs are

**Conformance1 runs cross-origin inside an iframe.** `[ConformanceHarness]` and WCP logs
are on the **host** console, not iframe DevTools.

Open-with-context: distinguish DACP `open()` settlement (`openResponse`, or 15s
`AppTimeout`) from post-open Mocha waits. A ~20s gap usually means a toolbox assertion on
`context-received`, not an unsent `openResponse`. `deliverOpenWithContext` uses a direct
`sendOutbound` `broadcastEvent`, so host logs will not show the broadcast-handler
"Sending broadcast event to listener" lines.

## Triage order

Classify every failure by layer **before** approving work: Desktop Agent / DACP oracle,
WCP / MessagePort routing, host launcher, platform or UI, BDD assertion gap, or explicit
deferral. Assign a regression owner before closing an epic. `@fdc3_2.2` BDD is
conformance-*area* alignment, not toolbox oracle equivalence.

Known oracle quirks, so they aren't re-litigated:

- **Local 2.2 Metadata oracles whitelist `AppMetadata` keys and fail on extras.** Omit
  `desktopAgent` unless `DesktopAgentBridging` is claimed. A Vitest asserting the field can
  stay green while the toolbox fails. File such quirks on the fork, not FINOS.
- **`(GetInfo2)`** is open-with-context plus popup MetadataApp plus app-control delivery —
  the same cluster as `AOpensBWithContext*`. GetInfo1 green does not exculpate `getInfo`.
- **`(AppInstanceMetadata)`** `instanceId` echoes the requested/running instance and is
  fixed. Don't reopen historical `unknown-md2-id` as an identity bug; those reds were the
  bridging `desktopAgent` whitelist case.

## Artifacts

Run artifacts land in `artifacts/` (gitignored). The committed 2.2 gate is
`e2e/conformance-baseline-2.2.json`. The app directory is `conformance-appd.json` via
`conformance-app-directory.ts`; `VITE_CONFORMANCE_TOOLBOX=local` rewrites hosted toolbox
URLs to localhost. Never merge two full conformance catalogs.
