# Minimal Viable Delivery Plan: Conformance mock-app teardown race

Status: implementing
Current slice: 3 — full loop (tester -> coder -> reviewer), tester dispatched

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
- Focused (agent units + BDD): `npm test -w @finos/sail-desktop-agent`
  (NOT `npx vp test run -w <pkg>` — `vp` reads `-w` as **watch mode** and the package name as a
  filename filter, so it finds no tests and hangs in DEV mode.)
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

### CORRECTION (user, 2026-08-14): treat everything as Sail-side

The user reports having previously achieved a **100% pass rate** with this toolbox. That refutes the
"unfixable upstream" framing below and removes the Known-Limitation escape hatch.

It specifically kills the `count`=1 argument: if 100% was reachable, then waiting for **one**
`windowClosed` is sufficient — `waitForContext` resolves on the first matching reply and the second
is a harmless stray. So a failing hook means **neither** mock replied inside 1000 ms, which is a
delivery-latency problem on Sail's side, not an upstream oversight.

The same logic applies to ACFilteredContext2: if the agent delivers promptly, the ChannelsApp
registers its `closeWindow` listener in time. Both items below are therefore **in scope to fix**, and
the success bar (empty the baseline) is treated as reachable.

Committed history has no 100% export — `results/` tops out at v6 (53/26), and v3-v5 are worse. The
100% run therefore came from a different setup (different branch, shell, or toolbox profile).
**Finding that setup is the highest-value shortcut available** and is an open question with the user.

Retained below for reference only — these are upstream *fragilities*, not upstream *blockers*:

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

2. **Do not drop the last broadcast from an unloading page** — TRIGGERED, in progress
   - Trigger fired: slice 1 verified clean, runtime bar still fails on the delivery symptom alone.
   - Scope note: slice 1's criterion (c) already proved the **outbound** leg (`closeWindow` reaches
     both live instances). Slice 2 is the **return** leg — the mock's `windowClosed` reply getting
     back to the test-side subscriber before the mock's own `window.close()` lands 1-5 ms later.
   - Goal: a `windowClosed` broadcast from a mock reaches every other subscriber on `app-control`
     even though the mock destroys its browsing context immediately afterwards, and even though the
     harness observes that same broadcast and starts tearing the instance down.
   - Acceptance (contract, not mechanism):
     a. A `windowClosed` broadcast from instance X on `app-control` is delivered to a subscriber on
        another instance, when X's browsing context closes immediately after broadcasting.
     b. The harness observing `windowClosed` and disconnecting X does not prevent (a).
     c. With **two** live instances of one appId both replying to a single `closeWindow`, at least
        the first reply reaches the subscriber. (The toolbox waits for `count`=1, so one is enough —
        this is the exact shape of the failing `getAppMetadata` after-hook.)
   - Verify: `npm test -w @finos/sail-conformance-harness`
   - Likely files: `src/harness-finos-teardown.ts`, `src/harness-instance-lifecycle.ts`,
     `src/harness-browsing-context-close.ts`. Final location decided by the diagnosis.
   - Barred: raising, padding, or adding any timeout.

3. **`open()` must not resolve before the launched app has connected** — APPROVED, in progress
   - Supersedes the old slice 3 (WCP6 grace timer), which is renumbered 4 and stays parked.
   - Why: confirmed by instrumented run. `handleOpenRequest` sends `openResponse` immediately for a
     plain open (`handlers/open/handlers.ts:172-177`), so the toolbox tears an app down 38-60 ms
     before it has registered its `closeWindow` listener.
   - **Blast radius is one branch.** The waiting machinery already exists and is already used on the
     other two launch paths:
     | Path | Waits today? |
     |---|---|
     | `open()` **with** context | yes — `registerOpenWithContext`, 15 s `openContextListenerTimeoutMs` |
     | `raiseIntent` launching an app | yes — `intent-launch-helpers.ts:73-75`, 15 s poll loop |
     | `open()` **without** context | **no — responds immediately** |
     Channel/listener/broadcast calls are unaffected: they run on an already-connected app and
     already respond only after the work is done (confirmed in the diagnostic log).
   - Goal: a plain `open()` resolves only once the launched app has connected, so the caller can
     immediately interact with it.
   - Acceptance (contract, not mechanism):
     a. `openResponse` for a plain `open()` is not sent until the launched instance has connected.
     b. Immediately after `open()` resolves, the app can receive a broadcast on an app channel it
        subscribed to during its own startup. (This is the conformance-relevant contract.)
     c. If the app never connects, `open()` rejects with an FDC3 `AppTimeout` error rather than
        hanging forever.
   - Verify: `npm test -w @finos/sail-conformance-harness` and `npm test -w @finos/sail-desktop-agent`
     (bound to BOTH because this changes core `open()` timing that the BDD suite exercises).
   - Likely files: `sail-desktop-agent/src/handlers/open/handlers.ts`, and whatever it reuses from
     `handlers/utils/open-with-context.ts`.
   - Barred: raising or padding any timeout; introducing a new waiting mechanism when one exists.
   - Risk to watch: `open()` currently returns fast. Anything depending on that speed gets slower.
     The 390 unit tests and 154 BDD scenarios are the canary.

4. **(Parked) Cancel the WCP6 grace timer on `disconnectApp`**
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

- [x] Slice 1: **verified, reviewed, PASSED** (failures: 0). Runtime effect below.
- [ ] Slice 2: **triggered** — its conditional fired. Slice 1 verified clean but the runtime bar
      still fails on the delivery symptom.
- [x] Slice 1 detail (failures: 0) — reproduction by tester, fix by coder, both verify
  commands run by main agent at exit 0. Review pending.

## Verification Notes

### Runtime effect of slice 1 (clean run, nothing else touching the repo)

| Test | before (3 runs) | after slice 1 |
|---|---|---|
| `getAppMetadata (AppInstanceMetadata)` | FAIL, FAIL, pass | **PASS** |
| `appChannels (ACFilteredContext3)` | pass, FAIL, pass | **PASS** |
| `getAppMetadata "after all" hook` | FAIL, FAIL, FAIL | **still FAIL** |

Score 83 passed / 1 failed (297s), from 81-83 with three different failures. The identity defect is
fixed: the `unknown-md2-id` symptom is gone and the round-trip holds.

The residual is the *teardown handshake only* — `App didn't return close context within 1 sec` — and
it is still the deterministic one (now 4/4 across all runs). It is NOT the R1 mirror case, which
would show as an identity failure; identity now passes. This is delivery, which is exactly slice 2's
trigger condition.

- `npm run build -w @finos/sail-desktop-agent && npm test -w @finos/sail-conformance-harness`
  -> **exit 0** (slice 1, after fix: 72 passed / 15 files). Observed by main agent.
- `npm test -w @finos/sail-desktop-agent` -> **exit 0** (slice 1, after fix: 390 unit tests +
  154 BDD scenarios / 1460 steps). Observed by main agent. The three named guards
  (`wcp-temp-id-teardown`, `wcp-reconnect-clobber`, `instance-teardown`) and
  `wcp-multi-pending-adoption.integration.test.ts` all still pass.
- `npm test -w @finos/sail-conformance-harness` -> **exit 1** (slice 1, reproduction stage:
  3 failed / 69 passed). Observed by main agent, not reported by the subagent. A deliberately
  failing repro is not a slice failure — the slice is not claimed complete.

### Slice 1 root cause — FOUND, and it refutes the plan's own lead

The `pruneStalePendingHostInstances` lead recorded in Scoping findings is **refuted**. The tester
instrumented the launch and observed `disconnectInstance` is never called during it; the harness
guard `popupWatcher.hasPopup()` correctly skips instance 1.

The removal is **agent-side**, in
`packages/sail-desktop-agent/src/handlers/utils/wcp-host-instance-adoption.ts`:
`reconcileOrphanPendingHostInstances`, called unconditionally from `wcp-identity-validation.ts` on
every non-reconnect validation, removes **every** PENDING instance of the same appId other than the
one just validated. When two instances of one appId launch concurrently, instance 2 is still PENDING
(its browsing context has not loaded yet) at the moment instance 1's WCP4 validates — so instance 2's
registration is deleted. Instance 2's own WCP4 then finds nothing to adopt, falls through to
`createAppInstance`, and mints a fresh id that no caller ever received.

One defect explains all three criteria:
- (b) direct: the id `open()` returned is no longer the id the instance ends up with.
- (a) knock-on: `handleGetAppMetadataRequest` takes its no-running-instance branch
  (`open/handlers.ts:352-368`) and returns metadata with `instanceId` omitted -> `unknown-md2-id`.
- (c) knock-on: both broadcast paths address instances by id, so the caller's id is unreachable.

**Why this reconciles with the user's 100% interactive run:** the defect is timing-dependent, not
unconditional. It fires only when instance 2 is still PENDING as instance 1 validates. Interactive
timing (human-paced, different popup focus behaviour) can let instance 1 finish WCP4 before instance
2 is opened at all, in which case nothing is over-pruned.

**Constraint flagged by the tester:** adoption has two routes — WCP1 `window.name` host-identifier,
and the WCP4 claimed-`instanceId` route. Only the claimed-id route is exercised by these tests
(`DacpTestAppConnection.getConnection()` returns `undefined`, so `hostIdentifier` cannot resolve
headlessly). A fix must be correct for **both**.

### Slice 2 reproduction did NOT reproduce — premise refuted

All three slice 2 criteria **pass unmodified** (`harness-window-closed-return.test.ts`, 75 tests
exit 0, verified by main agent). The tester mutation-checked them — swapping the expected `testId`
for `"MUTANT"` fails all three — so they bite; the deliveries are real.

Mechanism observed: **reply delivery is synchronous with the mock's `broadcastRequest`**, so neither
the self-close nor the harness teardown can get in front of it. `SailDesktopAgent.start()` registers
`message => { void this.handleMessage(message) }` (`agent/sail-desktop-agent.ts:282`); `handleMessage`
has no `await` before `routeDACPMessage`, which runs the handler synchronously inside
`Promise.resolve(handler(...))` before its first `await`. So
`handleBroadcastRequest -> notifyContextListeners -> sendOutbound` all complete inside the inbound
call. The harness observer only schedules `setTimeout(disconnect, 0)` — a macrotask, which cannot
preempt a synchronous fan-out. The mock's `setTimeout(window.close, 5)` is likewise a macrotask, and
the popup watcher polls at 100 ms.

Criterion (c) is stronger than required: **both** replies land, not just the first.

**Conclusion: the DACP layer is sound and slice 2's premise is wrong.** The residual cannot be
explained by anything this contract covers. It must live in something the jsdom fixture abstracts
away — most plausibly the real browser wire (a closing popup's `MessagePort` / `BrowserAppConnection`
teardown, or `onAppDisconnected` on a path the fixture has no analogue for), or the mock never
receiving/answering `closeWindow` at all in the real after-hook. Next investigation should target the
`BrowserAppConnection` edge, not channel routing — and needs Playwright-level instrumentation,
since jsdom cannot model a destroyed browsing context's port.

### Defect introduced by slice 1 and missed — typecheck

`src/__tests__/harness-two-instances.harness.ts` carried an unused `BrowserTypes` import, breaking
`npm run typecheck -w @finos/sail-conformance-harness` (TS6133, exit 2). **It was committed and
pushed in `ee98774` and survived slice 1's review.** Cause: the plan binds typecheck as an
end-of-delivery command only, and neither the coder, the reviewer, nor I ran it per-slice. Removed;
typecheck now exit 0. The plan's per-slice guidance is arguably wrong for a slice that adds new
files — noted as a process lesson rather than re-litigated here.

### ROOT CAUSE CONFIRMED by instrumented run (option A)

A diagnostic Playwright run captured every console line from every page (54,994 lines). The vendored
toolbox logs the handshake itself, so this is evidence, not inference.

Timeline of the failing `(AppInstanceMetadata)` after-hook:

```
21366ms  metadata popup 1 opens (about:blank)
21441ms  metadata popup 2 opens
21647ms  after-hook broadcasts closeWindow
         -> "Notifying context listeners {contextType: closeWindow,
             totalInstancesOnChannel: 0, instanceIds: Array(0)}"
         -> "notification complete {successful: 0, failed: 0, total: 0}"
21685ms  metadata instance 1 registers its closeWindow listener   (38 ms late)
21707ms  metadata instance 2 registers its closeWindow listener   (60 ms late)
```

**Nobody was subscribed to `app-control` when the `closeWindow` went out.** No recipient, so no
`windowClosed` reply, so the toolbox's 1000 ms budget expires. At 21653 ms the metadata page is still
mid-startup, servicing `getCurrentChannelResponse`.

Corroborating fingerprint: the `(AppInstanceMetadata)` listener is never unsubscribed by
`waitForContext`, so it logs `Wrong test id expected: (AppInstanceMetadata)... got: <test>` for every
subsequent test from 23152 ms to the end of the run. It was alive and waiting the whole time — it
simply never received a matching reply.

**Underlying cause: `fdc3.open()` resolves before the launched app has connected.**
`handleOpenRequest` pre-registers the instance synchronously and sends `openResponse` immediately
(`handlers/open/handlers.ts:152-177`) without awaiting WCP4. The test therefore proceeds — assertions
and after-hook — while the popup is still booting. The whole open->assert->teardown sequence completed
within ~280 ms of the popups opening, faster than they could load.

This reconciles every observation:
- the user's interactive 100%: real browser, popups load well before a human-paced teardown;
- headless failure: the suite advances faster than a popup boots;
- slice 2's tests all passing: the delivery layer genuinely is sound — this is ordering, not delivery;
- why it is the metadata suite: it opens two apps back-to-back then tears down immediately.

**Slice 3 candidate:** `open()` must not resolve before the launched app has connected. That is also
the spec-correct behaviour, and it is a product change in `sail-desktop-agent`, so it needs the user's
call before implementing — it changes the timing contract of every `open()` in the system.

### Slice 3 review (fresh reviewer at `b4d020c`)

- **Required:** R1 — `wcp-multi-pending-adoption.integration.test.ts:34-37` and `:213-216` asserted
  the opposite of the code's actual behaviour, claiming the outstanding plain open "only ever
  produces a late `AppTimeout`". It does not: reaping the orphan row migrates that pending open onto
  the validated instance, which answers it **successfully with an id L1 never launched**. **Applied**
  — both comments corrected, and the migration site now documents that a plain open can be answered
  with a substituted instanceId. No logic change was requested or made. Taken by the main agent under
  the step-10 single-obvious-edit exemption (comment text only), re-verified below.
- **Follow-up:** F1-F5, parked below.
- **Ignore for MVP:** I1 fixture helper duplication (matches the directory convention, same as slice
  1's I2); I2 one redundant `getInstance` lookup on the with-context path; I3 `registerOpenWithContext`
  / `open.pendingWithContext` now also hold context-free opens but renaming touches mutators,
  selectors, types and several tests for zero behaviour change.

**Correction to the coder's report, caught by the reviewer.** The coder described the
`open-with-context.ts` change as "a net deletion". It is **+72/-48** on that file (+55/-31 ignoring
whitespace), and **+85/-59, net +26** across the four implementation files. The mechanism claim held
up — `resolvePendingOpens` is a faithful generalisation of the deleted `partitionPending`, same state
read, same write, same clear-and-deliver loop, only the predicate injected — but the size claim was
wrong and had been relayed to the user before being checked.

**Verified no side effect on the working with-context path.** The reviewer walked all five touch
points and confirmed the existing branch is behaviourally identical, with `apps.feature:76-86`
(broadcastEvent before openResponse) and `:88-96` (AppTimeout without a listener) as untouched
pre-existing regression guards, both green.

**Blast radius confirmed narrower than feared.** `sail-one` and `sail-finance` launch via
`SailDesktopAgent.openApp` (`agent/sail-desktop-agent.ts:457-483`), which calls the launcher directly
and never enters `handleOpenRequest`. `sail-platform` has no open path. No shell or harness source
calls `fdc3.open()` over DACP — the only producers are the conformance mock apps.

## Review Notes

Slice 1, reviewed by a fresh reviewer agent at `3885e01`.

- **Required:** R1 — the code comment asserted the order rule as an implication when it is a
  heuristic, and its failure direction was recorded nowhere. **Applied**: comment reworded to name
  the residual and why it is deliberate; Known Limitations populated. Taken by the main agent under
  the step-10 single-obvious-edit exemption (comment text only, no logic change), re-verified below.
- **Follow-up:** F1-F4, parked below. None folded into the slice.
- **Ignore for MVP:** I1 slice-then-filter over the whole map (same result, same cost); I2 fixture
  duplication with `harness-open-with-context.harness.ts` (follows the directory's convention);
  I3 fixture imports agent `src` not `dist` (matches the sibling fixture, deliberate).

Reviewer independently re-ran both verify commands at exit 0 and confirmed the diff is exactly three
files with no reformat, no unrelated edit, and no timeout touched. It also confirmed the three
reproduction tests assert real state/wire output rather than mock calls, and that the untested
`window.name` adoption route is safe because reconcile is downstream of adoption and sees only the
resolved id.

## Parked Follow-ups

From the slice 3 review:

- **S3-F1** — `open-with-context.ts:182` and `:214` still hardcode "Timed out waiting for context
  listener", now sent to plain opens when either side disconnects. `registerOpenWithContext:72-74`
  already distinguishes the two messages; these two sites did not get the same treatment.
- **S3-F2** — no test in `@finos/sail-desktop-agent` pins the new contract. `apps.feature:67-73`
  passes under both orderings, so a regression in `notifyInstanceConnected` would be caught only by
  the harness package.
- **S3-F3** — applied above, in Known Limitations.
- **S3-F4** — `resolvePendingOpens` evaluates its predicate twice per entry where `partitionPending`
  did one pass. No behavioural difference; lists are tiny.
- **S3-F5** — `notifyInstanceConnected` sits inside the WCP4 `try` after `sendOutbound(WCP5)`, so a
  throw while delivering `openResponse` would fire `sendFailureResponse` for a handshake that already
  succeeded. Narrow; the with-context path has the same shape.

From the slice 1 review. None were folded into the slice.

- **F1** — the order rule silently inverts for integer-like instanceIds, which are reachable today
  via `open({ instanceId: "7" })` (`app-launcher.ts:53`, `sail-finance/src/main.tsx:40`) and the
  host-injectable `createId` (`sail-platform/src/workspace/store.ts:102`). Two-sided: such a row
  sorts to index 0 so it is reaped by any sibling validation, and when it is the validated row
  nothing is ever reaped (orphan leak). Now named in the code comment; no guard added.
- **F2** — `validatedIndex === -1` currently falls back to reaping every PENDING row of the appId,
  the more damaging direction. `Math.max(validatedIndex, 0)` is shorter and fails safe. Left alone
  because the branch is unreachable at the single call site; take it if that ever changes.
- **F3** — no direct unit test on `reconcileOrphanPendingHostInstances` in the agent package. ~20
  lines over three orderings would pin the documented behaviour, including the R1 direction.
- **F4** — criterion (b) is only covered transitively. One
  `expect(second.wcp5InstanceId).toBe(second.openedInstanceId)` would assert it directly. Also
  `expect(first.openedInstanceId).not.toBe(second.openedInstanceId)` is trivially true for two
  `randomUUID`s and carries no signal.

## Known Limitations

**Concurrent same-appId launches are only repaired in one direction.** (Reviewer R1, slice 1.)

`reconcileOrphanPendingHostInstances` discriminates orphan from concurrent launch by registration
order. That repairs the direction the conformance suite actually hits — a *later* launch being
reaped, i.e. the `unknown-md2-id` symptom. It does **not** repair the mirror: if the later launch's
browsing context completes WCP4 *first*, the earlier PENDING row is reaped even though it was never
abandoned, and its own WCP4 mints an id no caller holds.

Nothing serialises which of two concurrent launches connects first — `handleOpenRequest` returns
`openResponse` before WCP4 (`handlers/open/handlers.ts:173-177`).

This is not fixable by tightening the rule: `wcp-multi-pending-adoption.integration.test.ts:178-179`
*requires* the earlier row be reaped in exactly that "later row validates first" shape. A later
launch reaching WCP4 first is the only abandoned-launch signal the agent has. Only the host knows
whether a browsing context is still alive — the harness already has that signal in
`popupWatcher.hasPopup()` (`harness-stale-instance-prune.ts`) — so a full fix means plumbing
liveness into the agent as a new host contract, well beyond this slice.

**If the 3-consecutive-clean-run bar fails on the same symptom, this is the reason — do not
re-derive it.**

**Updated after slice 3 (reviewer F3).** The symptom of the mirror case has changed. It is no longer
"its own WCP4 mints an id no caller holds". Now that a plain `open()` waits, the reaped row's pending
open is *migrated* onto the validated instance, so the caller either:

- receives the **other instance's** id — two `open()` calls resolving to one instanceId — when the
  orphan row sorts before the validated one; or
- waits the full 15 s for `AppTimeout` when it sorts after (reachable via the integer-like-id case
  recorded as F1 below).

Documented at the migration site in `wcp-host-instance-adoption.ts`. Still better than the pre-slice
outcome, where the caller was handed an id whose browsing context was already gone.

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
