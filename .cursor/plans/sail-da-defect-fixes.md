# Minimal Viable Delivery Plan: sail-desktop-agent defect fixes

Status: **slice 2 verified + reviewed** — stop point, slices 3–4 not started
Current slice: 2 **complete**. Slices 3–4 not started.
Review/fix loops: 1 on slice 1 (review + fix, both clean). Slice 2 failures: 0

## Verify Commands

Run from `packages/sail-desktop-agent` unless noted.

- Full: `npx vp test run && npx cucumber-js`
- Focused: `npx vp test run src/app-connection/__tests__/<file>.test.ts`
- Typecheck/lint: `npx tsc --noEmit` · `npx vp lint .`
- Harness (slice 2 only, from `packages/sail-conformance-harness`): `npx vp test run`

Source: `.cursor/plans/sail-desktop-agent-audit-2026-08.md` §10 "Trust as defects — do these now". Revision 2 of that audit (post independent review) is the authority; the four items below are the ones that survived verification.

## Intent

- **Outcome:** Four verified defects in `packages/sail-desktop-agent` fixed — one identity/trust hole, one dual-source-of-truth, three off-schema wire payloads, one unsafe cast — with the BDD assertions that currently pin the wrong values corrected.
- **User:** Any FDC3 app connecting to a Sail Desktop Agent, and any host embedding it. A strict client today would reject three of our payloads.
- **Success:** `pnpm test` and the Cucumber suite pass; the four payload shapes validate against `@finos/fdc3-schema@2.2.3`; `meta.hostInstanceId` from an app can no longer select another instance.
- **Constraint:** No behaviour change beyond the defects. These are small, surgical fixes that must not drag in the ~1,150 LOC cleanup the audit also found.
- **Out of scope:** Everything in the audit's "Park until an explicit decision" list — `ChannelControl`, the 28 catch-block dedupe, the 14 hand-rolled destinations, three-identity-store redesign, `recentlyDisconnected` removal, bulk impossible-guard deletion, new WCP BDD coverage, `setOnAgentDisconnect` / `TEdge` / `initialState` removal.

## Simplicity Bias

- **Reuse:** `enrichMessageWithSource` already destructures and drops `source` / `messageOrigin` — slice 1 adds one name to that existing destructure. `raiseIntentForContext` already handles missing context correctly — slice 4 copies it rather than inventing a shape. `src/agent/fdc3-version.ts:4` already documents `implementationMetadata.fdc3Version` as the source of truth — slice 2 makes the code match the doc that is already there.
- **Avoid:** No new validation layer, no new options, no abstraction over payload construction. Every slice is a small edit at an existing site.
- **Architecture:** Unchanged. No new files except tests.

## Slices

### 1. Strip `meta.hostInstanceId` at the trust boundary

- **Goal:** An app cannot select another instance's identity by setting `meta.hostInstanceId`.
- **Change:** `app-connection/browser-app-connection.ts:202-206` — add `hostInstanceId` to the existing strip destructure:
  ```ts
  const {
    source: _appSource,
    messageOrigin: _appMessageOrigin,
    hostInstanceId: _appHostInstanceId,   // <- add
    ...safeMetaRest
  } = (currentMeta ?? {}) as Record<string, unknown>
  ```
- **Also required in the same commit:** `AGENTS.md:163` says handlers resolve identity "via registered `hostInstanceId`, registered MessagePort `instanceId`, or `wcpHandshakeRouting`". The documented intent is a *registered* value; reading it from app-supplied meta is the defect. Update that sentence so the next reviewer does not read this strip as a regression. Then reconcile `handlers/utils/resolve-context-listener-instance-id.ts:25-28` and `handlers/__tests__/wcp-host-instance-id.test.ts` with the corrected story.
- **Acceptance:** A DACP message carrying `meta.hostInstanceId` for a *different* live instance resolves to the port-derived instance, not the claimed one. Legitimate host instance adoption still works.
- **Verify:** New unit test (below) + `pnpm test` in the package + full Cucumber run.
- **Likely files:** `browser-app-connection.ts`, `resolve-context-listener-instance-id.ts`, `handlers/__tests__/wcp-host-instance-id.test.ts`, `AGENTS.md`.
- **Confirmed safe:** nothing in production writes the field — `grep -rn "hostInstanceId" packages/*/src` outside `sail-desktop-agent/src` returns 0 hits. The `hostInstanceId` at `handlers/utils/wcp-host-instance-adoption.ts:44` is a **local variable** built from `reconnectInstanceId` / `hostIdentifier` / sole-pending lookup — a name collision, not a read of `meta.hostInstanceId`. Host instance adoption is unaffected.

### 2. Collapse `fdc3Version` to `implementationMetadata`

- **Goal:** One source of truth. Today WCP3 advertises `AppConnectionOptions.fdc3Version` (default `"2.2"`) while WCP5, `getInfo` and `closeRequest` gating read `implementationMetadata.fdc3Version`. Nothing syncs them.
- **Change:** thread the agent's resolved `implementationMetadata.fdc3Version` into the connection at `agent/sail-desktop-agent.ts:152-157` (the same place `logger` / `validation` / `logPayloadDetail` are already threaded), then delete `AppConnectionOptions.fdc3Version` (`app-connection/wcp/wcp-types.ts:119`) and the `?? "2.2"` fallback at `browser-app-connection.ts:95`. `wcp1-3-handshake.ts:90` then reads the threaded value.
- **Acceptance:** Setting only `implementationMetadata.fdc3Version: "3.0"` makes WCP3 **and** WCP5 **and** `getInfo` all report 3.0, and `closeRequest` is enabled. One setting, not two.
- **Verify:** New unit test asserting WCP3 handshake and WCP5 response agree. `sail-conformance-harness/src/harness-bootstrap.ts:162,168` currently sets it twice — reduce to once and confirm the harness still runs.
- **Likely files:** `sail-desktop-agent.ts`, `wcp-types.ts`, `browser-app-connection.ts`, `wcp1-3-handshake.ts`, `harness-bootstrap.ts`.
- **Risk:** highest-coupling slice of the four. If threading proves awkward, stop and check in rather than inventing a sync mechanism.
- **As built:** the threaded value is carried on a new `WCPHandshakeContext.fdc3Version` field rather than through `context.options`, because `options` is typed `Required<AppConnectionOptions>` — the host-settable surface the slice is deleting the knob from. `getInfo` (`open/handlers.ts:60`) and `closeRequest` gating (`:411`) already read `implementationMetadata` and needed no change; only WCP3 was diverging.

### 3. Fix the three off-schema payloads + the invented error code

All verified against `node_modules/@finos/fdc3-schema/dist/generated/api/BrowserTypes.d.ts`.

| Fix | Site | Change |
|---|---|---|
| `channelChangedEvent` | `handlers/channels/handlers.ts:393-399` | Add `currentChannelId`; **drop** non-schema `channelId` and `identity`. Keep `newChannelId` — it is deprecated but schema-valid (`ChannelChangedEventPayload:1106`) and the integration test at `wcp-desktop-agent.integration.test.ts:1188` asserts it |
| PC `onDisconnect` | `handlers/private-channels/handlers.ts:472-476` | Drop `contextType` and `instanceId`. Schema defines **only** `privateChannelId` |
| `heartbeatEvent` | `handlers/heartbeat/handlers.ts:38` | Drop `eventId`. `HeartbeatEventPayload` is `{}` |
| `"ListenerError"` | `handlers/events/handlers.ts:31,49,80,109,125` | **DECIDED 2026-08-05: carve-out.** Keep the code; record it in `AGENTS.md` alongside the existing `ListenerNotFound` note as a deliberate conformance choice. No code change at the 5 sites |
| BDD | `test/features/context/event-listeners.feature:78,84` | **Unchanged** — the carve-out makes the current assertion correct |

- **Do NOT touch** `test/features/channels/private-channel.feature:130,140` — it asserts `ListenerNotFound`, which `AGENTS.md:63` records as a **deliberate** carve-out. The original audit wrongly grouped these.
- **Acceptance:** all four payloads validate against the schema; no consumer reads a dropped field.
- **Verify:** `grep` confirms no reader of `payload.identity` / `payload.contextType` / `payload.eventId` — already checked for `identity`, confirm the other two. Then package tests + Cucumber.
- **Decision made:** `"ListenerError"` is a carve-out, not a code change. That shrinks slice 3 to three payload edits plus one `AGENTS.md` note.

### 4. Fix `raiseIntent` undefined-context handling

- **Goal:** `raiseIntent` stops casting a possibly-undefined context to `Context`.
- **Change:** `handlers/intents/intent-raise-intent.ts:43` currently guards `payload.context !== undefined && !isValidContext(...)`, so `undefined` **skips** validation and reaches `const validatedContext: Context = payload.context` at `:70`. Schema marks `context` required. Drop the `!== undefined` short-circuit so a missing context returns `ResolveError.MalformedContext` like any other bad context. `raiseIntentForContext` already does this correctly — match it.
- **Acceptance:** `raiseIntent` with no context returns `MalformedContext`, not a runtime `TypeError` caught into a generic error.
- **Verify:** unit test asserting the error type.
- **Likely files:** `intent-raise-intent.ts` + one test.
- **Bonus, free:** the duplicate log block at `:55-62` and `:73-81` logs the same object twice. Remove one — it is inside the lines being touched.

## Test Plan

- **Unit:** (1) spoofed `meta.hostInstanceId` does not win over port-derived id; (2) WCP3 and WCP5 report the same `fdc3Version` from one setting; (3) `raiseIntent` with no context returns `MalformedContext`.
- **Integration:** existing `wcp-desktop-agent.integration.test.ts` already covers `channelChangedEvent` delivery — extend its assertion to `currentChannelId` rather than adding a new test.
- **Manual/runtime:** run `sail-conformance-harness` after slice 2 (it is the only consumer that sets `fdc3Version`).
- **Not testing:** payload-shape changes in slice 3 beyond the schema check and existing suites — these are field deletions with no readers.

## Review Plan

- **Main-agent checks:** diff contains only the four slices; no cleanup items leaked in; `pnpm test` + Cucumber green after each slice.
- **Fresh-context review:** slice 1 only — it is a trust boundary, and the audit's own claim about it was already narrowed once on review. Use a security-focused reviewer. Slices 2–4 get main-agent review.
- **Loop limit:** 3 per slice, then return to the user.

## Risks

- **Slice 2 is the one that can sprawl.** Threading `fdc3Version` touches the agent, the connection, its options type, and the harness. If it wants a sync mechanism, that is the signal to stop.
- **Slice 3 contains a decision, not just edits.** `"ListenerError"` has no obvious FDC3 replacement. Do not guess a code — carve-out precedent exists.
- **Slice 1 changes a documented behaviour.** `AGENTS.md` and existing tests describe preferring a registered `hostInstanceId`. The doc update is part of the slice, not a follow-up.
- **Cucumber is a weak signal here.** Per the audit, the test edge no-ops teardown and there is no WCP1/2/3/6 BDD coverage, so green BDD does not prove the browser path for slices 1 and 2. Lean on the integration tests.

## Slice Checkpoints

- [x] 1 strip `meta.hostInstanceId` + AGENTS.md: **verified** (main-agent review; fresh-context security review not run — see Review Notes)
- [x] 2 collapse `fdc3Version`: **verified** (main-agent review, per the Review Plan)
- [ ] 3 off-schema payloads + `ListenerError`: not started
- [ ] 4 `raiseIntent` context: not started

## Verification Notes

**Slice 1** (2026-08-05)

- `npx vitest run` (package): **331 passed / 50 files**
- `npx cucumber-js`: **154 scenarios, 1461 steps, all passed**
- `npx tsc --noEmit`: clean
- **Prove-It check:** the new test was run with the strip temporarily reverted and **failed** with `expected '7be3d991-…' to be undefined` — the victim's instance id leaked through. It is a real regression test, not a tautology.
- Pre-existing tests `wcp-host-instance-id.test.ts` (7) and `resolve-context-listener-instance-id.test.ts` (7) pass unchanged, confirming WCP4 host-instance **adoption** is a separate mechanism from `meta.hostInstanceId` and is unaffected.

**Slice 2** (2026-08-05)

- `npx tsc --noEmit` (package): clean · `npx vp lint .`: clean · `npx vp fmt --check .`: clean
- `npx vp test run` (package): **332 passed / 51 files** (+2 tests, +1 file — the new source-of-truth test)
- `npx cucumber-js`: **154 scenarios, 1461 steps, all passed**
- `sail-conformance-harness`: `npx tsc --noEmit` clean · `npx vp test run` **69 passed / 14 files**
- **Prove-It check:** with the threading mutated to a literal `"2.2"` at `sail-desktop-agent.ts:159`, the new test **failed** with `expected "2.2" to be "3.0"` on the WCP3 assertion while WCP5 still reported `3.0` — i.e. it reproduces the exact divergence this slice closes, not a tautology.

## Review Notes

### Main-agent review of slice 2 — run 2026-08-05

**Threading shape.** `implementationMetadata.fdc3Version` is threaded into `BrowserAppConnection` alongside the existing `logger` / `validation` / `logPayloadDetail`, then carried to WCP3 via a new `WCPHandshakeContext.fdc3Version` field. It deliberately does **not** live in `this.options` (`Required<AppConnectionOptions>`) — that type is the host-settable surface, and putting it back there would recreate the second knob.

**No sync mechanism was needed** — the Risks section's stop signal never fired. The agent already owned the resolved value at construction time.

**One default remains, and it is the right one:** `default-config.ts:24` `desktopAgentMetadata.fdc3Version: "2.2"`. The connection's `?? "2.2"` is gone, so an unset version can no longer resolve differently on the two paths. Second test case pins this.

**`BrowserAppConnection`'s constructor is now required-arg.** Not a breaking change: `src/index.ts:75` exports it as `export type` only, and `new BrowserAppConnection` appears exactly once in the monorepo (the agent). The public break is the intended one — `AppConnectionOptions.fdc3Version` is gone, so hosts set the version on `implementationMetadata`.

**Harness reduced to one setting** as the plan required; `main.test.ts:35` now asserts `implementationMetadata.fdc3Version` instead of the deleted option.

**No Required findings.** No Follow-up. Diff contains only slice 2 (plus slice 1's still-uncommitted work) — no cleanup items leaked in.

### Fresh-context security review of slice 1 — run 2026-08-05

**Verdict: the trust boundary is sound for `meta.hostInstanceId` on the production path.** `bridgeAppPort` → `enrichMessageWithSource` is the only feeder of `onAppMessage` in production, and the strip is unconditional there. Verified no other caller of `onAppMessage` exists in `src/`.

**Confirmed closed.** The pre-fix hole was real and worse than the audit described — three abusable callers of `resolveDacpHandlerInstanceId`, the worst being `handlers/open/handlers.ts:408` `handleCloseRequest`, which reaches `appLauncher.close(targetInstanceId)`. **Any connected app could close any live instance.** Also: broadcast attribution as the victim, silent unsubscribe of the victim's context listeners, and satisfying the intent-result ownership check as another instance.

**Independently re-verified my "safe to strip" claim and it held** — zero production writers of `meta.hostInstanceId` monorepo-wide; the `hostInstanceId` in `wcp-host-instance-adoption.ts:44` is a local built from `payload.instanceId` / WCP1 `window.name` / sole-pending lookup, never from meta. Test helpers pass it in **`payload.instanceId`**, not meta.

**Required — my own `AGENTS.md` edit is partly wrong.** The sentence says the strip policy applies "on the DACP test edge in `handleWcpMessage`". **There is no `handleWcpMessage` in `src/`** — verified, it appears only in `AGENTS.md` and two test comments; the nearest real function is `SailDesktopAgent.dispatchWcpMessage:341`. And `DacpTestAppConnection.receiveMessage` (`test/support/dacp-test-app-connection.ts:59-65`) strips nothing at all. The sentence was already wrong before slice 1; adding `meta.hostInstanceId` to it made it assert a guarantee that path does not provide. **Fix the sentence or implement the strip on the test edge.** Consequence: BDD green is zero evidence for this fix — as the Risks section predicted.

**Required — delete the branch rather than trust it.** Delete `resolve-context-listener-instance-id.ts:30-34` plus the `hostInstanceId?: string` field at `:7`. Reasoning: it is unreachable in production; its safety currently depends on a destructure in a *different file* staying correct forever; and any future edge that does not call `enrichMessageWithSource` silently reopens the `closeRequest` escalation with no change to this file. Tier 3 (`resolveLinkedInstanceId`) already covers the temp-routing-id case the branch nominally exists for. **Keep the strip** — it just stops being load-bearing. Cost: 5 lines + 1 type field + 2 tests.

**Required — the regression test guards the mechanism, not the exploit.** It uses `WCP4ValidateAppIdentity`, which never reaches `resolveDacpHandlerInstanceId`; it calls the private method through a cast rather than posting on `appPort`; and it asserts field shape, not victim impact. It would **not** catch a regression that re-adds the field downstream of enrich. Fix: drive a spoofed `broadcastRequest` over the real port and assert `deliveredEvent.payload.metadata.source.instanceId` is the attacker's, not the victim's. Helpers already exist in `wcp-edge-test-helpers.ts`.

**Important finding — `strict` mode was never a control for the worst caller.** `closeRequest` has no entry in `INBOUND_VALIDATORS`, and `isValidInboundMessage` returns `true` for unmapped types (`validate-dacp-message.ts:100-104`). So a `closeRequest` with off-schema `meta.hostInstanceId` passed validation in `off`, `warn` **and** `strict`. The strip — not the validator — is the only control that holds for it. Do not let anyone later remove the strip on the theory that strict mode covers it.

**Other meta fields checked, no action needed:** `meta.destination` is inert inbound (response builders never spread inbound meta; `withDestinationRouting` stamps last). `meta.requestUuid` is app-chosen by FDC3 design; residual risk is two apps clobbering a private-channel listener slot — robustness, not privilege escalation.

**Follow-up (pre-existing, unrelated):** `strict` mode rejects silently in `bridgeAppPort:58-65` though `validate-dacp-message.ts:51` promises a `MalformedMessage` error response.

**Ignore for MVP:** the test-edge validation-sniffing gap at `sail-desktop-agent.ts:347` (`meta?.source !== undefined` used as a proxy for "already enriched") — test-only, harmless in production because `bridgeAppPort` validates raw first.

### Fix pass — all 3 Required closed (2026-08-05)

**1. `AGENTS.md` sentence fixed.** Dropped the `and on the DACP test edge in \`handleWcpMessage\`` clause. Independently confirmed the function does not exist: `grep -rn "handleWcpMessage" packages/*/src` finds it only in `AGENTS.md` and two test *comments*.

**2. Branch deleted.** Removed the `meta.hostInstanceId` tier from `resolve-context-listener-instance-id.ts` and the `MessageWithDacpInstanceMeta` type. **Knock-on the review did not predict:** with that tier gone the `message` parameter became entirely unused, so the signature collapsed to `resolveDacpHandlerInstanceId(context)`. Updated 5 production call sites (`broadcast/handlers.ts:44,157,279`, `intent-result-handlers.ts:84`, `open/handlers.ts:408`) and 5 test call sites, and removed 5 now-unused `const message` fixtures. **The function can no longer read message meta at all** — the invariant is now enforced by the signature, not by discipline. That is stronger than the review asked for. Deleted the 2 tests that fed the branch; added one asserting identity comes from the registered port-derived id.

**3. Regression test rewritten end-to-end.** `wcp-trusted-metadata.test.ts` now connects a victim and an attacker, joins both to `fdc3.channel.1`, registers a victim context listener, then posts a **spoofed `broadcastRequest`** on the attacker's real port and asserts `payload.originatingApp.instanceId` is the attacker's. Runs the full `bridgeAppPort` → validation → enrich → `resolveDacpHandlerInstanceId` chain.

**Prove-It on the rewritten test — two runs:**

| Mutation | Result |
|---|---|
| Branch re-added, strip intact | **Passes** — correct. The strip alone is sufficient; this is the reviewer's point that the branch was only ever safe *because of* the strip |
| Branch re-added **and** strip removed | **Fails** (5s timeout, no `broadcastEvent` — the broadcast was attributed to the victim) |

So the test guards the end-to-end property, not the destructure. It would catch a re-add anywhere in the chain.

**Full verification after the fix pass:** `npx tsc --noEmit` clean · `npx vitest run` **330 passed / 50 files** (one fewer than before — 2 branch tests deleted, 1 added) · `npx cucumber-js` **154 scenarios / 1461 steps passed** · `npx vp lint .` clean.

## Parked Follow-ups

Everything in the audit's park list. Named here so it does not creep in:
`ChannelControl` decision; 28 catch-block dedupe; 14 hand-rolled `meta.destination` sites; three-identity-store invariants; `recentlyDisconnected` removal (takes the anti-restore guard tests with it); bulk app-directory impossible-guard deletion (remote JSON — weakest class); WCP1/2/3/6 + heartbeat BDD coverage and the orphaned heartbeat `Given`; `setOnAgentDisconnect` removal (needs a Cucumber shutdown replacement first); `TEdge` generic; constructor `initialState`; 31 zero-caller exports; intent-resolver type unification; `channelSelector` website doc bug.

## Known Limitations

- _(none yet)_
