---
title: "Fix harness FINOS session teardown and stale instances"
slug: fix-harness-finOs-session-teardown
kind: task
type: bug
status: waiting_on_user
last_agent: top-level-delivery-workflow
file_manifest:
  - packages/sail-conformance-harness/src/harness-bootstrap.ts
  - packages/sail-conformance-harness/src/harness-instance-lifecycle.ts
  - packages/sail-conformance-harness/src/harness-instance-lifecycle.test.ts
  - packages/sail-conformance-harness/src/popup-launcher.ts
  - packages/sail-conformance-harness/src/__tests__/harness-instance-correlation.harness.ts
  - packages/sail-conformance-harness/README.md
depends_on:
  - harness-popup-wcp-disconnect-cleanup
integration_branch: v3-pre
branch: cursor/fix-harness-finOs-session-teardown
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Make the conformance harness complete FINOS toolbox teardown (`closeWindow` / `app-control` close context) and remove stale WCP instances so channel, metadata, open, and findIntent scenarios run against a clean agent session.

## User or system context

v5 export shows **26×** `App didn't return close context within 1 sec` (user/app channels, contextMetadata) and **findIntent apps.length 4 vs 1** (worse than v4’s 2 vs 1) — consistent with mock popups and CONNECTED instances surviving between scenarios. Popup `disconnectInstance` on `window.closed` helps but does not satisfy FINOS’s 1s close-context handshake after every channel/metadata test. Open-with-context rows fail with **20s Mocha timeout** instead of v4’s immediate AppTimeout — delivery starts but teardown or listener setup stalls.

## Reference docs

- `conformance-test-failure-review.md` (§TB-09, §6)
- `conformance-report-v5.txt`
- `AGENTS.md` (harness conventions, no `window.close` override on real popups)
- FINOS conformance utils: `closeMockAppWindow`, `app-control` channel
- `plans/work-items/harness-popup-wcp-disconnect-cleanup.md`
- `plans/work-items/pre-register-conformance1-pending-instance.md`

## Parent context

Child of `epic-toolbox-conformance-v5-follow-up`. Complements completed Conformance1 pre-register and popup disconnect; this item closes the **session hygiene** loop for v6. Distinct from blocked agent `dedupe-findintent-directory-running-apps` — teardown must land first so toolbox `apps.length` reflects product behavior not accumulated state.

## Behavior spec

### Close-context teardown (dominant v5 cluster)

Given a user-channel or app-channel scenario completes its assertions
When the FINOS toolbox calls `closeMockAppWindow` / expects close context on `app-control` within 1s
Then the mock app opened via harness `AppLauncher` receives the broadcast
And responds with the close context the toolbox expects
And the harness does not log host `Instance not found` on related DACP requests

Given a contextMetadata scenario (user or app channel) finishes
When teardown runs
Then the same close-context contract is satisfied within the toolbox budget

### Stale instance hygiene

Given multiple mock apps were opened during the toolbox run
When each test scenario completes (success or failure)
Then harness removes panel entries and calls `desktopAgent.disconnectInstance(canonicalInstanceId)` for CONNECTED/PENDING mock instances from that scenario where the browsing context has closed

Given a full toolbox run completes
When `findIntent` runs late in the pack
Then `AppIntent.apps.length` is not inflated by stale CONNECTED rows from earlier scenarios (target: oracle 1 vs 1 for `FindIntentAppD` once agent dedupe is unblocked)

### Open-with-context and findInstances

Given `AOpensBWithContext3` / specific-context / multiple-listener open scenarios
When app B adds listeners and app A opens with context
Then app B receives context within the toolbox wait budget (no 20s Mocha timeout)

Given `FindInstances` after opening multiple instances of the same app
When the toolbox compares `IntentResolution.source.instanceId` to the mock AppIdentifier
Then the canonical WCP5 instance id matches the launcher-assigned id (no UUID mismatch vs mock metadata)

## Out of scope

- sail-web / platform-api launcher
- Changing FINOS toolbox protocol or 1s close budget
- Agent `findIntent` dedupe logic (blocked separate item)
- Heartbeat interval tuning
- Overriding `window.close` on real popup browsing contexts

## TypeScript interfaces

Uses existing harness bootstrap, `AppLauncher`, `createPopupCloseWatcher`, and `DesktopAgent.disconnectInstance` / `registerPendingHostInstance`.

## Test guidance

Unit: extend `main.test.ts` and `popup-launcher.test.ts` — mock `Window.closed`, spy `disconnectInstance`, simulate `app-control` close-context listener receiving `closeWindow` broadcast.

Optional: jsdom integration test that opens two mock panels, completes a channel broadcast, fires close context, asserts instance removed from `desktopAgent.getState().instances`.

Manual acceptance: harness :3001 — run user-channel slice + Open-Tests; host console must not show `Instance not found`; export subset before full v6 run.

Use `vi.waitFor` in tests; minimal poll interval in production watcher only.

## Blocked decisions

_(empty)_

## Loop history

_(empty)_

## Staged for review

- **Build fix:** repaired corrupted `intent-result-metadata.ts` (`isContextWithMetadata` return type / stray syntax).
- **Harness lifecycle:** `harness-instance-lifecycle.ts` — `prepareLaunchedHostInstance` (pre-register before popup/iframe) + `disconnectHarnessInstance` (panel + popup + agent disconnect).
- **Bootstrap wiring:** launch path pre-registers; `onAppDisconnected` and popup close both call `disconnectHarnessInstance`.
- **Popup poll:** default 100ms (was 500ms).
- **Tests:** `harness-instance-lifecycle.test.ts` (2); updated correlation assertions (launcher id === WCP5 id after pre-register).
- **Targeted:** `npm test -w @finos/sail-conformance-harness` — 21/21 pass; desktop-agent build green.

**Manual gate:** harness `:3001` v6 toolbox re-run (user/app channels + Open-Tests) to confirm close-context 1s budget and reduced stale instances.

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
