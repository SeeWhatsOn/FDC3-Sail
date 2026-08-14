# Minimal Viable Delivery Plan: Conformance mock-app teardown race

Status: planning
Current slice: 1 — awaiting user approval of the plan

## Intent

Confirmed by the user 2026-08-14.

- Outcome: the `App didn't return close context within 1 sec` race stops moving between tests, so the
  three baselined titles can come out of `conformance-baseline-2.2.json`.
- User: anyone running conformance to judge Sail — the gate is only trustworthy if a red run means a
  real regression rather than a coin flip.
- Success: **all three baselined titles pass across 3 consecutive headless runs, and the baseline file
  drops them.**
- Constraint: the conformance toolbox is vendored upstream code — the fix lands in Sail, never in
  `packages/sail-conformance-harness/2.2-conformance-tests/`. Fix goes **wherever the root cause
  actually is** (agent or harness), decided by diagnosis rather than assumed.
- Out of scope: CI wiring, sail-one/sail-finance headless rollout, the other entries in the DA defect
  register.

## Verify Commands

All run from the repo root. `@finos/sail-desktop-agent` must be built before the harness resolves it
(`npm run build -w @finos/sail-desktop-agent`) — the harness imports its `dist`, not its `src`.

- Full: `npm test -- --run` — end of delivery only
- Focused (harness units): `npm test -w @finos/sail-conformance-harness`
- Focused (agent units, no cucumber): `npx vp test run -w @finos/sail-desktop-agent`
- Focused (agent BDD): `npm run test:cucumber -w @finos/sail-desktop-agent`
- Typecheck/lint: `npm run typecheck && npx vp lint .` — end of delivery only
- Runtime proof (the success bar):
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium npm run test:conformance -w @finos/sail-conformance-harness`
  ~5 min per run; the done bar is 3 consecutive clean runs. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` is
  needed only in this container (its Chromium build predates the pinned Playwright).

## Simplicity Bias

- Policy: the repo's own `minimal-implementation` skill wins over MVP defaults. Note its stated scope
  is `sail-desktop-agent/src`, `sail-platform/src`, `sail-finance/src` — it does **not** name
  `sail-conformance-harness/src`, so harness-side edits fall back to MVP defaults.
- Reuse: existing teardown seams rather than new ones — `harness-instance-lifecycle`,
  `harness-finos-teardown`, `popup-launcher`'s close watcher on the harness side;
  `instance-teardown.ts` / `wcp-connection-management.ts` on the agent side.
- Avoid: new abstraction layers, new config surface, new dependencies, and above all **do not raise
  timeouts to mask the race** — a longer window hides it rather than fixing it.
- Architecture: smallest ordering correction at the point the diagnosis identifies. If the fix turns
  out to need a new seam, say so in the plan before building it.

## Scoping findings (gate 2-3 artifact)

### Hypothesis correction

The working hypothesis carried in from the headless work — "a race between the mock app's
`fdc3.close()` and the harness closing the browsing context" — is **wrong on both halves**:

- `fdc3.close()` never fires in this run. `closeRequest` is gated to FDC3 >= 3.0
  (`sail-desktop-agent/src/handlers/open/handlers.ts:416-425`); the harness runs 2.2. Teardown goes
  through an `app-control` channel handshake instead: Conformance1 broadcasts `closeWindow`, the mock
  replies `windowClosed` / `fdc3.nothing`
  (`sail-conformance-harness/src/harness-finos-teardown.ts:15`, `:31-70`, `:76-110`).
- `unknown-md2-id` is not a Sail value. It is an upstream **fallback literal**:
  `validateMatchingInstanceIds(metadata2.instanceId ?? 'unknown-md2-id', ...)`. It fires when Sail
  returns `AppMetadata` with `instanceId` **undefined** — the no-running-instance branch of
  `handleGetAppMetadataRequest` (`open/handlers.ts:352-368`). `md2` = metadata app instance 2.

Both symptoms are therefore one story: **teardown completes earlier than the toolbox's next query.**

### Ordering hazards found in the code

1. **Disconnect races un-awaited delivery.** `harness-finos-teardown.ts:172-177` runs the observer
   then `return handler(message)` without awaiting; disconnect is `setTimeout(…, 0)` (`:155-161`,
   `deferDisconnectMs` defaults `0` at `:126` and bootstrap never overrides it,
   `harness-bootstrap.ts:115-118`). Disconnect lands next macrotask whether or not `windowClosed`
   reached Conformance1.
2. **Browsing context destroyed before agent state cleanup.** `harness-instance-lifecycle.ts:40`
   closes the window; `:50-52` disconnects agent state after. In-flight DACP responses on that
   MessagePort are lost.
3. **`disconnectApp` never clears `pendingDisconnects`** (`wcp-connection-management.ts:171-183`).
   Only `disconnectAppByInstanceId` (`:133-137`) and `updateConnectionMetadata` (`:209-224`) cancel.
   The harness path leaves a live 2000 ms WCP6 grace timer armed. **This is defect #4 in
   `sail-da-defect-register-2026-08-11.md`, independently rediscovered.**
4. **Relay skips non-`connected` instances** (`harness-browsing-context-close.ts:163-172`). A mock
   still PENDING gets no `closeWindow` and cannot reply inside the toolbox's 1 s budget.
5. **`getAppMetadata` has no ordering guard.** Missing instance -> metadata without `instanceId`
   (`open/handlers.ts:352-368`); a stale surviving instance -> `instances[0]` (`:309`) can return a
   different instanceId than the toolbox opened.

### Reuse — existing seams and tests

Teardown seams already exist on both sides; no new seam should be needed.
Agent: `handlers/instance-teardown.ts`, `app-connection/wcp/wcp-connection-management.ts`,
`agent/sail-desktop-agent.ts:516-519`. Harness: `harness-finos-teardown.ts`,
`harness-instance-lifecycle.ts`, `harness-browsing-context-close.ts`, `popup-launcher.ts`.

Test coverage is already dense (`instance-teardown.test.ts`, `wcp-temp-id-teardown.test.ts`,
`wcp-reconnect-clobber.test.ts`, `harness-finos-teardown.test.ts`,
`harness-instance-lifecycle.test.ts`, `harness-browsing-context-close.test.ts`). **Named gap: no test
asserts a WCP6-armed `pendingDisconnects` timer is cancelled when teardown arrives via
`disconnectInstance` / `pruneAppConnection`.** That is the reproduction test for hazard 3.

### The upstream contract (recovered from sourcemaps)

`src/test/fdc3-conformance-utils.ts` — `closeMockAppWindow` / `waitForContext`:

- Channel is the **app channel** `app-control` via `getOrCreateChannel`, never a user channel.
- Test broadcasts `{type:'closeWindow', testId}`; mock replies `{type:'windowClosed', testId}`.
- Budget is a **hard-coded 1000 ms** (`setTimeout` at line 28), armed **before**
  `channel.addContextListener` is even awaited — so DA listener-registration latency eats the budget.
- **`fdc3.close()` plays no part.** Zero occurrences across the whole toolbox. The mock closes
  **itself**: `await broadcast('windowClosed')` then `setTimeout(() => window.close(), 5)`
  (`src/mock/mock-functions.ts:11-14`; ChannelsApp uses `1` ms,
  `src/mock/support/channel-support.ts:32-35`).

So Sail's only obligations are **delivery latency** and **not dropping the last broadcast from a page
that is about to unload**. This is not a "close" bug at all.

Two upstream fragilities that Sail cannot fix, recorded so we do not chase them:

- `fdc3.getAppMetadata.ts:10-12` — the suite `after()` calls `closeMockAppWindow(title)` with the
  default `count` of **1**, but the test opens **two** `MetadataAppId` instances (`:34`, `:36`).
  Compare `fdc3.findInstances.ts:18`, which correctly passes `2`.
- `fdc3.app-channels.ts:94-105` — ACFilteredContext2 never awaits ChannelsApp readiness, so its
  `afterEach` can broadcast `closeWindow` before the mock registered its listener, leaving a **stale
  ChannelsApp alive into ACFilteredContext3**. That is a plausible non-Sail cause of the
  ACFilteredContext3 failure.

Also: the trace line `fdc3.getAppMetadata.ts:48` is the `catch` arm, not an assertion — every throw
in the test body surfaces there. The line number identifies nothing; only the message text does.

### Failure distribution across three runs

| Test | run 1 | run 2 | run 3 |
|---|---|---|---|
| `getAppMetadata "after all" hook` | FAIL | FAIL | FAIL |
| `getAppMetadata (AppInstanceMetadata)` | pass | FAIL | FAIL |
| `appChannels (ACFilteredContext3)` | pass | FAIL | pass |

**The hook failure is deterministic (3/3), not flaky.** Only the other two wander. This is the anchor
to attack first: a consistent failure is far cheaper to diagnose than an intermittent one, and the
`instanceId: undefined` symptom sits in the same suite.

### Lead to test first (unverified)

`MetadataAppId` carries `forceNewWindow: true`, so both instances launch as popups. On each launch
`mountLaunchedPanel` calls `pruneStalePendingHostInstances({ appId: panel.appId, keepInstanceId:
panel.instanceId })` (`harness-bootstrap.ts:136-141`), which prunes pending host instances **by
appId**. Opening a *second* instance of the same appId may therefore prune the *first* instance's
pending registration before it completes WCP handshake. That would explain both a missing
`instanceId` on `getAppMetadata` and a mock that never receives `closeWindow`. **Slice 1 must confirm
or refute this rather than assume it.**

### Relevant timings

`disconnectGracePeriod` 2000 ms (`browser-app-connection.ts:109`); harness `deferDisconnectMs` 0
(`harness-finos-teardown.ts:126`); popup close poll 100 ms (`popup-launcher.ts:81`); toolbox close
budget **1000 ms** (upstream, fixed — we cannot change it).

## Slices

Ordered so the deterministic failure is attacked first. Slice 2 is **conditional** — it exists only
if slice 1 does not move the runtime bar.

1. **Two instances of one appId survive launch and teardown**
   - Goal: opening two instances of the same `forceNewWindow` appId leaves both individually
     addressable in the agent, and an `app-control` `closeWindow` broadcast reaches both.
   - Acceptance (stated as contract, not mechanism):
     a. after opening two instances of one appId, `getAppMetadata(identifier)` returns
        `instanceId === identifier.instanceId` for **each**, matching what `open()` handed out;
     b. neither `open()` call removes or supersedes the other's instance registration;
     c. a `closeWindow` broadcast on `app-control` is delivered to **both** live instances.
   - Verify: `npm test -w @finos/sail-conformance-harness`
   - Likely files: `src/harness-stale-instance-prune.ts`, `src/harness-bootstrap.ts`,
     `sail-desktop-agent/src/handlers/open/handlers.ts`. Final location decided by the diagnosis.

2. **(Conditional) Do not drop the last broadcast from an unloading page**
   - Trigger: only if slice 1 verifies clean but the runtime bar still fails on the delivery symptom.
   - Goal: an observed `windowClosed` is delivered to its subscribers before the harness tears the
     instance down.
   - Acceptance: teardown of a FINOS mock does not begin until the broadcast that announced it has
     been dispatched to subscribers; no raising of any timeout to achieve this.
   - Verify: `npm test -w @finos/sail-conformance-harness`
   - Likely files: `src/harness-finos-teardown.ts`, `src/harness-instance-lifecycle.ts`.

3. **(Conditional) Cancel the WCP6 grace timer on `disconnectApp`**
   - Trigger: only if the runtime bar still fails after slices 1-2, or review rules it in.
   - Goal: close hazard 3 / register defect #4 — `disconnectApp` leaves a live 2000 ms
     `pendingDisconnects` timer that can fire `onInstanceTeardown` on a relaunched same-id instance.
   - Acceptance: teardown via `disconnectInstance` / `pruneAppConnection` cancels any armed
     `pendingDisconnects` entry; the named test gap is covered.
   - Verify: `npx vp test run -w @finos/sail-desktop-agent`
   - Likely files: `sail-desktop-agent/src/app-connection/wcp/wcp-connection-management.ts`.
   - Note: this is a real latent defect regardless of the conformance bar. If slices 1-2 hit the bar
     without it, it does **not** get folded into this delivery — it goes to Parked Follow-ups and
     stays in the defect register.

## Test Plan

- Unit: none planned standalone — the behaviour is cross-module by nature.
- Integration: slice 1's contract test at the harness+agent boundary (harness drives a real
  `SailDesktopAgent`, as the existing `src/__tests__/*.harness.ts` files already do). This is the
  reproduction test and it must **fail before the fix**.
- Manual/runtime: the conformance suite itself — 3 consecutive clean runs is the success bar. Not a
  substitute for the integration test; it is 5 min per run and cannot localise a cause.
- Not testing: the two upstream toolbox fragilities (`getAppMetadata` `count`=1 for two instances;
  ACFilteredContext2 not awaiting readiness). They are in vendored code we do not modify. If they
  turn out to be the residual cause, they become a Known Limitation, not a slice.

## Agent Roles

Resolved against the agent types available this session. There is no dedicated test-engineer or
code-reviewer agent type here, so those roles run as `general-purpose` carrying the role brief. A
fresh agent per role per slice — never reused across roles.

- coder: `general-purpose`
- tester: `general-purpose` (briefed from Goal/Acceptance only, never the diff)
- reviewer: `general-purpose` (briefed with plan + diff + observed exit status + the three categories
  verbatim; no edit permission)
- security reviewer: not applicable — instance-lifecycle ordering, no auth, secrets, user input,
  payments, or destructive storage
- explorer: `Explore` (used in step 2; two ran — Sail-side teardown map, and the upstream toolbox
  close contract)

## Risks

- **The success bar may not be fully achievable.** Two of the three baselined titles may be caused by
  upstream toolbox fragility (see Scoping findings) that no Sail change can fix. If so, emptying the
  baseline entirely is impossible and the honest outcome is a *smaller* baseline plus a documented
  Known Limitation. Raise this with the user rather than forcing the bar.
- **`getAppMetadata` instanceId is a genuine spec obligation.** `getAppMetadata(x).instanceId === x.instanceId`
  is round-trip identity required by FDC3, so the `instanceId: undefined` symptom is a real product
  defect worth fixing on its own merits, independent of the conformance score.
- **Runtime proof is slow and stochastic.** 3 runs is ~15 min and still only 3 samples of an
  intermittent failure. The deterministic hook failure is the reliable signal; treat the two wandering
  ones as weaker evidence either way.
- **Temptation to widen the timeout.** Explicitly barred in Simplicity Bias. The upstream 1000 ms is
  hard-coded in vendored code and cannot be changed anyway.

## Slice Checkpoints

## Verification Notes

## Review Notes

- Required:
- Follow-up:
- Ignore for MVP:

## Parked Follow-ups

## Known Limitations

## Evidence carried in from the headless conformance work

Two full headless runs (`npm run test:conformance -w @finos/sail-conformance-harness`, commit
`49eb51d`) scored 83/84 and 81/84. The failures move between runs:

| Test | run 1 | run 2 |
|---|---|---|
| `fdc3.getAppMetadata "after all" hook` | failed — `App didn't return close context within 1 sec` | failed — same |
| `fdc3.getAppMetadata (AppInstanceMetadata) App instance metadata is valid` | passed | failed — `expected 'unknown-md2-id' to equal 'b246b87c-…'` |
| `fdc3.appChannels (ACFilteredContext3)` | passed | failed — `App didn't return close context within 1 sec` |

All three are baselined in `packages/sail-conformance-harness/results/conformance-baseline-2.2.json`
so the gate is not red at random. That baseline is the thing this delivery should be able to shrink.

Hypothesis (unverified): a race between the mock app's `fdc3.close()` and the harness closing the
browsing context, with the `getAppMetadata` instanceId mismatch as a knock-on from an instance that
was not torn down before the next test ran.
