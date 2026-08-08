# Minimal Viable Delivery Plan: sail-desktop-agent test-suite realignment

Status: blocked — **human gate.** Slices 1–4 are complete, verified, and reviewed. Slices 5 and 6 need explicit release.
Current slice: 5 (not started)

**Approved 2026-08-07: slices 1–4 only.** Slices 5 and 6 are behind a **human gate** — do not start either
until the user has reviewed the results of slices 1–4 and explicitly released them. Slice 5's design
question (does `DacpTestAppConnection` need the enrichment `BrowserAppConnection` does?) is the reason
for the gate, and it gets answered with the user, not inside a slice.

Working branch: `fix/da-test-suite-realignment` (worktree `.claude/worktrees/da-test-realignment`).

Source: test-suite audit run 2026-08-07 (features vs FDC3 spec, step definitions, unit tests).
Baseline at plan time: **154 Cucumber scenarios, 334 Vitest tests / 51 files, all green.**

## Prior art that constrains this plan

Read before starting any slice. These hold decisions this plan must not silently reverse.

| File | What it holds | Effect here |
|---|---|---|
| `.cursor/plans/sail-da-defect-fixes.md` | **Status: done.** Four wire defects fixed 2026-08-05/06 | Its slice 3 decided `ListenerError` / `ListenerNotFound` were deliberate carve-outs — "no code change at the 5 sites", BDD "unchanged" |
| `AGENTS.md:63` | The carve-out record | Rationale: "FDC3 defines no error code for a failed event-listener registration" |
| `.cursor/plans/sail-desktop-agent-audit-2026-08.md` | 2026-08-05 evidence register | §10: correctness before cleanup |
| `.cursor/plans/parked-wcp4-origin-allowlist.md` | Parked deployment origin policy | **Unrelated** — that is admission policy; slice 5 here is the test harness |

**The carve-out is reopened by user decision (2026-08-07)**, on evidence the original decision did not have:

- `ChannelError.InvalidArguments` exists in the installed `@finos/fdc3` and is documented for "incorrect arguments passed to API calls".
- The DACP wire type `ResponsePayloadError` (`BrowserTypes.d.ts:750`) is a **closed union of 24 string literals**. Neither invented value is a member, so a strict client cannot match either.

Slice 1 carries the `AGENTS.md:63` rewrite. Reversing a recorded decision without updating its record is how the next audit re-raises it.

## Intent

- **Outcome:** No DACP payload leaves the agent with a value or field name outside `@finos/fdc3-schema`, and the test suite can detect it when one does.
- **User:** Any FDC3 client connecting to a Sail agent — today three payload shapes would fail a strict client — and the next person to audit this package, who currently gets 198 warnings of noise per run.
- **Success:** `npx vp test run && npx cucumber-js` green; zero `ListenerError` / `ListenerNotFound` in `src/` or `test/`; the Cucumber run fails if a new schema-invalid message appears.
- **Constraint:** Surgical. This is the audit's findings and nothing else — no cleanup from `sail-desktop-agent-audit-2026-08.md` §10, no new abstractions, no new dependencies.
- **Out of scope:** The ~1,150 LOC cleanup backlog; wiring `matchData` to enforce message ordering (parked, see below); adding the missing spec coverage the audit listed (private-channel post-disconnect, `ResultError.ApiTimeout`, `ResolverUnavailable`); `intent-metadata-performance.feature` rehoming.

## Verify Commands

Run from `packages/sail-desktop-agent` unless noted.

- **Full:** `npx vp test run && npx cucumber-js`
- **Focused (unit):** `npx vp test run src/<path>.test.ts`
- **Focused (BDD):** `npx cucumber-js test/features/<dir>`
- **Typecheck/lint/format:** `npx tsc --noEmit` · `npx vp lint .` · `npx vp fmt --check .`
- **Monorepo gate (after the last slice only):** `npm run validate` from the repo root

## Simplicity Bias

- **Policy:** `.claude/skills/minimal-implementation` (repo-local YAGNI ladder) — wins over this skill's defaults per step 3. Also binding: `AGENTS.md:153` — no back-compat shims unless asked; keep conformance/harness accommodations out of production `src/`.
- **Reuse:** `ChannelError.InvalidArguments` already exists — slice 1 deletes casts rather than adding a local enum (contrast `CloseError` at `fdc3-errors.ts:186`, which is locally declared only because 2.2 genuinely lacks it). Slice 5's failure signal reuses the existing `SailDesktopAgentOptions.logger` seam and the existing `After` hook in `test/support/hooks.ts` — no production change.
- **Avoid:** No allowlist mechanism inside `src/dacp/validate-dacp-message.ts` — the "fail on new warning" gate is test-side. No new validation layer. No renaming `ListenerNotFoundChannelError`; the class names the *condition*, which is still accurate.
- **Architecture:** Unchanged. No new source files. New test files only where a slice names one.

## Slices

Ordered correctness-first, per the audit's own sequencing rule. Slices 1–3 change the wire; 4–6 change only tests.

### 1. Retire the invented error codes

- **Goal:** Every DACP error payload value is a member of `ResponsePayloadError`.
- **Change:**
  - `errors/fdc3-errors.ts:175-177` — `ListenerNotFoundChannelError` passes `ChannelError.InvalidArguments`; delete the `as ChannelError` cast and correct the docstring.
  - `handlers/events/handlers.ts:32,49,80,109,125` — replace `"ListenerError" as ChannelError` with `ChannelError.InvalidArguments` (5 sites).
  - `test/features/context/event-listeners.feature:78,84` — `ListenerError` → `InvalidArguments`.
  - `test/features/channels/private-channel.feature:130,140` — `ListenerNotFound` → `InvalidArguments`.
  - `handlers/__tests__/fdc3-error-enums.test.ts:108,119` — use `ChannelError.InvalidArguments`.
  - `AGENTS.md:63` — rewrite: record that the carve-out was reopened 2026-08-07, that `InvalidArguments` is the replacement, and why (closed 24-value wire union).
- **Acceptance:** `grep -rn 'ListenerError\|ListenerNotFound' src/ test/` returns hits only in class/identifier names, never as a string literal or assertion value. `addEventListener` with an unsupported type and `contextListenerUnsubscribe` for an unknown id both return `InvalidArguments`.
- **Verify:** `npx tsc --noEmit && npx vp test run && npx cucumber-js`
- **Likely files:** `errors/fdc3-errors.ts`, `handlers/events/handlers.ts`, 2 features, 1 unit test, `AGENTS.md`.
- **Note for the coder:** `handlers/broadcast/handlers.ts:303,310` and `handlers/private-channels/handlers.ts:257,267` construct `ListenerNotFoundChannelError` — they need no edit, the class change covers them.

### 2. Rename the intent-result wire field to `resultMetadata`

- **Goal:** The wire field matches Sail's own internal type name and the FDC3 3.0 draft.
- **Change:** `handlers/intents/intent-result-handlers.ts:190-193` — `metadata:` → `resultMetadata:`. Then the 7 `msg.payload.metadata.*` column headers across `intent-result.feature:22,33,44,55` and `intent-result-metadata.feature:19`, plus assertions in `intent-result-handlers.test.ts`, `intent-result-metadata.test.ts`, `intent-result-client-metadata.test.ts`.
- **Do NOT touch `msg.payload.intentResult.metadata.traceId`.** That is the Context-level metadata inside a `ContextWithMetadata` result — a different field at a different level. Only the payload-level `metadata` is renamed. Both appear in the same table rows; read the column header, not the substring.
- **Acceptance:** `raiseIntentResultResponse.payload` carries `resultMetadata`, never `metadata`. Internal `resultMetadata` naming in `intent-result-metadata.ts` is now consistent end-to-end.
- **Verify:** `npx vp test run src/handlers/intents && npx cucumber-js test/features/intents`, then the full pair.
- **Likely files:** `intent-result-handlers.ts`, 2 features, 3 unit tests.
- **Confirmed safe:** `grep` across `sail-conformance-harness`, `sail-finance`, `sail-one` found **zero** consumers of this field. The rename cannot break another package.
- **CORRECTION, made during implementation.** The Change list above is wrong and following it literally broke 4 scenarios. Those `Then messaging will have outgoing posts` tables in `intent-result.feature:17,29,40,51` assert **four message types in one table**, and the column header applies to every row. Only `raiseIntentResultResponse` renamed its payload-level field — **`intentEvent` still emits `payload.metadata`**. What shipped is therefore a **second column family** alongside the existing one: both `msg.payload.metadata.*` and `msg.payload.resultMetadata.*` are present, with `{null}` in whichever does not apply to that row. `intent-result-metadata.feature` was a straight rename because all three of its tables have a single `raiseIntentResultResponse` row.

### 3. Accept only the schema's event type

- **Goal:** `addEventListenerRequest` accepts `USER_CHANNEL_CHANGED` and `null` — the closed union in `AddEventListenerRequestPayload` — and nothing else.
- **Change:** `handlers/events/handlers.ts:40` — reduce `["channelChanged", "USER_CHANNEL_CHANGED", "userChannelChanged"]` to the schema value. Keep the internal normalisation to `"channelChanged"`; that is an internal listener key, not a wire value. Update the 7 uses in `event-listeners.feature` and the message built in `test/step-definitions/event-listener.steps.ts:55`.
- **Acceptance:** `USER_CHANNEL_CHANGED` registers; `userChannelChanged` and `channelChanged` return `InvalidArguments` (depends on slice 1). `null` still subscribes to all.
- **Verify:** `npx vp test run && npx cucumber-js`
- **Likely files:** `handlers/events/handlers.ts`, `event-listeners.feature`, `event-listener.steps.ts`.
- **Rationale for dropping the aliases rather than keeping them:** `AGENTS.md:153` — no back-compat shims unless explicitly asked. If a real adopter sends the camelCase form, that is a written requirement and the aliases come back with a comment saying so.
- **CORRECTION, made during implementation.** `test/step-definitions/event-listener.steps.ts:55` needed **no edit** — the step passes `eventType` straight through with a cast, so the literals live in the feature file only. The cast must stay: the negative scenario at `event-listeners.feature:75` deliberately sends the non-schema `"unsupportedEvent"`.
- **Confirmed during review:** the reference client `@finos/fdc3-agent-proxy` uses `'userChannelChanged'` as its *API-level* string but converts it before the wire — `DesktopAgentEventListener.js:24-27` sends `{ type: 'USER_CHANNEL_CHANGED' }`. Even the canonical client never sent the camelCase form, so the aliases were dead weight on the facts, not only on policy.

### 4. Repair the two tests that pass without proving anything

- **Goal:** Two tests that cannot currently fail either fail for the right reason or stop existing.
- **Change:**
  - `app-connection/__tests__/wcp-reconnect-clobber.test.ts:180-217` — the goodbye is posted on a port the reconnect already closed, so it never reaches the router (**proven by probe**: only the two `WCP4` messages arrive). Interleave the goodbye before the reconnect completes using `beginWcpAppFirstConnect`, as the working test at `:219` does. If that cannot be made to reproduce the displaced-port case, delete it — the manual-wiring test at `:259` already covers the real regression. Say which was chosen.
  - `app-directory/__tests__/app-directory-queries.test.ts:104-111` — replace `expect(intent.appId).toBeDefined()` on a non-optional field with an exact `{appId, intentName}` pair assertion.
- **Acceptance:** **Prove-It, both tests.** Mutate the implementation each is meant to guard; each must fail. Record the mutation and the failure message in Verification Notes. A test that still passes under mutation has not been repaired.
- **Verify:** `npx vp test run src/app-connection/__tests__/wcp-reconnect-clobber.test.ts src/app-directory/__tests__/app-directory-queries.test.ts`
- **Likely files:** those two test files only. No source change.

### 5. Make the schema validator a working signal in BDD

The biggest slice, and the one that can sprawl. It has two halves; land the harness fixes before the gate.

- **Goal:** The Cucumber run fails when a step sends a message that is not schema-valid, except for shapes explicitly recorded as deliberate.
- **Change, part A — stop sending invalid shapes (targets 198 → allowlist only):**

  | Count | Site | Fix |
  |---|---|---|
  | 160 | `start-app.steps.ts:52-70,228` | Stop pre-enriching WCP4 `meta.messageOrigin` / `meta.wcpSourceWindow`. Send the raw wire shape and let the connection stamp them, as `wcp1-3-handshake.ts:78` does in production |
  | 13 | `intents.steps.ts` | `app: null` → omit the key; `app?` is optional, not nullable |
  | 4 | `broadcast.steps.ts` | `channelId: null` → omit; the schema requires a string |
  | 3 | `intent-result.steps.ts` | Void result `intentResult: null` → `{}`; `IntentResult` has no `error` member — check how the DA is meant to receive a rejection before changing that row |

- **Change, part B — the gate:** pass a capturing logger via the existing `SailDesktopAgentOptions.logger` seam in `test/world/index.ts`, and extend the `After` hook in `test/support/hooks.ts` to fail the scenario on any `failed FDC3 schema validation` warning whose message type is not on a short, commented allowlist.
- **Allowlist starts as:** the deliberate `{bogus:true}` malformed-context scenarios, and `addIntentListenerRequest.contextType` + `broadcastRequest.payload.metadata` (FDC3 3.0 draft fields validated against a 2.2-pinned schema). Each entry gets a one-line reason.
- **Acceptance:** Warning count drops to the allowlisted set. Introducing a new off-schema field in any step definition **fails** the run. The WCP4 handshake still completes — `wcp-identity-validation.ts:73` reads `meta.wcpSourceWindow`, so part A must confirm where that value legitimately comes from before removing it from the step.
- **Verify:** `npx cucumber-js` (exit 0, and the warning count recorded in Verification Notes), then `npx vp test run`.
- **Likely files:** 4 step-definition files, `test/world/index.ts`, `test/support/hooks.ts`.
- **Stop condition:** if part A's WCP4 change requires production code to move, **stop and check in**. That is the "BDD enters below the security seam" gap, which is a design call, not this slice.

### 6. Tidying: retags, order-independent assertions, dead steps

- **Goal:** The feature files say what version each scenario belongs to, and no step definition exists that nothing calls.
- **Change:**
  - Retag: drop `@fdc3_2.0` from `private-channel.feature:35,69` (`PrivateChannel.addEventListener` is 2.2+); retag `raise-intent.feature:45-49` as 3.0-only or delete it as a duplicate of `intent-context-metadata.feature:15`; add `@fdc3_2.0` to `broadcast.feature:27,54,63`; drop `@fdc3_3.0` from `intent-metadata-performance.feature` so it is not picked up by version-filtered conformance runs.
  - Replace index-based array assertions in `find-intent.feature:142-152` and `raise-intent-with-context.feature:68-89` with the membership step already used elsewhere in the same files.
  - Delete the unused steps: `disconnect.steps.ts:10`, `generic.steps.ts:227,237,258-280,282-327`, `start-app.steps.ts:208-240`, and the unused `matchData` in `testing-utils.ts:254`.
- **Acceptance:** Scenario count unchanged (or −1 if the duplicate is deleted — say which). Every remaining step definition is referenced by at least one feature.
- **Verify:** `npx cucumber-js` and `npx cucumber-js --profile fdc3-2.0`
- **Likely files:** 5 features, 3 step-definition files, `testing-utils.ts`.

## Test Plan

Risk-based, per step 5. Most slices are corrections to existing tests, not new coverage.

- **Unit:**
  - Slice 1 — extend `fdc3-error-enums.test.ts` with a guard that every `expectedError` in its table is a member of the real `@finos/fdc3` enum union. That guard is what would have caught this whole class of defect; it is the one genuinely new test in this delivery.
  - Slice 4 — no new tests; two existing ones repaired, both under Prove-It.
- **Integration:** none new for slice 2 — the existing Cucumber scenarios cover it once their assertions are corrected.
  - **CORRECTION, made during implementation (slice 3).** This line was wrong about slice 3. Dropping the `channelChanged` / `userChannelChanged` aliases is a **rejection** behaviour change, and no existing scenario covers it: the only negative case in `event-listeners.feature` uses `"unsupportedEvent"`, which was already rejected before the slice. So the acceptance criterion "`userChannelChanged` and `channelChanged` return `InvalidArguments`" held by code inspection alone. Slice 3 therefore gets a tester and a negative test for each dropped alias.
- **Manual/runtime:** none. No browser-path behaviour changes.
- **Not testing:** the retags and dead-step deletions in slice 6 — no behaviour, and the Cucumber run is itself the check. The slice 5 allowlist entries — they are documentation of known gaps, not logic.

## Agent Roles

- coder: `general-purpose`
- tester: `agent-skills:test-engineer`
- reviewer: `agent-skills:code-reviewer`
- security reviewer: `agent-skills:security-auditor` — **slice 5 only**, and only if part A touches the WCP4 identity path
- explorer: not needed — the audit did the discovery

Slice 6 is a candidate for the step 10 single-agent exemption **only** if it reduces to pure tag edits. It currently does not — it deletes step definitions — so run the full loop.

## Risks

- **Slice 1 is a wire behaviour change**, not a cleanup. Any client already matching `"ListenerNotFound"` breaks. Nothing in this monorepo does, but an external adopter might; the `AGENTS.md` rewrite is what makes that discoverable.
- **Slice 2 rests partly on an unpinned draft.** Sail's own internal naming justifies it independently, which is why it survives even if the 3.0 draft moves. If the draft is later found to say `metadata`, this reverts as a one-line change.
- **Slice 5 part A can sprawl into production code.** The WCP4 step currently fakes what `BrowserAppConnection` does. Making the step honest may reveal that `DacpTestAppConnection` needs to grow the enrichment. That is a design decision — stop and ask rather than moving production code inside this slice.
- **Slice 3 depends on slice 1** for its expected error value. Do not reorder them.
- **Cucumber is a weak signal for slices 1–3**, per the prior plan's own note: the test edge bypasses `BrowserAppConnection`, matching is order-free, and `{null}` resolves to `toBeFalsy()`. Lean on the unit tests and Prove-It, not on green BDD.

## Slice Checkpoints

- [x] 1 retire invented error codes: **reviewed** — coded, tested, reviewed by three separate contexts (failures: 0)
- [x] 2 `resultMetadata` rename: **reviewed** — coded, reviewed by separate contexts; no tester (plan budgeted no new tests) (failures: 1)
- [x] 3 narrow event type: **reviewed** — coded, tested, reviewed by three separate contexts (failures: 0)
- [x] 4 repair the two vacuous tests: **reviewed** — tested and reviewed by two separate contexts; no coder (test-only slice, no production change) (failures: 0)
- [ ] 5 schema-validation gate in BDD: **BLOCKED — human gate.** Not started (failures: 0)
- [ ] 6 retags + dead steps: **BLOCKED — human gate.** Not started (failures: 0)

## Verification Notes

Every entry is a command plus the exit status observed by the main agent, not a subagent's claim.

**Slice 1 — retire invented error codes**

- `npx tsc --noEmit` -> exit 0 (slice 1)
- `npx vp test run` -> exit 0, **51 files / 335 tests passed** (baseline 334; +1 is the new enum guard) (slice 1)
- `npx cucumber-js` -> exit 0, **154 scenarios / 1461 steps passed** (baseline 154, unchanged) (slice 1)
- Guard proven failing: tester added a temporary row `{expectedError: "ListenerNotFound"}` -> focused run exit 1, `AssertionError: expected [ Array(1) ] to deeply equal []` naming the offending row. Reverted.
- Reviewer independently confirmed `OpenError ∪ ResolveError ∪ ResultError ∪ ChannelError ∪ BridgingError` **equals** the 24 members of `ResponsePayloadError` — the guard is neither loose nor spuriously strict.

**Slice 2 — `resultMetadata` rename (1 failure, then clean)**

- **Failure 1:** `npx cucumber-js` -> exit **1**, 154 scenarios (**4 failed**), all `intent-result.feature:17,29,40,51`. Cause recorded as a CORRECTION in the slice 2 section above: the shared column header was renamed for all four message types, but only `raiseIntentResultResponse` renamed its field. Sent back to the coder.
- `npx tsc --noEmit` -> exit 0 (slice 2, after fix)
- `npx vp test run` -> exit 0, **51 files / 335 tests passed** (slice 2, after fix)
- `npx cucumber-js` -> exit **0**, **154 scenarios / 1461 steps passed** (slice 2, after fix)
- Reviewer confirmed the fix did not weaken the assertions: `git diff --word-diff` shows the positive literals (`PortfolioApp`/`App1`, `l1`/`a1`, `ISO8601-timestamp-required`) **moved** into the `resultMetadata` columns rather than being deleted, and only `{null}` tokens were added.
- Rename proven guarded: reverting `resultMetadata:` -> `metadata:` fails `intent-result-handlers.test.ts:134`, `intent-result-client-metadata.test.ts:251`, and all 5 Cucumber tables.

**Slice 3 — narrow the accepted event type (0 failures)**

- `npx tsc --noEmit` -> exit 0 (slice 3)
- `npx vp test run` -> exit 0, **51 files / 337 tests passed** (+2 from the tester's rejection rows)
- `npx cucumber-js` -> exit **0**, **154 scenarios / 1461 steps passed**
- **Prove-It, under-rejection (tester):** `validEventTypes = [..., "userChannelChanged"]` -> new row FAILS, `AssertionError: expected undefined to be 'InvalidArguments'`. Same for `"channelChanged"`. `undefined` because the handler returned an `addEventListenerResponse` with a `listenerUUID` instead of an error payload — exactly the regression the rows guard. Mutation reverted.
- **Prove-It, over-rejection (main agent, answering the tester's open question):** `validEventTypes: string[] = []` -> `npx cucumber-js` exits **1**, **4 scenarios fail**. So acceptance criteria 1 (`USER_CHANNEL_CHANGED` registers) and 4 (`null` subscribes to all) **are** guarded, by BDD, and no extra unit test is warranted. Mutation reverted; re-run exit 0.
- Reviewer independently confirmed the union at `BrowserTypes.d.ts:696-701` is `'USER_CHANNEL_CHANGED' | null` and the handler now accepts exactly that; that the internal key `"channelChanged"` never reaches the wire (the wire literal is the separate `"channelChangedEvent"`); and that no caller in `sail-conformance-harness`, `sail-finance`, `sail-one`, or `sail-platform` sent the dropped aliases.

**Slice 4 — repair the two vacuous tests (0 failures)**

- `npx vp test run src/app-connection/__tests__/wcp-reconnect-clobber.test.ts src/app-directory/__tests__/app-directory-queries.test.ts` -> exit 0, **2 files / 18 tests**
- `npx tsc --noEmit` -> exit 0 · `npx vp test run` -> exit 0, **51 files / 337 tests** · `npx cucumber-js` -> exit **0**, **154 scenarios / 1461 steps**
- `git status --short -- src/` confirms slice 4 changed **test files only** — no production change.
- **Prove-It, target A:** mutated `wcp/wcp-connection-management.ts:245`, moving `transportToInstanceId.delete(displacedTransport)` to **after** `displacedTransport.disconnect()`. Failure: `AssertionError: expected [ Array(1) ] to not include '62f16f5e-…'` at `wcp-reconnect-clobber.test.ts:213`. Reverted; `git hash-object` matches pre-mutation.
- **Prove-It, target B:** mutated `app-directory/app-directory-queries.ts:27`, `appId: app.appId` -> `appId: intentName`. Failure: `AssertionError: expected [ Array(3) ] to deeply equal […]`, received `appId` values `"ViewContact"/"ViewChart"/"ViewContact"`. Reverted; `git hash-object` matches.
- **CORRECTION to the tester's own report:** it claimed mutation A also fails the test at `:378`. The reviewer checked — `:379` seeds `oldTransport` with no `onDisconnect` handler, so delete-after-disconnect leaves identical net map state and every assertion still passes. `:219` and `:259` do fail. The redundancy judgment leaned on that list, so the corrected list matters.

**Monorepo gate, run after slice 4 (the last approved slice)**

`npm run validate` from the repo root -> exit **1**, but it fails at its **first** step and both failures are **pre-existing and outside this branch's diff**:

| Step | Exit | Verdict |
|---|---|---|
| `npm run format` (`vp fmt --check .`) | **1** | **Pre-existing.** 421 files flagged monorepo-wide, including `website/`, `sail-theme/`, `sail-platform/` — none touched here. Nothing downstream ran, so the rest was run individually below. Fixing it means reformatting 421 files, which the plan's Constraint forbids. |
| `npm run lint` | 0 | ✅ |
| `npm run lint:boundaries` | 0 | ✅ |
| `npm run typecheck` | 0 | ✅ |
| `npm run build` | **1** | **Pre-existing, unrelated.** `@finos/sail-one` fails with rolldown `[INVALID_OPTION] You must supply options.input`. This branch changed **no** file in `sail-one`. `sail-desktop-agent` (`vp pack`), `sail-platform`, `sail-finance`, and `sail-conformance-harness` all build clean. |
| `npm test -- --run` | 0 | ✅ **69 files / 465 tests passed** monorepo-wide — confirms slice 2's wire rename broke no consumer in another package. |
| `npm run test:cucumber` | 0 | ✅ 154 scenarios / 1461 steps (run directly, above). |

`npx vp lint .` in `packages/sail-desktop-agent` also exits 0.

**Known flake, unrelated to this delivery**

- `src/app-connection/__tests__/wcp-host-logger-threading.test.ts` > "routes MessagePortTransport message logs to the host logger, not console" failed on 2 of 11 full-suite runs and passed on every isolated run. Untouched by any slice here. Mechanism looks like a load-sensitive race: the test does one `flushAsyncDelivery()` (`setTimeout(0)`) after a MessagePort hop, then asserts `logger.debugCalls` is populated — which is exactly the pattern `AGENTS.md:62` says to replace with `vi.waitFor`. Baseline (slices stashed) passed 3/3, so causation is unproven either way; it is recorded here so the next run does not attribute it to this branch.

## Review Notes

**Slice 1 — reviewed by `agent-skills:code-reviewer`, verdict APPROVE.**

- **Required:** none.
- **Applied anyway (cheap, and the plan's own "update the record" rule):**
  - `AGENTS.md:63` now states the change is **breaking** for a client matching the old literals — the plan's Risks section named that bullet as the discoverability mechanism.
  - `sail-desktop-agent-audit-2026-08.md:119,343,390` struck through and marked **superseded 2026-08-07**; they still recorded the reversed decision.
- **Follow-up (parked, see Parked Follow-ups):** the guard checks the table's *label*, not the value the `invoke` asserts; the two catch-all fallbacks at `events/handlers.ts:80,125` now report `InvalidArguments` for internal errors; "instance not found" returns `InvalidArguments` in `handleAddEventListenerRequest` but `ResolveError.TargetInstanceUnavailable` in `handleAddIntentListener`.
- **Ignore for MVP:** dead `IntentListenerConflict` fallback cast at `fdc3-errors.ts:84`; a unit case duplicating the `addEventListener` coverage that `event-listeners.feature:78` already proves; `vp fmt --check` failing on 183 pre-existing files.
- **False alarm resolved:** the tester flagged `addEventListener` with an unsupported type as an untested acceptance criterion. The reviewer verified `event-listeners.feature:78` does cover it and is not vacuous — single-row table, non-`{null}` literal, so `matchDataUnordered` throws on no match.

**Slice 4 — reviewed by `agent-skills:code-reviewer`, verdict APPROVE. Required: none. The tester deviated from the plan and the reviewer upheld the deviation.**

- **The plan's premise for target A was wrong.** The test at `wcp-reconnect-clobber.test.ts:180` was **not** vacuous — only the *goodbye* was dead. `bridgeAppPort`'s `onDisconnect` (`wcp-message-routing.ts:78-84`) reads `transportToInstanceId`, so the three assertions bind with or without the goodbye. The original probe proved the goodbye never arrived, not that the test could not fail.
- **Neither of the plan's two options was taken.** Option 1 (interleave the goodbye via `beginWcpAppFirstConnect`) adds nothing, and the displaced-port case is **unreachable by construction**: `updateConnectionMetadata:246` calls `disconnect()` -> `disposePort()`, which removes the `message` listener **and** calls `port.close()` synchronously before WCP5 is sent; `handleMessage` also early-returns on `!connected`. Triple-guarded. Option 2 (delete) would have lost real coverage — `:259` is a unit test whose `onDisconnect` only *mirrors* `bridgeAppPort` (its own comment at `:279` says so), making `:180` the only test that drives the real wiring end-to-end.
- **What shipped instead:** the 4 dead lines were removed, the test was retitled to what it actually proves ("…when the reconnect displaces the old port"), and all three assertions were left unchanged.
- **CORRECTION to the tester's justification.** It argued option 1 would be a "byte-for-byte duplicate" of `:219`. That is not true (grace 25 vs 80, no 200 ms wait). The accurate statement: option 1 written literally **already exists** as `wcp-temp-id-teardown.test.ts:59` — same helper, same grace 25, same three assertions. And `beginWcpAppFirstConnect` genuinely cannot bridge the gap: its WCP4 payload is `{identityUrl, actualUrl}` only (`wcp-edge-test-helpers.ts:267-270`), while `canReuseExistingIdentity` requires `reconnectInstanceId && reconnectInstanceUuid` (`wcp-identity-validation.ts:139-150`), so the second call mints a fresh id and no displacement occurs.
- **Target B verified exact and flake-free:** `retrieveAllIntents` is `catalog.apps.flatMap(...)`, app order is fixed by `catalogWith(mockApp1, mockApp2, mockApp3)`, and each fixture has exactly one `listensFor` key — so `Object.entries` order is trivially stable. Exact on length, order, and both fields.
- **Follow-up (parked):** the two new `WCP6Goodbye` findings below; `app-directory-queries.test.ts:106-110` is now fixture-coupled and wants a comment pinning it to fixture declaration order.
- **Ignore for MVP:** the 6-line comment at `wcp-reconnect-clobber.test.ts:196-201` restates the file header at `:4-8`; the `await flushAsyncDelivery()` at `:211` is now redundant; target B dropped a `contexts` presence check that was itself `toBeDefined()` on a non-optional field and is genuinely asserted at `:70-76`.

**Slice 3 — reviewed by `agent-skills:code-reviewer`, verdict APPROVE. Required: none.**

- **Follow-up (parked):** `undefined` is still accepted as "subscribe to all" (`events/handlers.ts:43`) though the closed union is `'USER_CHANNEL_CHANGED' | null` — a non-TS client sending `payload: {}` gets a listener instead of `InvalidArguments`; that is its own rejection change with its own test. `validEventTypes` is untyped `string[]`; typing it `readonly BrowserTypes.AddEventListenerRequestPayload["type"][]` would make **tsc** reject a future non-schema entry instead of relying on the runtime rows.
- **Ignore for MVP:** the two new rows live in `fdc3-error-enums.test.ts`, whose `describe` is about enum values rather than schema-union narrowing. They assert an enum value so they are not wrong there; moving them costs more than it buys.
- **`src/state/types.ts` doc-comment change judged in scope:** the old comment claimed the handler "normalize[s] the spec's variants" — plural — which stopped being true at `handlers.ts:41`. Leaving a comment describing deleted behaviour is the same failure slices 1 and 2 raised as Required.

**Slice 2 — reviewed by `agent-skills:code-reviewer`. Two Required, both doc-record only; no code change required.**

- **Required, both applied:**
  - `AGENTS.md:165` named `payload.metadata` in the `structuredClone` shared-reference warning. That constraint is still real (it guards a `DataCloneError`) but the field no longer exists under that name — a future reader would look for it, not find it, and could delete the clone at `intent-result-handlers.ts:181` as dead code. Now reads `payload.resultMetadata`.
  - The plan's own slice 2 Change list described a rename that does not match what shipped. Recorded as a CORRECTION in that section.
- **Follow-up (parked):** no unit test asserts the *absence* of the old field — only the `{null}` Cucumber cells do, and `{null}` is `toBeFalsy()`. Also, `intent-result-handlers.ts` uses three names for one value in its locals (`resultMetadata` / `metadata` / the pure alias `payloadMetadata` at `:180`); `intent-result-metadata.feature:19-20` column padding was not re-aligned.
- **Ignore for MVP:** `sail-conformance-harness/results/conformance-test-failure-review.md:118,155` still say `payload.metadata` — a dated point-in-time run log, accurate when written. Whether Sail should carry a sibling result-metadata field at all is the FDC3 3.0 draft question already parked in Risks.
- **Independently confirmed by the reviewer:** `@finos/fdc3-agent-proxy`'s `convertIntentResult` reads only `payload.intentResult.{channel,context}` and never touches `payload.metadata` — so the "zero consumers" claim in the slice holds outside the monorepo too.

## Parked Follow-ups

- **No scenario anywhere checks message ordering.** `matchData` — the strict ordered, exhaustive matcher — is exported and never called; everything runs through `matchDataUnordered` over a last-N slice. Feature tables read as ordered sequences but are not. Wiring it would likely fail scenarios and needs its own slice.
- **`{null}` resolves to `expect(actual).toBeFalsy()`** (`testing-utils.ts:130-143`), so `0`, `""` and `false` satisfy a "must be null" column. Tightening it is a one-line change with an unknown blast radius across 154 scenarios.
- **`have outgoing posts` only inspects the last N messages.** A spurious message earlier in a scenario is invisible unless the scenario also asserts `have N posts`; roughly half do not.
- **Missing spec coverage** the audit listed: private-channel broadcast after `disconnect()`, `PrivateChannel.getCurrentContext()`, `ResultError.ApiTimeout`, `ResolveError.ResolverUnavailable` / `ResolverTimeout`, `OpenError.ResolverUnavailable` / `DesktopAgentNotFound`, and DA `traceId` precedence at the wire level.
- **`intent-metadata-performance.feature` is not a spec test.** Its 500 ms / 100 ms budgets sit ~1000× above in-memory transport latency, so it cannot fail — but it could flake on loaded CI. Slice 6 only untags it; rehoming it to a bench suite is separate.
- **Sail's own outbound `WCP6Goodbye` is off-schema.** Found during slice 4, sits **squarely on this plan's stated Outcome**, and was not in the audit. `wcp/wcp-connection-management.ts:143-149` sends `{type:"WCP6Goodbye", payload: undefined, meta:{timestamp}}`. The reviewer ran the generated validator directly: that shape returns **`false`**; dropping the `payload` key returns **`true`**. Cause: `WCP6Goodbye.schema.json` sets `additionalProperties: false` over `{type, meta}`, and an own `payload` key counts even when its value is `undefined`. `timestamp: Date` is fine. **Size: one line.** Two test files copy the bad shape (`wcp-reconnect-clobber.test.ts:33`, `wcp-temp-id-teardown.test.ts:42`); two sibling integration tests already use the valid `{type, meta:{timestamp}}` form, so the in-repo precedent exists. **This one should probably be its own slice before slice 5** — slice 5's gate will surface it as a warning that is a real defect, not an allowlist entry.
- **`wcp-temp-id-teardown.test.ts:33-38` has a docblock that is factually wrong and describes a live trap.** It calls the shape "Schema-valid WCP6Goodbye" and then explains that "a malformed goodbye here would be dropped for the wrong reason and the test would 'pass' without ever arming the temp-keyed grace timer." That is exactly what will happen the moment `validation: "strict"` or slice 5's gate lands — `bridgeAppPort:58-65` rejects before the WCP6 early-return at `:67`. It survives today only because `warn` is the default. Same class of defect as slice 4 itself.
- **Slice 3 review follow-ups (not blocking):** `undefined` is still accepted as "subscribe to all" at `events/handlers.ts:43` even though the closed union is `'USER_CHANNEL_CHANGED' | null` — a non-TS client sending `payload: {}` gets a subscribe-to-all listener rather than `InvalidArguments`. `validEventTypes` (`:41`) is untyped `string[]`; typing it `readonly BrowserTypes.AddEventListenerRequestPayload["type"][]` would move the guard from runtime to **tsc**.
- **Slice 2 review follow-ups (not blocking):** no unit test asserts the *absence* of `payload.metadata` on `raiseIntentResultResponse` — `expect(response!.payload).not.toHaveProperty("metadata")` in `intent-result-handlers.test.ts:133` and `intent-result-client-metadata.test.ts:251` would make the "never `metadata`" half of the Acceptance a real assertion instead of relying on `{null}`/`toBeFalsy()`. `intent-result-handlers.ts` also uses three names for one value in its locals — `resultMetadata` (`:97,113`), `metadata` (`:167,176`), and the pure alias `payloadMetadata` (`:180`). The `intent-result.feature` tables are now 15 columns wide with 12 `{null}` cells per scenario; the real fix for that is the parked `matchData` work, not more columns.
- **Slice 1 review follow-ups (not blocking):** the enum guard in `fdc3-error-enums.test.ts` checks each row's `expectedError` *label*, but each row's `invoke` hardcodes its own assertion — the two can drift; threading the value through `invoke(expected)`, or typing the field as `BrowserTypes.ResponsePayloadError`, would close it. The catch-all fallbacks at `events/handlers.ts:80,125` now report `InvalidArguments` for what may be an internal DA failure — there is no on-schema code for that, so it wants a comment. "Instance not found" returns `InvalidArguments` in `handleAddEventListenerRequest` but `ResolveError.TargetInstanceUnavailable` in `handleAddIntentListener`.
- **Untested branches** named in the audit: `dispatchWcpMessage` goodbye/default/rejected paths, `openApp` both throws, `applyInboundValidationPolicy` in `warn` and `off` (i.e. the default), `bridgeAppPort` rejections, `replaceDirectoriesInState`, `retrieveAppsByUrl`.

## Known Limitations

- **`npm run validate` does not pass on this branch**, and did not before it either. Two steps are red for reasons outside this diff: `vp fmt --check` on 421 monorepo files, and the `@finos/sail-one` build. See the Monorepo gate table in Verification Notes. Every other step, and every check scoped to `sail-desktop-agent`, is green.
- **Slice 1 is a breaking wire change.** A client matching the literal `"ListenerNotFound"` or `"ListenerError"` stops matching. Nothing in this monorepo does, and the reference client `@finos/fdc3-agent-proxy` does not, but an external adopter might. `AGENTS.md:63` now says so explicitly.
- **`raiseIntentResultResponse.resultMetadata` is still off the pinned 2.2 schema** — exactly as `metadata` was. The rename aligns Sail's wire with its own internal naming and the FDC3 3.0 draft; it does not make the payload schema-valid. That is the draft question parked in Risks.

- Slice 5 leaves the structural gap open: Cucumber talks to `DacpTestAppConnection`, so `BrowserAppConnection`'s origin-stripping and trusted-source stamping stay covered by unit tests alone. This plan makes the harness stop *faking* that seam; it does not make the BDD suite cross it.
