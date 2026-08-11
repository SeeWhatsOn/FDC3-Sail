# Minimal Viable Delivery Plan: DACP handler deps refactor

Status: implementing
Current slice: **Collapse `pendingIntentPromises`** (replaces slice 4). Slice 2 renamed and deferred; slice 3 pending.

> ### Decisions taken 2026-08-12, after two independent discovery agents
>
> **Do not restructure the parameter.** "18 fields, seven kinds" counts the *declaration*. At use sites it is already narrow — the median handler reads **4 of 18**, no function reads more than 7, and five fields (`getState`, `responses`, `instanceId`, `logger`, `setState`) carry **87% of all reads**, with a 3.9× cliff after them. Grouping into `config` / `host` sub-objects would add a hop at ~41 destructure sites and 22 test files to tidy a declaration nobody reads. It also breaks the flat-spread idiom, which is load-bearing in **production** (`routeDACPMessage`, `cleanupInstanceDacpState`, `teardownInstance` all do `{ ...context, instanceId }`), not just in tests. Factory/closure and class variants rejected: ~300 edits, and a class contradicts AGENTS.md's "one class, `SailDesktopAgent`".
>
> **Name: `DACPHandlerParams` / `params`** — user decision, explicitly provisional ("can rename later"). `deps` was rejected as too abbreviated. Recorded honestly: `params` has **32 existing occurrences across 6 files**, all meaning "*this* function's options bag", so it is measurably worse on greppability than `deps` (1 hit). `agentApi` and `agent` were ruled out — the first collides with FDC3's `DesktopAgent` and implies a user-facing surface, the second has 719 hits. `env` (1 hit) and `backing` (18, one file, and the only candidate with precedent in this package for this exact shape) remain the strongest alternatives if the name is revisited.
>
> **Slice 4 (deps-last ordering) is CUT** — pure aesthetics, ~20 signatures plus every call site, no behaviour change. One item survives it: `schedulePendingIntentDelivery`'s two adjacent positional booleans are a real transposition hazard and are a one-file fix on their own.
>
> **The real defect is lifetime, not width** — see Parked Follow-ups. Four long-lived timers capture a request-scoped object; `startHeartbeat` holds one in a `setInterval` for the instance's whole life, so its captured `instanceId` is the WCP4 `temp-…` id forever.

> Slice 2 scope note: `DACPHandlerContext` is **not** exported from `src/index.ts` — it is internal to the package, so this rename breaks no public API and needs no deprecation alias. 48 files reference it or `createDACPTestContext`.
>
> Per the Test Plan, slice 2 gets **no new tests** — `tsc --noEmit` is the proof, and the existing 373 unit tests plus 154 Cucumber scenarios must come out at identical counts. A changed count means it was not a pure rename.

Worktree: `.claude/worktrees/handler-deps-refactor` · branch `refactor/dacp-handler-deps` · based on `fix/da-test-suite-realignment` (**not** `main` — main is 261 commits behind and does not contain this handler code).

## Intent

- **Outcome:** `instanceId` reaching a DACP handler is authoritative by construction, and `context` means exactly one thing (an FDC3 `Context`) across `packages/sail-desktop-agent/src`.
- **User:** anyone writing or reviewing a DACP handler. Today a new handler written by copy-paste silently inherits whichever instance-id convention it copied from, and a wrong choice fails only inside the WCP handshake window.
- **Success:** zero handler bodies call an instance-id resolver; zero `{ ...context, instanceId }` re-spreads; zero uses of `context` for the dependency bundle; `npx vp test run && npx cucumber-js` green at each slice.
- **Constraint:** `packages/sail-desktop-agent/src` is governed by the repo's `minimal-implementation` YAGNI skill. Fewest **edits**, not fewest layers. No compatibility shims (v3-pre default).
- **Out of scope:** branding the id (`ResolvedInstanceId` nominal type); a `DacpRequestScope` wrapper object; any change to what the two resolvers *decide*; performance work on `createHandlerContext`.

## Verify Commands

Run from `packages/sail-desktop-agent/` unless stated (repo convention, matches `sail-da-test-suite-realignment.md`).

- **Full:** `npx vp test run && npx cucumber-js`
- **Focused:** `npx vp test run src/handlers`
- **Typecheck/lint/format:** `npx tsc --noEmit` · `npx vp lint .` · `npx vp fmt --check .`
- **Cross-package (slice 2 only):** `npx vp test run` from the **worktree root** — the rename crosses into `app-connection/` and `agent/`.

### Baseline recorded before any edit

Measured at `31ea68def`, **after** the D3 rebase (see below). Pre-rebase numbers were 22/111 and 53/344.

| Command | Where | Result |
|---|---|---|
| `npx vp test run src/handlers` | package | exit 0 — **24 files / 121 tests** |
| `npx tsc --noEmit` | package | exit 0 |
| `npx vp test run` | package | exit 0 — **55 files / 354 tests** |
| `npx cucumber-js` | package | exit 0 — **154 scenarios / 1460 steps** |
| `npx vp lint .` | package | exit 0 — 0 errors |
| `npx vp test run` | worktree root | exit 0 — **71 files / 472 tests** (monorepo, pre-rebase) |

> Note: `npx tsc --noEmit` from the **worktree root** fails with `TS6053: File '…/packages/sail-ui' not found` — a pre-existing root tsconfig reference, unrelated to this work. Always typecheck from the package directory.

## Simplicity Bias

- **Policy:** repo-local `minimal-implementation` skill (wins over MVP defaults).
- **Reuse:** both existing resolvers (`resolveDacpHandlerInstanceId`, `resolveCleanupInstanceId`) keep their current logic untouched. Existing tests `wcp-host-instance-id.test.ts`, `broadcast-stale-instance.test.ts`, `cleanup.test.ts` are the starting harness.
- **Avoid:** new wrapper types, new files, a unified "one resolver to rule them all", migration aliases like `export type DACPHandlerContext = DacpHandlerDeps`.
- **Architecture:** no new layers. Slices 1 and 3 move existing code between existing seams; slices 2 and 4 are renames and signature reorders.

---

## Finding that changes the original recommendation

The review said *"resolve once in `routeDACPMessage`"*. Reading the call graph in this worktree shows **`routeDACPMessage` is 1 of 5 entry points** that build a handler context:

| # | Entry point | Site | Id it stamps |
|---|---|---|---|
| 1 | `routeDACPMessage` | `sail-desktop-agent.ts:328` | `meta.source.instanceId` |
| 2 | `handleWcp4ValidateAppIdentity` | `sail-desktop-agent.ts:373` | `temp-${connectionAttemptUuid}` — deliberately not yet registered |
| 3 | `cleanupDACPHandlers` (WCP6Goodbye) | `sail-desktop-agent.ts:383` | wire id |
| 4 | `cleanupDACPHandlers` (disconnect / teardown) | `sail-desktop-agent.ts:395`, `:519` | instance id |
| 5 | `createChannelOperations` | `sail-desktop-agent-controllers.ts:177` | host-supplied id |

And there are **two** resolvers with genuinely different rules, not one:

- `resolveDacpHandlerInstanceId` (`utils/resolve-context-listener-instance-id.ts:20`) — registered **instance** → handshake link → input.
- `resolveCleanupInstanceId` (`cleanup.ts:20`) — active **heartbeat** → `temp-`-prefixed link → input.

They are not interchangeable: cleanup deliberately keys off heartbeats so it can tear down an instance whose FDC3 state is already gone. So resolving in the router alone would fix entry 1 and leave 2–5 as they are, and collapsing the two resolvers would be a behaviour change nobody asked for.

**Revised approach for slice 1:** resolve at *each* entry point with *that entry point's* resolver, and delete resolution from handler bodies. `cleanupDACPHandlers` already does exactly this internally (`cleanup.ts:67`) — the slice generalises the pattern it already demonstrates.

---

## Explorer map (slice 1) — the problem is larger than the review found

The `Explore` agent enumerated every construction site and every read. Corrections to the numbers above:

- **12 entry points, not 5.** The 5 in the table are the `createHandlerContext` callers; there are 7 more where a context is *derived* by spreading: `cleanup.ts:70` and `:165`, `heartbeat/handlers.ts:58`, `broadcast/handlers.ts:46`, `open/handlers.ts:436`, plus `sail-desktop-agent-controllers.ts:177`.
- **17 uses are authorization decisions, not routing** — and **9 of them read the id raw**, including every private-channel membership gate (`private-channels/handlers.ts:103`, `:171`, `:261`, `:315`).

### Three latent bugs this slice must decide about

These already exist on `main`. Slice 1 either fixes them or must consciously preserve them.

1. **Cross-resolver disagreement on close (Chain A).** `handleCloseRequest` resolves with `resolveDacpHandlerInstanceId` (`open/handlers.ts:408`), calls `appLauncher.close()` on that id (`:434`), then hands it to `teardownInstance` → `cleanupDACPHandlers`, which **re-resolves it with `resolveCleanupInstanceId`** (`cleanup.ts:72`). The two resolvers key off different things (registered instance vs active heartbeat), so **the instance that gets closed is not guaranteed to be the instance that gets torn down.**
2. **Register-raw / unsubscribe-resolved asymmetry.** Listeners are *registered* under the raw id (`events/handlers.ts:61`, `intent-listener-handlers.ts:90`) but *unsubscribed* under the resolved id (`:110`, `:133` — the ownership checks added by `8a62fd386`). When raw ≠ resolved, an app can register a listener it can never unsubscribe.
3. **Two ids live at once.** `handleIntentResultRequest` holds raw `instanceId` (`intent-result-handlers.ts:66`) for response routing and resolved `resolvedInstanceId` (`:84`) for its ownership gate, in the same function.

Bug 2 is the one that argues hardest for this slice: resolving once at the entry point makes register and unsubscribe agree **by construction**.

---

## Slices

### 1. Make `instanceId` authoritative at the entry point

- **Goal:** every handler body can trust `instanceId` without calling a resolver. Resolution happens once, where the context is built, using the resolver that entry point requires.
- **Behavioural note:** this is **not** a pure refactor. The ~22 sites that currently trust the raw wire id will start receiving the resolved id. For most that is a no-op (the ids are equal outside the handshake window). For the handlers listed under Risks it is a real change and needs a test that pins the new behaviour.
- **Acceptance:**
  - `resolveDacpHandlerInstanceId` is called from exactly one place on the DACP path, not from 8 handler bodies.
  - The two ownership checks added by `8a62fd386` (`listener.instanceId !== instanceId` in `events/handlers.ts` and `intent-listener-handlers.ts`) behave identically. `cross-instance-unsubscribe.test.ts` stays green **without edits** — if it needs editing, stop and report.
  - `{ ...context, instanceId }` appears zero times in `src/handlers` (currently 4: `broadcast:46`, `cleanup:143`, `heartbeat:58`, `open:436`).
  - `intent-listener-handlers.ts:47` and `:125` use the same id source.
  - Both resolvers keep their current decision logic byte-for-byte.
  - Full verify green, including Cucumber.
- **Verify:** `npx tsc --noEmit && npx vp test run && npx cucumber-js`
- **Likely files:** `handlers/index.ts`, `agent/sail-desktop-agent.ts`, `handlers/broadcast/handlers.ts`, `handlers/events/handlers.ts`, `handlers/open/handlers.ts`, `handlers/intents/intent-listener-handlers.ts`, `handlers/intents/intent-result-handlers.ts`, `handlers/cleanup.ts`, `handlers/heartbeat/handlers.ts`

### 2. Rename `DACPHandlerContext` → `DacpHandlerDeps`, `context` → `deps`

- **Goal:** end the name collision. `context` becomes free to mean an FDC3 `Context` everywhere.
- **Acceptance:**
  - Type renamed; parameter renamed at all 68 non-test signatures plus tests.
  - `handlerContext` (18 uses in `broadcast/handlers.ts`) is gone — slice 1 removed its reason to exist.
  - The five defensive aliases collapse back to `context`: `broadcastContext`, `validatedContext`, `launchContext`, `storedContext`, `contextToDeliver`.
  - No exported alias left behind for the old name.
  - Zero behaviour change: same test counts as slice 1's run.
- **Verify:** `npx tsc --noEmit && npx vp test run && npx cucumber-js`, then `npx vp test run` from the worktree root.
- **Likely files:** all 29 files matching `DACPHandlerContext`, plus `handlers/__tests__/test-context.ts` (`createDACPTestContext`).

### 3. Extract a required `DacpHandlerConfig`

- **Goal:** config stops being optional, so defaults are resolved once at construction instead of three times at point of use.
- **Acceptance:**
  - `DacpHandlerConfig` holds the 7 config fields, all required, no `?`.
  - `createDACPTestContext` supplies the defaults so tests need no change to call sites.
  - The three `logPayloadDetail ?? "metadata"` fallbacks are deleted (`handlers/index.ts:27`, `broadcast/handlers.ts:367`, `intent-raise-intent.ts:38`), and the `validation ?? "warn"` fallback in the handler path with them.
  - `appLauncher`, `requestIntentResolution`, `disconnectInstance`, `notifyChannelMembershipChanged` stay optional — those are genuinely absent in some configurations.
- **Verify:** `npx tsc --noEmit && npx vp test run && npx cucumber-js`
- **Likely files:** `handlers/types.ts`, `agent/sail-desktop-agent.ts`, `handlers/__tests__/test-context.ts`, the 3 fallback sites.

### 4. ~~Normalise argument order to deps-last~~ — **CUT**, replaced by the collapse below

### 4′. Collapse `pendingIntentPromises`

- **Goal:** delete a parallel store that exists to hold non-serializable promise handles which no longer exist. `PendingIntentPromiseEntry.resolve` / `.reject` are written **only** at `intent-raise-shared.ts:128` as `() => {}` and are never replaced, so `intent-result-handlers.ts:115` and `instance-teardown.ts:95` call no-ops in production. Real settlement happens by wire response — which is why defect #1 needed `20515fdbf` at all.
- **Where each field goes:**
  - `resolve`, `reject` → **deleted**. Also deletes three tautological assertions that check a callback the test itself supplied (`instance-teardown.test.ts` ×2, `intent-result-handlers.test.ts` ×1) — the same family the slice 1 security auditor already caught.
  - `delivered`, `requestType` → onto `PendingIntent` in `AgentState`. Both are plain serializable data, both keyed by the same `requestId`, and both maps are already populated adjacently in the same call sequence.
  - `timeoutHandle`, `deliveryTimeoutHandle` → stay out of Immer state; already tracked in `intent-pending-timeout-registry.ts`.
- **The risk, stated plainly:** `delivered` is currently mutated **through a captured reference** (`intent-delivery-helpers.ts:135`, `:179`) while `setState` **replaces the tree**. Moving it into `AgentState` changes the mutation semantics. `:179` writes unconditionally, whereas the block needing the state entry is guarded by `if (pendingIntent)` at `:170` — under a state-backed `delivered` that write has nowhere to land once the entry is resolved. The `requestType` read at `:161` also happens *before* the state lookup at `:169`, so an ordering change is needed.
- **Acceptance:**
  - `PendingIntentPromiseEntry` and the `pendingIntentPromises` field are gone from `handlers/types.ts` and from the context.
  - No production code calls a no-op callback.
  - `state.intents.pending[requestId]` carries `delivered` and `requestType`.
  - The four tests that construct their own `Map` to assert on it are converted to assert on state instead, not deleted.
  - Behaviour unchanged: identical Cucumber count, and the intent settlement paths from `8a62fd386` / `20515fdbf` still work.
- **Verify:** `npx tsc --noEmit && npx vp lint . && npx vp test run && npx cucumber-js` — run **sequentially, not in parallel** (see the flake note in Parked Follow-ups).
- **Likely files:** `handlers/types.ts`, `state/types.ts`, `state/mutators/intent.ts`, `handlers/intents/intent-raise-shared.ts`, `handlers/intents/intent-delivery-helpers.ts`, `handlers/intents/intent-result-handlers.ts`, `handlers/instance-teardown.ts`, `agent/sail-desktop-agent.ts`, `handlers/__tests__/test-context.ts`, plus 4 test files.

- **Goal:** one rule — `deps` is always the last parameter — so call sites are recognised rather than read.
- **Acceptance:**
  - `deps` is last in every signature that takes it. The ~20 helpers that currently lead with it move; the ones already last (`startHeartbeat`, `launchAppAndWaitForInstance`, `deliverCurrentContextToListener`, `notifyPrivateChannelUnsubscribe`) do not change.
  - `schedulePendingIntentDelivery`'s two adjacent booleans become a named options object.
  - No other 4+ positional-parameter helper in `handlers/intents` keeps adjacent same-typed parameters.
- **Verify:** `npx tsc --noEmit && npx vp test run && npx cucumber-js`
- **Likely files:** `handlers/intents/intent-raise-shared.ts`, `handlers/intents/intent-delivery-helpers.ts`, `handlers/cleanup.ts`, `handlers/heartbeat/handlers.ts`

---

## Test Plan

Risk is concentrated almost entirely in slice 1. Slices 2 and 4 are compiler-checked renames; slice 3 is compiler-checked plus three deleted fallbacks.

- **Unit (slice 1, required):**
  - The handshake window: a context stamped with a `temp-` id or an unregistered MessagePort id, for each handler family that currently trusts the raw id — private-channels, channels, open, intent-discovery. Assert which instance the effect lands on. **These are characterization tests: write them before the change, against current behaviour, so the diff shows exactly what slice 1 alters.**
  - `intent-listener-handlers` add vs unsubscribe now agree on the id.
  - `cleanup` still resolves by heartbeat, not by instance — a guard that slice 1 did not accidentally unify the resolvers.
- **Integration (slice 1):** existing `wcp-host-instance-id.test.ts` and `broadcast-stale-instance.test.ts` must stay green unchanged. If either needs editing, that is a signal the slice changed more than intended — stop and report.
- **Manual/runtime:** none. Cucumber (`test/features/`) already covers the WCP handshake end-to-end.
- **Not testing:** the renames in slices 2 and 4 — `tsc --noEmit` is the proof. No new tests for slice 3 beyond the existing suite; deleting a fallback whose branch is now unreachable needs no test of its own.

## Agent Roles

Resolved against the agent types available this session.

**Model policy (set 2026-08-12).** None of these agent definitions declare a `model:`, so with the `model` parameter omitted they silently **inherit the parent session model** — every subagent through slice 1 ran on Opus 5. From here the model is chosen per dispatch:

| Work | Model | Why |
|---|---|---|
| Mechanical sweeps — the `DacpHandlerParams` rename, straightforward test scaffolding | `sonnet` | Compiler-checked, low judgement |
| Adversarial and subtle — security audit, code review, and any slice with non-obvious semantics | `opus` | This is where the reasoning earned its keep in slice 1 |

The `pendingIntentPromises` collapse stays on **opus** throughout: it is not mechanical (a captured-reference mutation meeting `setState` tree replacement), and weak test design already produced two false-positive suites this delivery — tests that passed for the wrong reason.

- **coder:** `general-purpose`
- **tester:** `agent-skills:test-engineer`
- **reviewer:** `agent-skills:code-reviewer`
- **security reviewer:** `agent-skills:security-auditor` — **applicable to slice 1 only.** `resolveDacpHandlerInstanceId`'s doc comment records that an earlier tier read app-authored `meta.hostInstanceId` and let any app act as another live instance (`closeRequest` reaches `appLauncher.close`). Moving resolution is a change at that trust boundary.
- **explorer:** `Explore` — needed at the start of slice 1 to enumerate every site that reads the id, and at the start of slice 4 to enumerate signatures.

## Risks

- **Slice 1 changes behaviour for handlers that currently trust the raw id.** Highest concern: `private-channels/handlers.ts` (5 sites), where the id gates `connectedInstances` membership — resolution changing the id changes an access-control check. Mitigation: characterization tests first; security reviewer on the slice.
- **The two resolvers could get accidentally unified** during slice 1 because they look similar. They are not. Mitigation: explicit acceptance criterion plus a guard test.
- **Slice 2's rename crosses package boundaries** (`app-connection/wcp/wcp-identity-validation.ts`, `agent/`). Mitigation: root-level `npx vp test run` in that slice's verify.
- **The base branch is 261 commits ahead of `main` and still moving.** If `fix/da-test-suite-realignment` lands or rebases mid-flight this branch needs a rebase. Mitigation: land slices promptly; do not let this branch run long.
- **Slice 1 touches an access-control path.** `8a62fd386` made the resolved id load-bearing for listener-ownership checks in `events/handlers.ts` and `intent-listener-handlers.ts`. Moving where resolution happens moves what those checks compare. Mitigation: `cross-instance-unsubscribe.test.ts` must pass unedited; security reviewer on the slice.
- ~~**Uncommitted work was left behind.**~~ Resolved by D3 — landed as `8a62fd386` / `31ea68def` and rebased in.

## Decisions Taken

- **D1 — Slice 1 mechanism: (a) resolve at the entry point, keep the id on the context field.** Each of the 5 entry points resolves with *its own* resolver before stamping the context; handler bodies stop resolving. No signature churn. Rejected (b) — a positional `(message, instanceId, deps)` argument — because it costs 68 signature changes and still only fixes entry point 1, leaving 2–5 to do the field-based thing anyway.
- **D2 — Scope: all four slices**, in the listed order.
- **D3 — Resolved.** The pending work was landed on `fix/da-test-suite-realignment` and this branch was rebased onto it. See below.

### D3 outcome

The uncommitted work turned out to be a **finished, verified MVD slice** (`.cursor/plans/mvd-sail-da-slice-a.md`, `Status: done`) closing register findings #1 and #2 — pending intents never settling, and cross-instance unsubscribe. It is now:

- `8a62fd386` fix(desktop-agent): settle pending intents and reject cross-instance unsubscribes
- `31ea68def` docs(agents): correct default-user-channels path and note single AgentState owner

`refactor/dacp-handler-deps` was rebased onto `31ea68def` with no conflicts. Two incidental fixes were needed to get it committed and are folded into `8a62fd386`:

- `core.hooksPath` was set to an absolute `C:\…` path in the `da-test-realignment` worktree, which Git Bash mangles — the exact failure AGENTS.md documents. Reset to the relative `.vite-hooks/_`. **This is per-worktree local config; a fresh worktree may need it again.**
- The two new test files had 16 lint errors (`await-thenable` / `require-await`) — the unsubscribe handlers are synchronous, so the `await`s and `async`s were removed.

**This changes finding A's numbers.** That commit added `resolveDacpHandlerInstanceId` to two more handlers, so slice 1 now consolidates **8** scattered calls, not 6:

| File | Line | Added by |
|---|---|---|
| `broadcast/handlers.ts` | 45, 164, 286 | pre-existing |
| `open/handlers.ts` | 408 | pre-existing |
| `intent-result-handlers.ts` | 84 | pre-existing |
| `intent-listener-handlers.ts` | 125 | pre-existing |
| `events/handlers.ts` | ~103 | **`8a62fd386`** |
| `intent-listener-handlers.ts` (unsubscribe) | ~125 | **`8a62fd386`** — now gates a `listener.instanceId !== instanceId` ownership check |

The last two are **load-bearing for access control**. Slice 1 must preserve those ownership checks exactly; `cross-instance-unsubscribe.test.ts` (10 tests) is the guard and must stay green without edits.

## Slice Checkpoints

- [x] 1 Authoritative instanceId: **verified | reviewed | done** (failures: 0)
  - explorer (`Explore`) — mapped 12 entry points, 17 authorization uses, 3 latent bugs ✔
  - tester (`agent-skills:test-engineer`) — characterization tests, re-pointed through the router after the coder found they bypassed it; 20 tests total ✔
  - coder (`general-purpose`) — resolution moved to `routeDACPMessage`, 8 handler-body calls deleted ✔
  - reviewer (`agent-skills:code-reviewer`) — approve after one comment fix; Required resolved ✔
  - security reviewer (`agent-skills:security-auditor`) — safe to land; Required (tautological test) resolved ✔
  - Three separate contexts throughout; no agent reused across roles. Main agent took the step-10 exemption **once**, for the one-condition `cleanup.ts` fix committed separately as `20515fdbf`.
- [ ] 2 Rename to DacpHandlerDeps: not started (failures: 0)
- [ ] 3 Required DacpHandlerConfig: not started (failures: 0)
- [ ] 4 deps-last argument order: not started (failures: 0)

## Verification Notes

**Pre-rebase, at `aec4c41ac`:**

- `npx vp test run src/handlers` (package) -> exit 0, **22 files / 111 tests**
- `npx tsc --noEmit` (package) -> exit 0
- `npx vp test run` (package) -> exit 0, **53 files / 344 tests**
- `npx vp test run` (worktree root) -> exit 0, **71 files / 472 tests** (monorepo)
- `npx cucumber-js` (package) -> exit 0, **154 scenarios / 1460 steps**

**D3 — verifying the pending work before committing it (in `da-test-realignment`):**

- `npx vp test run` (package) -> exit 0, **55 files / 354 tests** (+2 files / +10 tests over the tip)
- `npx tsc --noEmit` (package) -> exit 0
- `npx vp lint .` -> exit 1, **16 errors** in the two new test files -> fixed -> exit 0, **0 errors**
- `npx vp test run` on the two new files -> exit 0, **2 files / 10 tests**

**Post-rebase baseline, at `31ea68def` (this is the number slice 1 must not regress):**

- `npx vp test run src/handlers` (package) -> exit 0, **24 files / 121 tests passed**

**Correction — the recorded Cucumber baseline above was wrong.** It was measured from the *worktree root* of `da-test-realignment`, not the package directory. Re-measured at `3fd0f3b3c` with a clean tree, `npx cucumber-js` was **exit 1, 1 scenario failing** (`disconnect-cleanup.feature:30`). Confirmed by a controlled comparison: identical failure with and without slice 1's changes at the same commit, so it was **not** caused by slice 1. Root cause was a defect in `8a62fd386`, fixed in `20515fdbf` — see Known Limitations.

**Slice 1 — verified by the main agent, not taken from a subagent report:**

| Command | Where | Result |
|---|---|---|
| `npx tsc --noEmit` | package | exit 0 |
| `npx vp lint .` | package | exit 0 — 0 errors (2 pre-existing in `packages/sail-finance/vite.config.ts`, missing `@tailwindcss/vite`, unrelated) |
| `npx vp test run src/handlers` | package | exit 0 — **26 files / 140 tests** (from 24/121: +2 files, +19 tests) |
| `npx vp test run` | package | exit 0 — **57 files / 373 tests** |
| `npx cucumber-js` | package | exit 0 — **154 scenarios / 1460 steps** |

Intermediate states worth keeping, because they are the behavioural delta:

- With slice 1 applied and the characterization tests still calling handlers **directly**: 4 failures. All four were harness artifacts — they relied on the handler body self-resolving, which is exactly what the slice deletes. Not production deltas.
- Re-pointed through `routeDACPMessage`, **9 of 14 verdicts flipped**. That is the real delta. See the slice 1 outcome section.

## Review Notes

### Slice 1 — security audit (`agent-skills:security-auditor`)

**Verdict: safe to land.** One Required finding, and it was against a test, not the production change.

The claim under test — *"the handshake link is written by the DA on WCP5 success and cannot be authored by an app"* — is **half true**. The link **target** (validated instanceId) cannot be influenced by an app; verified across three vectors (chosen uuid, reconnect, WCP4/WCP5 race). Reconnect is blocked by `canReuseInstanceIdentity` comparing `sourceWindow` by **object identity**, which an in-page attacker cannot forge. But the link **key** is `temp-${connectionAttemptUuid}`, taken verbatim from the app's WCP1Hello with no uniqueness check and no format validation (`wcp1-3-handshake.ts:55`).

**Residual risk (question B) is provable, not a race.** At WCP5 success `connections.delete("temp-U")` frees the key, but the `temp-U → V` link survives for V's **entire lifetime** — `clearHandshakeRoutingIdsForInstance` filters by link *target*, never by key (`wcp-handshake-routing.ts:32`). Any later WCP1Hello reusing uuid `U` resolves to V. The only barrier is knowing V's `connectionAttemptUuid`, which the audit traced as **not observable cross-origin** and is 122 bits from `crypto.randomUUID`. Not practically exploitable — but the routing id is now effectively a **bearer capability**.

**What bounds the whole risk:** outside the handshake window the resolver returns the registered instance before ever consulting the link table, so raw == resolved and the change is a **pure no-op**. In the browser edge the widened branch is close to unreachable for legitimate traffic — `updateConnectionMetadata` rekeys the port to `V` *synchronously, before* the link is written. The widened path is load-bearing for the test/conformance harness and stale-id teardown, not the browser hot path.

Also confirmed: `handleCloseRequest` is behaviourally identical (one app still cannot close another), and the slice **fixes** the Chain A close/teardown divergence as a side effect. Private-channel deletion on creator disconnect is FDC3-correct lifecycle, not a bug.

- **Required (resolved):** `handshake-window-instance-id.test.ts:239` asserted a tautology — `routeDACPMessage` never reads `meta.source`, so the "spoofed" field was inert and the test would pass with the resolver deleted. It duplicated `:211`. **Deleted**, replaced by a comment pointing at the real coverage: `wcp-trusted-metadata.test.ts`, test *"attributes a broadcast to the sending port, not an app-claimed meta.hostInstanceId"* (verified to exist). The genuine boundary is `enrichMessageWithSource` at `browser-app-connection.ts:225-228`, one layer above the router.
- **Follow-up:** validate `connectionAttemptUuid` is UUID-shaped and reject one colliding with a live link — ~3 lines, closes question B outright. **Highest-value next hardening item.**
- **Follow-up:** add `clearHandshakeRoutingId(state, routingId)` so links can be cleared by key as well as by value; today's safety rests on an unwritten ordering invariant.
- **Follow-up:** `handleWindowMessage` (`browser-app-connection.ts:184`) accepts WCP1Hello from any origin. Pre-existing, not introduced here.
- **Follow-up:** reword the `routeDACPMessage` doc comment — it says "during the WCP handshake window", but the link outlives the handshake by the linked instance's full lifetime.
- **Follow-up:** note in the slice summary that response routing now addresses the resolved id for ~22 handlers. A fix in the browser edge; a visible change in the harness. Characterized at `handshake-window-instance-id.test.ts:442`.
- **Ignore for MVP:** `DacpTestAppConnection.receiveMessage` bypasses `enrichMessageWithSource`, so the test edge feeds caller-authored `meta.source` to `extractInstanceId`. Test-only, trusted author, and the conformance harness uses the real `BrowserAppConnection`.

**Praised:** the seam-guard test (`handshake-window-instance-id.test.ts:304`) that deliberately calls a handler directly so it fails if anyone reintroduces per-handler resolution — "the one test in that file that proves exactly what it says".

### Slice 1 — code review (`agent-skills:code-reviewer`)

**Verdict: approve after one comment fix.** All five acceptance criteria met. The reviewer re-verified the mechanics independently rather than accepting the coder's reasoning — including that deleting `{ ...context, instanceId }` at `open:436` / `heartbeat:58` is genuinely a no-op (both `teardownInstance` branches use only the explicit argument), that both resolvers are absent from the diff, that WCP4 keeps its unresolved `temp-` id, that `index.ts:39` is the only non-test `resolveDacpHandlerInstanceId` call in `src/`, that no handler reads `meta.source` behind the router's back, and that nothing from slices 2–4 leaked in.

- **Required (dispatched):** `handlers/index.ts:29-31` — the router doc comment lists two off-router exceptions and closes "Neither goes through this router." There is a **third**: `changeAppUserChannel` (`sail-desktop-agent-controllers.ts:177`) builds a context from a host-supplied id and calls `handleJoinUserChannelRequest` / `handleLeaveCurrentChannelRequest` directly. The comment's promise that `instanceId` is "authoritative for every handler body downstream" is therefore false on that path. Comment-only fix.
- **Follow-up (dispatched):** `intent-result-handlers.ts:126` response routing flipped raw → resolved with no test pinning it. Correct — the port map is re-keyed to the validated id at `wcp-connection-management.ts:252-261`, so the response is now delivered where it was previously dropped — but unguarded.
- **Follow-up:** `broadcast-stale-instance.test.ts` cases 2 and 3 still call handlers directly and no longer assert anything about resolution. Fine for MVP; a note in the file is enough.
- **Ignore for MVP:** `handlerContext` at `broadcast/handlers.ts:358, 482, 521` is **not** a half-state — those helpers take `context: Context` (FDC3) as a sibling parameter, so the name is doing real work. Slice 2 retires it.
- **Ignore for MVP:** coverage for the other handler families that newly resolve. The reviewer hand-checked `open/handlers.ts`: every `context.instanceId` read there is the **caller**, never the target — targets come from `payload.app.instanceId`, so no launch or close can be redirected.

### Latent bug found, not fixed here

`agent.channels.changeAppChannel(handshakeRoutingId, …)` on the host controller path: `joinUserChannel` no-ops on the unregistered id, the handler still returns a **success** `joinUserChannelResponse`, no `channelChanged` fires, and the caller's promise dies on `channelChangeTimeoutMs` instead of erroring. **Pre-existing and outside slice 1** — recorded here so it is not lost.

---

## Slice 1 outcome — the behavioural delta

Measured by re-pointing the characterization tests through `routeDACPMessage`. **9 of 14 verdicts flipped**; the scenario throughout is a `temp-` routing id handshake-linked to a registered, connected instance (`VALIDATED_ID`).

| Handler | Before (raw id) | After (resolved id) |
|---|---|---|
| `createPrivateChannelRequest` | error `CreationFailed` | channel created, owned by `VALIDATED_ID` |
| private-channel add listener | `AccessDenied` | **GRANTED** |
| private-channel disconnect | `AccessDenied` | **GRANTED** — channel deleted (creator + sole member; FDC3-correct lifecycle) |
| private-channel unsubscribe | `InvalidArguments` | **GRANTED** |
| `getCurrentChannelRequest` | `channel: null` | `fdc3.channel.1` |
| `joinUserChannelRequest` | success response, **silent no-op** | actually moves `VALIDATED_ID` |
| `getInfoRequest` | `appMetadata` absent | `appMetadata.instanceId === VALIDATED_ID` |
| `findIntentRequest` | destination = temp id | destination = `VALIDATED_ID` |
| `addIntentListenerRequest` | `TargetInstanceUnavailable` | registers under `VALIDATED_ID` |
| unregistered, **unlinked** port id | `AccessDenied` | `AccessDenied` — **unchanged** |

Three of those are live bug fixes, not refactor fallout: `joinUserChannelRequest` returning success while doing nothing, `getCurrentChannelRequest` reporting `null` for an instance that is on a channel, and the register-raw / unsubscribe-resolved asymmetry (plan bug 2) which is now **impossible by construction**. Plan bug 1 (Chain A close/teardown divergence) is also resolved as a side effect, since `context.instanceId` and `targetInstanceId` are now the same field rather than two independent resolutions.

The last row is the important negative result: an id that is neither registered nor linked is still denied. The widening applies only to ids the DA itself linked.

### D1 narrowed — recorded as a decision

D1 said "resolve at *each* entry point with *that entry point's* resolver". Slice 1 implements **entry point 1 only** (`routeDACPMessage`). WCP4 and `cleanupDACPHandlers` are deliberately excluded by criteria 4 and 5. The **host controller path (`sail-desktop-agent-controllers.ts:177`) is simply not covered** — it keeps its host-supplied id unresolved. That is a narrowing of D1, accepted for this slice, and the latent bug above is its consequence.

## Parked Follow-ups

- **`getHandlerForMessageType` is a per-message closure, contradicting its own rationale.** `handlers/index.ts:186` still says the registry is "Module-level so the map is not reallocated on every DACP message", but `d334d5aa0` moved the lookup function to `:91`, inside `routeDACPMessage`, so it is re-created on every inbound message. **Not a perf issue** — one arrow-function allocation per message is negligible next to `createHandlerContext`'s 18 fields and 5 closures, which is itself parked as not-a-perf-problem. It is a *documentation inconsistency*: the code and the stated reason disagree. Fix by moving the function back to module scope (3 lines, no behaviour change) rather than by weakening the comment. **Deferred by user decision — not a now issue.**
- **A flaky unit test exists but is unidentified.** One run of `npx vp test run` at `1d0b4d5c7` failed 1 of 373; two immediately following runs passed clean on the same commit. That run reported `environment 288.67s` against a normal ~31s, and it was launched concurrently with `npx tsc --noEmit`, so resource contention is the likely cause. **Working rule: a single failure does not count until it reproduces on an otherwise-quiet machine.** Do not run Vitest in parallel with other heavy commands.

- `createHandlerContext` allocates 18 fields, 5 closures and a fresh dispatcher per inbound message when only `instanceId` varies. Not a performance problem at DACP message rates — parked deliberately, not forgotten.
- `DACPHandlerContext` vs neighbouring `DacpResponseDispatcher` / `DacpOutboundMessage` casing drift is fixed incidentally by slice 2; no separate sweep planned for other `DACP*` identifiers.
- Root `tsconfig.json` references a non-existent `packages/sail-ui` (`TS6053`). Pre-existing, unrelated, not fixed here.

## Known Limitations

- **`sail-finance/vite.config.ts` has 2 pre-existing lint errors** (`TS2307` missing `@tailwindcss/vite`, `TS2578` unused `@ts-expect-error`). Unrelated to this work, not fixed here. They mean `npx vp lint .` from the worktree root exits 1 even on a clean tree — lint from the package directory.
- **`npx vp fmt --check .` fails on ~190 files** — pre-existing repo-wide formatting drift, unrelated. Not in any verify command for this plan.
- **Root `tsconfig.json` references a non-existent `packages/sail-ui`** (`TS6053`), so `tsc --noEmit` must be run from the package directory.

## Incidental fixes made during slice 1

Neither is part of slice 1; both are committed separately so the slice diff stays clean.

- **`20515fdbf`** — `cleanupDACPHandlers` sent the terminal `raiseIntentResultResponse` to `pending.sourceInstanceId` even when the source instance was the one disconnecting, posting to a just-closed instance for a promise nobody awaits. Introduced by `8a62fd386`. Now sends only when the *target* is the one going away, which is the case that defect was about. This is what turned Cucumber green (`disconnect-cleanup.feature:30`).
- **Vite+ hook config** — `core.hooksPath` was absolute and `.vite-hooks/` was missing in this worktree, so pre-commit hooks silently no-opped. Recorded in AGENTS.md (`cf2450f5e`) along with the fact that `vp lint` is oxlint + `oxlint-tsgolint`, so a clean `tsc --noEmit` does not imply lint passes — the gap that let 16 lint errors through in `8a62fd386`.
