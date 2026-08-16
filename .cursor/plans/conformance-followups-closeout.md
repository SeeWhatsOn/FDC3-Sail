# Minimal Viable Delivery Plan: closing the conformance open()-timing follow-ups

Status: implementing
Current slice: 5 (S3-F1)

> **Parent plan:** `.cursor/plans/conformance-open-timing.md` (Status: done, 83/83 success bar met).
> That delivery left nine Parked Follow-ups and one parked slice. This file closes them. It is a
> separate file rather than a section of the parent because the parent is already ~700 lines and its
> record of a *met* success bar should stay intact and readable.

## Intent

Directed by the user 2026-08-16: *"work this plan to completion... the sail-desktop-agent should
remain pure."* No clarifying round was possible — the user is unavailable until PR review — so the
Intent below is derived from that instruction plus the parent plan's own parked lists, and every
judgement call it required is recorded explicitly under "Scoping decisions" rather than left implicit.

- Outcome: every Parked Follow-up and the parked slice in the parent plan is **closed** — either
  fixed with a regression test, or closed with a written reason for not fixing it. No item is left
  in an undecided state.
- User: whoever picks this branch up next. Today the parked list reads as unfinished work with no
  indication which entries are real defects and which are noise; after this, the parent plan's
  backlog is empty and the DA defect register is one entry shorter.
- Success: **all parked items resolved; `npm test -- --run`, `npm run typecheck` and the conformance
  suite all still green** — specifically the conformance suite still scores 83/83 with an empty
  baseline, proving none of these fixes regressed the bar the parent plan achieved.
- Constraint: **`@finos/sail-desktop-agent` stays pure** per `AGENTS.md:147` — headless, protocol-only
  FDC3/DACP/WCP, no FINOS toolbox orchestration, no Sail chrome, no `@finos/sail-platform` dependency
  in `src/`. This rules out the one fix that would need host browsing-context liveness plumbed into
  the agent (see Scoping decisions, item F1-mirror).
- Out of scope: the parent plan's own out-of-scope items remain out — sail-one/sail-finance headless
  rollout, and the DA defect register entries other than #4 (which the parent plan had already
  adopted as its parked slice 4).

## Verify Commands

Run from repo root. `@finos/sail-desktop-agent` must be built before the harness resolves it, and
`@finos/sail-platform` must be built before `sail-one`'s tests collect:
`npm run build -w @finos/sail-desktop-agent && npm run build -w @finos/sail-platform`.

- Full: `npm test -- --run` — end of delivery only
- Focused (agent, vitest + 154 BDD scenarios): `npm test -w @finos/sail-desktop-agent` — slices use this
- Focused (harness): `npm test -w @finos/sail-conformance-harness`
- Typecheck/lint: `npm run typecheck && npx vp lint .` — end of delivery only
- Runtime bar (regression proof, end of delivery):
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium npm run test:conformance -w @finos/sail-conformance-harness`
  ~5 min/run. The parent plan needed 3 clean runs to *establish* the bar; this delivery needs only to
  prove it did not *break* it, so 2 runs.

**Pre-change baseline recorded before any edit:** `npm test -w @finos/sail-desktop-agent` -> exit 0
(1460 cucumber steps passed); `npm test -w @finos/sail-conformance-harness` -> exit 0.

## Simplicity Bias

- Policy: the repo's `minimal-implementation` skill wins (its stated scope covers
  `sail-desktop-agent/src`, which is where four of five slices land). Harness-side edits fall back to
  MVP defaults.
- Reuse: every fix extends something that already exists — the `launchContext` ternary already in
  `registerOpenWithContext:72-74`, the `cancelPendingDisconnect` helper already at
  `wcp-connection-management.ts:38-46`, and four existing test files. **No new source file, no new
  test file, and no new dependency is expected in this delivery.**
- Avoid: new abstractions, new config surface, new host contracts, and any timeout change.
- Architecture: smallest correction at each named site. Slice 8 is the only one that may add a field
  to an existing type; if a suitable ordering signal already exists on `AppInstance`, reuse it.

## Scoping decisions (gate 2-3 artifact)

Verified against the working tree by a read-only explorer, 2026-08-16. Every parked item was
re-read at its cited site and confirmed still live unless noted. Three items are being **closed
without a code change**, and the reasons are recorded here so the decision is reviewable:

- **S3-F4 (double predicate evaluation in `resolvePendingOpens`)** — closing as *no change*. The
  parent plan's own note says "No behavioural difference; lists are tiny." Confirmed: `open-with-context.ts:130`
  and `:139` filter the same list twice, and that list holds pending opens for a single instanceId.
  Rewriting two `.filter` calls as one pass buys nothing measurable and touches working code.
- **F1-mirror (the Known Limitation)** — closing as *will not fix, documented*. Repairing the mirror
  direction of the concurrent same-appId reap needs the host's browsing-context liveness signal
  (the harness has it as `popupWatcher.hasPopup()`), which would mean a new host contract inside the
  agent. That is exactly the impurity `AGENTS.md:147` forbids. The limitation stays documented in
  the parent plan.
- **F1-ordering** — this is a *different* bug from F1-mirror and it **is** fixable purely inside the
  agent, so slice 8 takes it. `reconcileOrphanPendingHostInstances` derives registration order from
  `Object.values(state.instances)` (`wcp-host-instance-adoption.ts:75`), and JS enumerates
  integer-like keys first in numeric order ahead of every string key regardless of insertion order.
  So an `open({ instanceId: "7" })` row sorts to index 0 whatever its real age. Post-slice-3 the
  failure is user-visible: two `open()` calls resolving to one instanceId, or a 15 s `AppTimeout`.

Confirmed still live and being fixed: S3-F1, S3-F5, F2, and parked slice 4. Confirmed missing and
being added: the S3-F2, F3 and F4 tests.

## Slices

1. **Slice 5 — a failed plain `open()` says why it actually failed** (closes S3-F1)
   - Goal: when a pending open is cleared because either side disconnected, the error message matches
     what the caller actually asked for — plain opens must not be told a *context listener* timed out.
   - Acceptance:
     a. A pending **plain** open cleared by target-instance disconnect reports "Timed out waiting for
        app to connect".
     b. A pending **with-context** open cleared the same way still reports "Timed out waiting for
        context listener".
     c. Both hold on the source-instance disconnect path too.
     d. `errorType` stays `OpenError.AppTimeout` on every path — message only, no error-code change.
   - Verify: `npm test -w @finos/sail-desktop-agent`
   - Likely files: `src/handlers/utils/open-with-context.ts` (sites at `:182` and `:214`; copy the
     ternary already at `:72-74`), plus a test.

2. **Slice 6 — a WCP4 handshake that succeeded never gets a failure response** (closes S3-F5)
   - Goal: work performed *after* the WCP5 success response is on the wire cannot cause a second,
     contradictory failure response for the same handshake.
   - Acceptance:
     a. If the post-success step throws, the app keeps its successful WCP5 and **no**
        `sendFailureResponse` is emitted for that `connectionAttemptUuid`.
     b. The throw is still logged, not swallowed silently.
     c. A genuine validation failure *before* the success response still sends the failure response
        exactly as today.
   - Verify: `npm test -w @finos/sail-desktop-agent`
   - Likely files: `src/app-connection/wcp/wcp-identity-validation.ts` (success sent at `:282`,
     `notifyInstanceConnected` at `:294`, `catch` at `:295`), plus a test.

3. **Slice 7 — a stale WCP6 grace timer cannot tear down a relaunched instance**
   (closes parked slice 4, and defect register #4)
   - Goal: tearing a connection down cancels any armed disconnect grace timer for it, so an instance
     relaunched on the same id inside the grace window is not torn down by the previous session's timer.
   - Acceptance:
     a. After WCP6 arms the grace timer for an instance, disconnecting that instance clears the
        armed entry.
     b. Advancing time past `disconnectGracePeriod` afterwards fires no `onInstanceTeardown`.
     c. The `disconnectInstance` -> `pruneAppConnection` -> `disconnectApp` path inherits (a) without
        each caller needing its own cancel.
     d. `disconnectAppByInstanceId` and `updateConnectionMetadata`, which already cancel, are unchanged
        in behaviour.
   - Verify: `npm test -w @finos/sail-desktop-agent`
   - Likely files: `src/app-connection/wcp/wcp-connection-management.ts` (`disconnectApp` at `:171-183`;
     reuse `cancelPendingDisconnect` at `:38-46`), plus a test. Also update
     `.cursor/plans/sail-da-defect-register-2026-08-11.md` entry #4 to FIXED.

4. **Slice 8 — orphan reconciliation uses real registration order** (closes F1-ordering, F2, F3)
   - Goal: the orphan/concurrent-launch discrimination rests on an explicit ordering signal rather
     than on JS object-key enumeration order, and its not-found branch fails safe.
   - Acceptance:
     a. Given an earlier-registered instance whose id is integer-like (e.g. `"7"`) and a later one
        with a uuid, reconciliation treats the integer-like row as the **earlier** one — i.e. the
        documented rule holds for every id shape.
     b. When the validated instance is not found in the list, **no** rows are reaped (today it reaps
        every PENDING row of that appId — the destructive direction).
     c. Existing behaviour is unchanged for uuid-only ids: `wcp-multi-pending-adoption.integration.test.ts`
        still passes untouched.
     d. `reconcileOrphanPendingHostInstances` gains direct unit cover over at least three orderings.
   - Verify: `npm test -w @finos/sail-desktop-agent && npm test -w @finos/sail-conformance-harness`
     (bound to both: this is the function the harness's multi-pending integration test exercises.)
   - Likely files: `src/handlers/utils/wcp-host-instance-adoption.ts` (`:56-108`); possibly the
     instance type/mutator if no ordering signal exists yet; tests in
     `src/handlers/utils/__tests__/wcp-host-instance-adoption.test.ts`.
   - Note: reuse an existing ordering field on `AppInstance` if one is already there. Only add a
     monotonic sequence field if nothing suitable exists, and say so in the diff.

5. **Slice 9 — pin the two contracts this delivery left untested** (closes S3-F2, F4)
   - Tests only; no production change expected.
   - Goal: the contracts slice 3 of the parent plan established are guarded by tests that fail if the
     behaviour regresses.
   - Acceptance:
     a. An agent-package test fails if `openResponse` for a **plain** open is emitted before the
        launched instance completes WCP4/WCP5. (`apps.feature:67-73` cannot catch this — its
        `Then messaging will have outgoing posts` step matches **unordered**.)
     b. The harness two-instance test asserts criterion (b) of parent slice 1 directly —
        `wcp5InstanceId === openedInstanceId` for **each** instance — instead of only the
        signal-free `first.openedInstanceId !== second.openedInstanceId` at
        `harness-two-instances.test.ts:48`, which two `randomUUID`s satisfy trivially.
   - Verify: `npm test -w @finos/sail-desktop-agent && npm test -w @finos/sail-conformance-harness`
   - Likely files: `packages/sail-desktop-agent/src/app-connection/__tests__/wcp-desktop-agent.integration.test.ts`,
     `packages/sail-conformance-harness/src/harness-two-instances.test.ts`.

## Test Plan

- Unit: slice 8's direct cover of `reconcileOrphanPendingHostInstances` over three orderings (F3).
- Integration: slices 5, 6, 7 and 9a each extend an existing integration test file — these are
  cross-module behaviours (wire responses, timers, handshake ordering) that unit tests cannot prove.
- Manual/runtime: the conformance suite, twice, at end of delivery. Regression proof only.
- Not testing: S3-F4 and F1-mirror, both closed without code change (see Scoping decisions). The
  `-1` branch of slice 8b is unreachable from its single call site, so it gets a direct unit test at
  the function level rather than an end-to-end one.

## Agent Roles

Resolved against this session's agent types; no dedicated test-engineer or code-reviewer type exists,
so those roles run as `general-purpose` carrying the role brief. **Model: `sonnet` for all subagents**,
per the user's instruction. A fresh agent per role per slice — never reused across roles.

- coder: `general-purpose` (sonnet)
- tester: `general-purpose` (sonnet) — briefed from Goal/Acceptance only, never the diff
- reviewer: `general-purpose` (sonnet) — briefed with plan + diff + observed exit status + the three
  categories verbatim; no edit permission
- security reviewer: not applicable — error-message text, timer cancellation, and list ordering. No
  auth, secrets, user input, payments, or destructive storage.
- explorer: `Explore` (sonnet) — one ran, for the Scoping decisions above

## Risks

- **Slice 8 is the only one that can regress the parent plan's bar.** It changes the function at the
  heart of the concurrent-launch repair that got the suite to 83/83. Its acceptance (c) exists to
  catch that, and the end-of-delivery conformance runs are the backstop.
- **Slice 6 could mask a real failure.** Moving work out of the `try` must not turn a genuine
  post-success error into silence; acceptance (b) requires it still be logged.
- **Slice 9a may be hard to assert without touching timing.** If pinning the ordering needs a new
  waiting mechanism rather than the existing `waitForPortMessage` helper, that is a signal the test
  is wrong, not that the helper is missing — park it and say so rather than inventing machinery.
- **No user available mid-flight.** The 3-failure stop rule cannot escalate to the user. If a slice
  hits 3 failures, it stops, is recorded as blocked with its diagnosis, and the delivery continues
  with the remaining slices rather than stalling the whole run.

## Slice Checkpoints

- [x] Slice 5 (S3-F1): **verified, reviewed, PASSED** (failures: 0). Commit `2419c4d`.
- [x] Slice 6 (S3-F5): **verified, reviewed, PASSED** (failures: 0). Commit `84c1024`.
- [x] Slice 7 (parked slice 4 / register #4): **verified, reviewed, PASSED** (failures: 0). Commits
      `0d59ce0` (fix) + `59d4cdb` (tests).
- [ ] Slice 8 (F1-ordering, F2, F3): not started (failures: 0)
- [ ] Slice 9 (S3-F2, F4): not started (failures: 0)

## Verification Notes

- `npm run build -w @finos/sail-desktop-agent && npm run build -w @finos/sail-platform` -> exit 0 (pre-change)
- `npm test -w @finos/sail-desktop-agent` -> exit 0 (pre-change baseline)
- `npm test -w @finos/sail-conformance-harness` -> exit 0 (pre-change baseline)

**Slice 5.** Reproduction proved first: with the two source hunks reverted,
`npx vp test run src/handlers/__tests__/instance-teardown.test.ts` -> **exit 1**, 2 failed / 22
passed — exactly the two plain-open cases, failing with `expected 'Timed out waiting for context
listener' to be 'Timed out waiting for app to connect'`, both with-context cases still green. The
tester had run only *after* the coder's fix landed, so its own tests passed on first execution and it
could argue non-vacuity only from reading the diff; this run is the missing artifact.
- `npm test -w @finos/sail-desktop-agent` -> **exit 0** (394 passed / 1 skipped; 154 scenarios,
  1460 steps). Diff 2 files, +104/-2.

**Slice 6.** Reproduction proved first: with the source hunk reverted,
`npx vp test run src/app-connection/__tests__/wcp-temp-id-teardown.test.ts` -> **exit 1**, 1 failed /
5 passed, and stderr caught the defect in the act —
`[AppConnectionRegistry] Cannot send to temp-post-success-throw-uuid ... { messageType:
'WCP5ValidateAppIdentityFailedResponse' }`, i.e. a failure response genuinely being emitted for a
handshake that had already succeeded. The criterion (c) over-correction guard passed pre-fix, as
intended.
- `npm test -w @finos/sail-desktop-agent` -> **exit 0** (396 passed / 1 skipped; 154 scenarios,
  1460 steps). Diff 2 files, +155/-11.

**Slice 7 (fix only, tests pending).** `npm test -w @finos/sail-desktop-agent` -> **exit 0** (396
passed / 1 skipped). This proves the +5/-0 change regresses nothing; it does **not** prove it fixes
the defect. Committed as `0d59ce0` to keep the branch clean, with the slice left unticked until its
test exists and has been watched to fail without the fix.

## Review Notes

### Slice 5 (S3-F1), fresh reviewer at `2419c4d`

- **Required:** none.
- **Follow-up:** the new `it.each` block repeats setup boilerplate already present in the two
  pre-existing disconnect tests above it in `instance-teardown.test.ts`; a shared fixture builder
  would cut ~40 lines. Polish only — the duplication matches the file's existing style.
- **Ignore for MVP:** extracting a `pendingTimeoutMessage(pending)` helper for the three occurrences
  of the ternary. Correctly declined under `minimal-implementation`, which keeps a function for reuse
  rather than line-count hygiene.

Two things the reviewer established that the slice had only assumed:

- **The discriminator is provably sound, not merely plausible.** `PendingOpenWithContext.launchContext`
  is `launchContext?: Context` (`state/types.ts:302`), `Context` always carries a required
  `type: string`, and `handleOpenRequest` (`open/handlers.ts:107`) rejects anything failing
  `isValidContext` before it reaches `registerOpenWithContext`. So a genuine with-context open can
  never present `{}`, `null`, or any other falsy context, and the ternary cannot misreport in the
  other direction. This was the slice's one real correctness risk.
- **No fourth site was missed.** A package-wide grep for `"Timed out waiting for"` found exactly the
  three production sites — the one pre-existing ternary and the two this slice converted.

### Slice 6 (S3-F5), fresh reviewer at `84c1024`

- **Required:** none.
- **Follow-up:** none for the source change.
- **Ignore for MVP:** a comment spelling out *why* a `linkHandshakeRoutingId` failure is safe to
  swallow. The existing comment already states the invariant; a threat-model aside for an unreachable
  branch is over-explaining.

The slice widened beyond the parked item, and the reviewer settled the question that raised:

- **A third post-success statement existed.** The parked note named `startHeartbeat` and
  `notifyInstanceConnected`; the routing migration `linkHandshakeRoutingId` also runs after the
  success send and carries the same hazard. It is now protected too.
- **"Log and continue" is right for it — the "CONNECTED but unroutable" worry does not hold.** The
  mutator is a pure object spread over a required, always-populated state field, so it cannot
  realistically throw; and `setState` is `this.state = callback(this.state)`, so a throw inside the
  callback leaves state untouched rather than corrupted. If the link were somehow never written, the
  only casualties are straggler messages still keyed by the pre-migration temp id — normal traffic
  uses the validated instanceId the client got in the WCP5 payload. Strictly less bad than tearing
  down a live connection, so it must **not** be special-cased into a teardown.
- **The coder's stated rationale for the nested try was imprecise.** It claimed the block consumes
  "many locals" computed in the outer try; in fact only `instanceId` would need pre-declaration. The
  real cost of hoisting is that the block would have to run after the outer `catch`, which does not
  rethrow — so it would need a `succeeded` flag to avoid also running after a genuine validation
  failure. Nested try is still the right call; only the explanation was wrong.

### Slice 7 (parked slice 4 / register #4), fresh reviewer at `59d4cdb`

- **Required:** none.
- **Follow-up:** (a) a separate pass could drop `disconnectAppByInstanceId`'s now-redundant inline
  cancel (`wcp-connection-management.ts:133-137`); left in place because acceptance (d) requires that
  function's behaviour unchanged, and it costs nothing as a second safety net. (b) the register's
  trigger description needed correcting — **applied**, see below.
- **Ignore for MVP:** none.

The reviewer confirmed the id-matching argument (temp handshake ids and validated uuids occupy
non-overlapping formats, so `resolveInstanceId` returns a validated id unchanged and the cancel lands
on the key WCP6 armed) and the re-entrancy ordering. It also answered the reachability question the
tester's masking finding raised, and the answer **corrects the defect register**:

- The chain register #4 cites — `disconnectInstance` -> `pruneAppConnection` -> `disconnectApp` —
  does leave the timer armed, but cannot produce the same-id collision by itself.
  `disconnectInstance` always pairs the prune with `cleanupInstanceDacpState`, which deletes
  `state.instances[X]`, and `canReuseExistingIdentity` requires that record — so WCP4 mints a fresh
  id instead of reusing X, and the stale timer has no new session to hit.
- The reachable trigger is `SailDesktopAgentApps.disconnect()`'s fallback
  (`sail-desktop-agent-controllers.ts:287-295`), used whenever the bound `AgentAppConnection` lacks
  the **optional** `disconnectAppByInstanceId` — the minimal headless edge this package exists to
  support. It prunes *without* `cleanupInstanceDacpState`, so the instance record survives, a
  reconnect can legitimately reuse X, and a handshake slower than the remaining grace window loses
  the race. Severity "major" stands; only the mechanism was mis-attributed.

Register entry #4 is now marked FIXED and carries this correction.

## Parked Follow-ups

- Carried from the parent plan, closed without code change: **S3-F4** (double predicate evaluation,
  no behavioural difference) and **F1-mirror** (needs host liveness in the agent; barred by the
  purity constraint). Both reasoned in Scoping decisions.

## Known Limitations

- The parent plan's Known Limitation stands unchanged: concurrent same-appId launches are repaired in
  only one direction. Slice 8 makes the *rule* honest for every id shape, but it does not and cannot
  repair the mirror case without the host liveness contract.
