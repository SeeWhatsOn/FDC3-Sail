# Minimal Viable Delivery Plan: sail-desktop-agent test-suite realignment

Status: implementing
Current slice: 1

**Approved 2026-08-07: slices 1–4 only.** Slices 5 and 6 are behind a **human gate** — do not start either
until the user has reviewed the results of slices 1–4 and explicitly released them. Slice 5's design
question (does `DacpTestAppConnection` need the enrichment `BrowserAppConnection` does?) is the reason
for the gate, and it gets answered with the user, not inside a slice.

Working branch: `fix/da-wire-conformance`, cut from `wip/v3-local`.

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

### 3. Accept only the schema's event type

- **Goal:** `addEventListenerRequest` accepts `USER_CHANNEL_CHANGED` and `null` — the closed union in `AddEventListenerRequestPayload` — and nothing else.
- **Change:** `handlers/events/handlers.ts:40` — reduce `["channelChanged", "USER_CHANNEL_CHANGED", "userChannelChanged"]` to the schema value. Keep the internal normalisation to `"channelChanged"`; that is an internal listener key, not a wire value. Update the 7 uses in `event-listeners.feature` and the message built in `test/step-definitions/event-listener.steps.ts:55`.
- **Acceptance:** `USER_CHANNEL_CHANGED` registers; `userChannelChanged` and `channelChanged` return `InvalidArguments` (depends on slice 1). `null` still subscribes to all.
- **Verify:** `npx vp test run && npx cucumber-js`
- **Likely files:** `handlers/events/handlers.ts`, `event-listeners.feature`, `event-listener.steps.ts`.
- **Rationale for dropping the aliases rather than keeping them:** `AGENTS.md:153` — no back-compat shims unless explicitly asked. If a real adopter sends the camelCase form, that is a written requirement and the aliases come back with a comment saying so.

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
- **Integration:** none new. Slices 2 and 3 are covered by the existing Cucumber scenarios once their assertions are corrected.
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

- [ ] 1 retire invented error codes: not started (failures: 0)
- [ ] 2 `resultMetadata` rename: not started (failures: 0)
- [ ] 3 narrow event type: not started (failures: 0)
- [ ] 4 repair the two vacuous tests: not started (failures: 0)
- [ ] 5 schema-validation gate in BDD: **BLOCKED — human gate.** Not started (failures: 0)
- [ ] 6 retags + dead steps: **BLOCKED — human gate.** Not started (failures: 0)

## Verification Notes

_None yet. Every entry must be a command plus the exit status observed by the main agent, not a subagent's claim._

## Review Notes

- Required:
- Follow-up:
- Ignore for MVP:

## Parked Follow-ups

- **No scenario anywhere checks message ordering.** `matchData` — the strict ordered, exhaustive matcher — is exported and never called; everything runs through `matchDataUnordered` over a last-N slice. Feature tables read as ordered sequences but are not. Wiring it would likely fail scenarios and needs its own slice.
- **`{null}` resolves to `expect(actual).toBeFalsy()`** (`testing-utils.ts:130-143`), so `0`, `""` and `false` satisfy a "must be null" column. Tightening it is a one-line change with an unknown blast radius across 154 scenarios.
- **`have outgoing posts` only inspects the last N messages.** A spurious message earlier in a scenario is invisible unless the scenario also asserts `have N posts`; roughly half do not.
- **Missing spec coverage** the audit listed: private-channel broadcast after `disconnect()`, `PrivateChannel.getCurrentContext()`, `ResultError.ApiTimeout`, `ResolveError.ResolverUnavailable` / `ResolverTimeout`, `OpenError.ResolverUnavailable` / `DesktopAgentNotFound`, and DA `traceId` precedence at the wire level.
- **`intent-metadata-performance.feature` is not a spec test.** Its 500 ms / 100 ms budgets sit ~1000× above in-memory transport latency, so it cannot fail — but it could flake on loaded CI. Slice 6 only untags it; rehoming it to a bench suite is separate.
- **Untested branches** named in the audit: `dispatchWcpMessage` goodbye/default/rejected paths, `openApp` both throws, `applyInboundValidationPolicy` in `warn` and `off` (i.e. the default), `bridgeAppPort` rejections, `replaceDirectoriesInState`, `retrieveAppsByUrl`.

## Known Limitations

- Slice 5 leaves the structural gap open: Cucumber talks to `DacpTestAppConnection`, so `BrowserAppConnection`'s origin-stripping and trusted-source stamping stay covered by unit tests alone. This plan makes the harness stop *faking* that seam; it does not make the BDD suite cross it.
