# Minimal Viable Delivery Plan: DACP handler deps refactor

Status: planning
Current slice: 1 — not started (decisions D1–D3 resolved)

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

### 4. Normalise argument order to deps-last

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

- [ ] 1 Authoritative instanceId: not started (failures: 0)
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

## Review Notes

- Required:
- Follow-up:
- Ignore for MVP:

## Parked Follow-ups

- `createHandlerContext` allocates 18 fields, 5 closures and a fresh dispatcher per inbound message when only `instanceId` varies. Not a performance problem at DACP message rates — parked deliberately, not forgotten.
- `DACPHandlerContext` vs neighbouring `DacpResponseDispatcher` / `DacpOutboundMessage` casing drift is fixed incidentally by slice 2; no separate sweep planned for other `DACP*` identifiers.
- Root `tsconfig.json` references a non-existent `packages/sail-ui` (`TS6053`). Pre-existing, unrelated, not fixed here.

## Known Limitations

- None yet.
