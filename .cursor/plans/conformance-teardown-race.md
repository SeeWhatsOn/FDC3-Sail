# Minimal Viable Delivery Plan: Conformance mock-app teardown race

Status: scoping
Current slice: —

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

## Slices

## Test Plan

- Unit:
- Integration:
- Manual/runtime:
- Not testing:

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
