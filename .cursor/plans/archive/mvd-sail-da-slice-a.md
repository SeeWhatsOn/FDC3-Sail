# Minimal Viable Delivery Plan: sail-desktop-agent defect slice A (#1, #2)

> **ARCHIVED 2026-08-14.** Moved to `.cursor/plans/archive/`. Delivered.
>
> **The "Uncommitted" in its old status line was stale.** Both fixes and both Prove-It tests landed
> in `8a62fd386` ("Closes findings #1 and #2 from the 2026-08-11 defect register"), with follow-up
> `20515fdbf` stopping the terminal response firing toward the instance that is itself disconnecting.
> Verified present and committed: `handlers/intents/__tests__/pending-intent-settlement.test.ts` and
> `handlers/__tests__/cross-instance-unsubscribe.test.ts`.
>
> **No open items to carry.** Findings #1 and #2 are struck through as fixed in the live register,
> `.cursor/plans/sail-da-defect-register-2026-08-11.md`, which remains the home for #3-#10 — the
> eight that are still open. Slice B (#3, #5, #6) is the next work there.

Status: done
Current slice: 1 — Slice A (#1 + #2) — complete, verified, reviewed clean. Uncommitted.

Source register: `.cursor/plans/sail-da-defect-register-2026-08-11.md` (findings #1 and #2).

## Intent

- **Outcome:** Two critical DACP defects closed. (#1) A `raiseIntent` whose target dies or
  times out sends a terminal DACP response, so `IntentResolution.getResult()` settles instead of
  hanging forever. (#2) `eventListenerUnsubscribeRequest` and `intentListenerUnsubscribeRequest`
  reject a `listenerUUID` owned by a different instance, so one app cannot kill another's listeners.
- **User:** FDC3 apps running against the Sail Desktop Agent, plus FDC3 2.2 conformance.
- **Success:** Two Prove-It tests. A pending intent that times out / disconnects settles the
  raiser's promise with a terminal error. An attacker-instance unsubscribe is rejected and the
  victim's listener survives. Existing suites stay green.
- **Constraint:** Minimal change inside the existing handler shape. No new abstractions, no new
  dependencies. Repo has its own `minimal-implementation` skill — that is the governing policy.
- **Out of scope:** Register findings #3–#10. The class sweep the register's meta-finding
  recommends. Any refactor of `pendingIntentPromises` into real promises.

## Verify Commands

Run from `packages/sail-desktop-agent`.

- **Full:** `npx vp test run`
- **Focused:** `npx vp test run src/handlers/intents/__tests__/pending-intent-settlement.test.ts src/handlers/__tests__/cross-instance-unsubscribe.test.ts`
- **Typecheck:** `npm run typecheck -w @finos/sail-desktop-agent` (from repo root)
- **Cucumber (regression only):** `npm run test:cucumber:intents -w @finos/sail-desktop-agent`

Confirmed working: `npx vp test run src/handlers/__tests__/cleanup.test.ts` → exit 0, 20 passed.

## Simplicity Bias

- **Policy:** repo-local `minimal-implementation` skill (YAGNI ladder). Wins over MVP defaults.
- **Reuse:**
  - `sendDACPErrorResponse` — already imported in both unsubscribe handlers.
  - The terminal-error precedent on adjacent paths: `handlers/utils/open-with-context.ts`
    (`OpenError.AppTimeout` on both timeout and disconnect) and
    `handlers/intents/intent-delivery-helpers.ts:156-180` (`ResolveError.IntentDeliveryFailed`).
  - The ownership-check precedent already in this package:
    `handlers/broadcast/handlers.ts:316` (`privateListener.instanceId !== instanceId`) and
    `handlers/private-channels/handlers.ts:261-264`.
  - `resolveDacpHandlerInstanceId` (`handlers/utils/resolve-context-listener-instance-id.ts`) is
    how the other five handlers derive trustworthy caller identity.
  - Existing error classes: `FDC3ChannelError` (events path), `FDC3ResolveError` /
    `TargetInstanceUnavailableError` (intents path).
- **Avoid:** turning `pendingIntentPromises` entries into real `Promise` objects; a shared
  "ownership guard" helper module; touching handlers outside the four named files.
- **Architecture:** unchanged. Functions edited in place.

## Slices

1. **Slice A — #1 pending-intent settlement + #2 unsubscribe ownership**
   - **Goal:**
     - (#1) Every path that abandons a pending intent sends a terminal DACP response to the
       raiser. Two paths: the timeout in `attachPendingIntentTimeout`
       (`intent-raise-shared.ts:163-177`) and the disconnect path in `handlers/cleanup.ts:85-96`.
       The `resolve`/`reject` no-ops stored by `registerPendingIntentPromise` must either be
       replaced by a real settlement or bypassed by sending the wire response directly.
     - (#2) `handleEventListenerUnsubscribeRequest` (`handlers/events/handlers.ts:107-115`) and
       `handleIntentListenerUnsubscribe` (`handlers/intents/intent-listener-handlers.ts:130-135`)
       compare the stored `listener.instanceId` against the caller's resolved instance id and
       reject a mismatch with the same error shape each already uses for "not found".
   - **Acceptance:**
     - After `pendingIntentTimeoutMs` with no result, the raiser receives a terminal DACP error
       response for that `requestId`; the pending entry is gone from `state.intents.pending`.
     - When the target instance disconnects while an intent is pending, the raiser receives the
       same terminal response. Applies to both `raiseIntent` and `raiseIntentForContext`.
     - The error code matches the nearest existing precedent on the intent path — coder chooses
       and states the choice; it must be a real `@finos/fdc3` enum member, not a new string.
     - App B unsubscribing App A's `listenerUUID` (event or intent) receives an error response and
       A's listener is still present in state afterward.
     - An instance unsubscribing its own listener still succeeds, unchanged.
     - No behaviour change on any other handler.
   - **Verify:** `npx vp test run` (from `packages/sail-desktop-agent`)
   - **Likely files:**
     - `src/handlers/intents/intent-raise-shared.ts`
     - `src/handlers/cleanup.ts`
     - `src/handlers/events/handlers.ts`
     - `src/handlers/intents/intent-listener-handlers.ts`

## Test Plan

- **Unit:** none standalone — both defects are cross-module wire behaviour.
- **Integration (Prove-It, both required):**
  - `src/handlers/intents/__tests__/pending-intent-settlement.test.ts` — drive a pending intent
    to timeout, and separately to target-disconnect, and assert a terminal response reaches the
    raiser. Must fail against the pre-fix code.
  - `src/handlers/__tests__/cross-instance-unsubscribe.test.ts` — attacker instance unsubscribes
    a victim's event listener and intent listener; assert error out, listener retained. Plus the
    self-unsubscribe happy path. Must fail against the pre-fix code.
- **Manual/runtime:** none.
- **Not testing:** the FDC3 client-side `getResult()` promise itself (BDD/WCP edge no-ops make it
  structurally invisible — see register, "Why the test suite did not catch #4, #7 and #9"). We
  assert at the DACP response boundary instead.

## Agent Roles

- **coder:** `grok-dispatch` (Grok 4.5 via cursor-agent) — user-specified.
  **Override:** edits this working tree in place; do **not** pass `--worktree`. User decision.
- **tester:** `agent-skills:test-engineer`, model `sonnet` — user-specified. Briefed from Goal +
  Acceptance only, not from the diff.
- **reviewer:** `agent-skills:code-reviewer`, default model — user-specified as a third, distinct
  agent.
- **security reviewer:** not applicable — #2 is an authorisation defect, but the ordinary reviewer
  is briefed to check the ownership gate specifically.
- **explorer:** not needed — the register names every file:line; confirmed by direct read.

## Risks

- **Ordering:** the user asked coder-first, so the Prove-It tests are written after the fix
  exists. Mitigation: the tester is briefed from Acceptance and never sees the diff. Residual
  risk — a test that passes for the wrong reason is harder to catch. If a test passes on first
  run without ever having been seen to fail, the tester must revert the fix locally and confirm
  it fails, then restore.
- **#1 error-code choice** is the coder's. If it picks a code the FDC3 client maps to a
  non-terminal state, `getResult()` still hangs. Reviewer must check this explicitly.
- **Grok edits in place** — no worktree rollback boundary. Branch `fix/da-test-suite-realignment`
  is clean at start; `git diff` is the rollback.
- Touching `handlers/cleanup.ts` risks the heartbeat/disconnect paths already covered by
  `src/handlers/__tests__/cleanup.test.ts` (20 tests). Full suite catches regressions.

## Slice Checkpoints

- [x] Slice A (#1 + #2): **verified | reviewed** (failures: 1, then reset to 0 on clean pass)
  - coded by `grok-dispatch`, tested by `agent-skills:test-engineer` (sonnet), reviewed by
    `agent-skills:code-reviewer` — three separate contexts, no role reused.
  - Review round 1 → 1 `Required` (schema-invalid `payload.message`). Sent back to the coder.
  - Review round 2 (fresh reviewer, scoped) → **no `Required`**. Slice passes.

## Verification Notes

- `npx vp test run src/handlers/__tests__/cleanup.test.ts` → exit 0 (baseline, pre-slice)
- Post-coder, `npx vp test run` (from `packages/sail-desktop-agent`), three runs:
  - run 1 → **exit 1**, 1 failed / 343 passed
  - run 2 → **exit 0**, 344/344
  - run 3 → **exit 0**, 344/344
- `npm run typecheck -w @finos/sail-desktop-agent` → **exit 0** (run and observed by main agent)
- Post-tester, `npx vp test run` → **exit 0, 354/354** (55 files). Two new test files, 10 new tests.
- **Fail-first check (the Risks-section mitigation, run by main agent):** reverted all four
  implementation files to `HEAD`, ran the two new test files →
  **exit 1, 8 failed / 2 passed**. The 2 that passed are the self-unsubscribe happy paths, which
  are unchanged behaviour and correctly pass pre-fix. Fix restored from
  `scratchpad/fix-backup.patch`; `git diff HEAD --stat` matches the pre-revert stat exactly.
  **The tests are proven to fail without the fix.**

### Flaky test — identified and proven pre-existing

`src/app-connection/__tests__/wcp-host-logger-threading.test.ts` →
*"routes MessagePortTransport message logs to the host logger, not console"*.

- Reproduced 1 time in 6 runs of `npx vp test run src/app-connection`.
- **Proven pre-existing:** with all four implementation files reverted to `HEAD`, the same single
  test file failed **1 in 10** runs. Not caused by this slice.
- Unrelated subsystem (MessagePortTransport logger threading). Parked as a follow-up.

### Unauthorised file in the diff

`AGENTS.md` is modified (+2/-2). The working tree was clean at session start and Grok was the only
writer, so the coder edited a file the brief did not authorise. The content is unrelated to this
slice: it re-points `DEFAULT_FDC3_USER_CHANNELS` to `src/agent/default-user-channels.ts` and adds
notes about the `SailDesktopAgent` façade split and Immer `produce` in `state/mutators/*`.

**User decision: keep.** The content is correct doc drift from commit `79aba572f`. It stays in the
slice diff as an accepted out-of-scope change, recorded here rather than silently folded in.

## Review Notes

Reviewer verdict: REQUEST CHANGES — one Required, everything else deferred.

### Required (1) — sent back to coder, slice failure count 1

- `handlers/cleanup.ts:104` and `handlers/intents/intent-raise-shared.ts:178` — the 4th argument to
  `createDACPErrorResponse` emits `payload: { error, message }`, but
  `fdc3-schema/.../raiseIntentResultResponse.schema.json` `RaiseIntentResultErrorResponsePayload` is
  `properties: ["error"]`, `required: ["error"]`, `additionalProperties: false`. Schema-invalid; a
  strict client (the FDC3 conformance toolbox) can drop the message and `getResult()` re-hangs.
  Fix: delete the 4th argument at both sites, matching `intent-result-handlers.ts:145-149` / `:156-160`.
  **Independently confirmed by main agent** by reading the schema JSON and the
  `createDACPErrorResponse` signature (`dacp/dacp-message-creators.ts:75-97`).

### Reviewer's answers on the six risk points

| Point | Verdict |
|---|---|
| `raiseIntentResultResponse` + `ResultError.ApiTimeout` | Message type correct, code legal — but see follow-up: `getResult()` **resolves `undefined`**, does not reject |
| Synthesized request object | Correct; `requestUuid` is the only correlation field, and it is the in-repo precedent |
| `resolveDacpHandlerInstanceId` re-routing | Safe; cannot diverge, because add-listener handlers throw unless the same lookup succeeds |
| Double-send on timeout/disconnect race | Cannot happen; both paths guarded, tests assert exactly-one |
| `try`/`catch` in `cleanup.ts` | `logger` in scope at `:74`; swallowing correct here |
| Test quality | Real wire-level assertions, not implementation details |

### Follow-up (deferred, see Parked Follow-ups)

- `cleanup.ts:106-110` — guaranteed-doomed send when the **raiser** is the disconnecting instance;
  guard with `pending.sourceInstanceId !== instanceId`.
- `cleanup.ts:112` — log text says "timeout" on a cancellation path.
- `intent-raise-shared.ts:180-184` — timeout path's `sendDACPResponse` has no `try`/`catch`, unlike
  its twin in `cleanup.ts`; a throw escapes a `setTimeout` callback unhandled.
- `pending-intent-settlement.test.ts:160` — `DACP_WIRE_ERROR_VALUES.has(...)` accepts ~15 values
  across five enums; pinning `ResultError.ApiTimeout` would lock in the coder's stated choice.
- **New defect for the register:** `getResult()` resolves `undefined` rather than rejecting.
  `DefaultIntentSupport.createResultPromise` (`@finos/fdc3-agent-proxy@2.2.3`) uses `waitFor`, which
  has no `payload.error` check (unlike `exchange`), and `convertIntentResult` reads only
  `payload.intentResult`. Affects the two pre-existing `ResultError` paths at
  `intent-result-handlers.ts:145` / `:156` as well, whose file doc comment at `:6` claims the
  opposite. Root cause is upstream in the proxy.

### Ignore for MVP

- No raiser-side-disconnect test (not in acceptance).
- "No information leak" assertions are near-tautological — kept as a cheap regression guard.
- The register's meta-finding (sweep the whole ownership class) — explicitly out of scope.

## Parked Follow-ups

**Highest value first — the top item guards the exact defect review round 1 caught.**

1. `pending-intent-settlement.test.ts:159` — assert the terminal payload has **only** `error`
   (`expect(Object.keys(payload!)).toEqual(["error"])`). Nothing currently stops a 4th argument
   being reintroduced and re-breaking the schema silently, since Sail never validates outbound
   payloads. One line, in the tester's file.
2. **New register entry:** `getResult()` resolves `undefined` rather than rejecting. Upstream cause
   in `@finos/fdc3-agent-proxy@2.2.3` (`waitFor` has no `payload.error` check). Also affects the
   pre-existing paths at `intent-result-handlers.ts:145` / `:156`, whose doc comment at `:6` claims
   the opposite. Not a Sail code change — a register entry plus a doc-comment correction.
3. Pre-existing flake: `wcp-host-logger-threading.test.ts` → "routes MessagePortTransport message
   logs to the host logger, not console". 1-in-10 on unmodified `HEAD`.
4. The three reviewer follow-ups on this slice's own code — doomed send to a disconnecting raiser,
   "timeout" wording on a cancellation log line, missing `try`/`catch` on the timeout-path send.
   See Review Notes.
5. Register findings #3, #5, #6 (slice B — intent routing).
6. Register findings #4, #7, #9 (slice C — WCP/lifecycle; needs real integration tests first).
7. The register's meta-finding: sweep every DACP handler for the missing-ownership-check class
   rather than fixing the two named sites.

## Known Limitations

- Nothing in the source register was reproduced at runtime before this plan; ratification was
  source reading. This slice's Prove-It tests are the first runtime evidence.
