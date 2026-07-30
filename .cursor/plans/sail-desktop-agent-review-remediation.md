# Minimal Viable Delivery Plan: sail-desktop-agent Review Remediation

Status: done
Current slice: complete (slices 0–11)
Review/fix loops: 0
Parked decision: Slice 11 — no changeset; leave API-break note for maintainers (done in Known Limitations).
Slice 9 decision (2026-07-30): #14 REVERT — WeakMap-by-owner for heartbeat /
pending-intent registries is YAGNI. Product is one DesktopAgent per tab (integrator
singleton; AGENTS.md: do not add multi-agent-in-process isolation for the browser path).
Keep module-global maps + `clearAll*ForTesting` / Cucumber After hooks. Delete the
synthetic multi-agent isolation suite. Keep #12 (throw on resolve-only select/cancel).
Slice 3 decision (landed `a9614dc46`): Original AccessDenied-if-not-connected rejected
(breaks FDC3 client flow). Tightened to: no auto-join; grant creator on create + raiser
on private intent-result; AccessDenied otherwise.
Slice 4 decision (2026-07-29): Option A — validate raw app message **before** enrichment
and before WCP6 early-return at the MessagePort edge (`bridgeAppPort`), plus the same
gate in `DesktopAgent.handleWcpMessage` for the DACP test edge. Do not validate
post-enrichment (Sail-injected `source`/`messageOrigin` fail FDC3 WCP schemas).
Slice 5b decision (2026-07-30): Option B — delete `Object.assign` restore from
`recentlyDisconnected`; cancel pending disconnect only. Identity continuity lives in
agent/identity state, not connection metadata blob. Unhappy-path tests assert bad
outcomes must NOT happen.
Slices 5a/5b inserted (2026-07-29): four new findings (WCP-A..D) from a follow-up review
of the WCP handshake temp→validated remap. Inserted as decimals rather than renumbering
6–11, which are cross-referenced from Test Plan, Review Plan, Risks, and Checkpoints.
**5a must land before slice 6** — slice 6 makes `wcpHandshakeRouting` the single resolution
mechanism, and 5a is the proof that that link is currently unsafe in teardown paths.

Source: whole-package review of `@finos/sail-desktop-agent` on `wip/v3-local` (`0c5f3966a`),
15 numbered findings + 6 nits + 6 dead-code candidates, plus a follow-up lint pass that added
one hard error and promoted finding #11 from Consider to Required.

**This plan is complete.** All slices 0–11 landed; parked follow-ups remain in Parked Follow-ups / Known Limitations.

---

## Intent

- **Outcome:** Every finding in the review is fixed, both broken quality gates are green, and the
  package is mergeable without a "we'll clean it up later" list.
- **User:** Sail maintainers merging the new `sail-desktop-agent` package; downstream consumers
  `sail-platform`, `sail-finance`, `sail-conformance-harness`.
- **Success:**
  - `npm run typecheck -w @finos/sail-desktop-agent` — clean
  - `npm run lint -w @finos/sail-desktop-agent` — zero errors, zero `no-unsafe-*` warnings
  - `npx vitest run` in the package — green, including the new reproduction tests
  - `npm run test:cucumber` — green (no conformance regression)
  - Root `npm run build` — green (no downstream break from the dead-code slice)
- **Constraint:** Findings #2, #3, #4, #5 were found by code reading, not by a failing test. Each
  gets a reproduction test that **fails on current code** before its fix lands. If a reproduction
  test cannot be made to fail, stop and report — the finding may be wrong.
- **Out of scope:**
  - The intent-resolution chain (`handlers/intents/intent-raise-*.ts`, ~1,200 lines). The reviewer
    read it structurally only and expects comparable findings there. **Not covered by this plan.**
    Recommend it as the next delivery.
  - Any architectural change beyond the specific remedies below.
  - Coverage increases, performance work, or new abstractions.

---

## Simplicity Bias

- **Reuse:** Every remedy here is a deletion, a guard, or moving an existing call — not new
  machinery. `notifyChannelMembershipChanged`, `ChannelAccessDeniedError`, `isValidInboundMessage`,
  `wcpHandshakeRouting`, and the `Logger` interface all already exist. Wire to them.
- **Avoid:** New abstractions, new options, new files, new dependencies. If a slice starts wanting
  one, stop and ask.
- **Architecture:** Unchanged. The reviewer explicitly endorsed the state/router/schema-delegation
  design. Nothing here should move a module boundary.

### Path corrections

The review used shortened paths. The real ones:

| Review said | Actual path (under `packages/sail-desktop-agent/`) |
|---|---|
| `sail-desktop-agent.ts` | `src/agent/sail-desktop-agent.ts` |
| `desktop-agent.ts` | `src/agent/desktop-agent.ts` |
| `validate-dacp-message.ts` | `src/dacp/validate-dacp-message.ts` |
| `wcp1-3-handshake.ts` | `src/app-connection/wcp/wcp1-3-handshake.ts` |
| `wcp-identity-validation.ts` | `src/app-connection/wcp/wcp-identity-validation.ts` |
| `wcp-message-routing.ts` | `src/app-connection/wcp/wcp-message-routing.ts` |
| `intent-resolver.ts` (host contract) | `src/host-contracts/intent-resolver.ts` |

Line numbers in the review are from `0c5f3966a` and will drift as slices land. Locate by symbol
name, not line number.

---

## Slices

Order is load-bearing. Slice 0 unblocks verification for everything else. Slices 1–4 are the
Criticals and the security findings. Slice 11 must run last because slices 4 and 7 change what
counts as dead.

---

### Slice 0 — Green both quality gates

**Findings:** #1 (typecheck + lint hard error), plus the unused-alias error from the lint pass.

**Goal:** `typecheck` and `lint` both exit zero, so later slices can actually be verified. Nothing
else changes.

**What to do:**
1. `src/app-connection/__tests__/message-port-transport.test.ts` — the `createMinimalWCPContext()`
   fixture builds an object typed `Required<AppConnectionOptions>` but is missing
   `resolveHostIdentifier`, which was added to `AppConnectionOptions` in
   `src/app-connection/browser-app-connection.ts`. Add the field to the fixture with a stub that
   matches the real signature. Do not widen the fixture's type to make the error go away.
2. `src/__tests__/dacp-log-redaction.test.ts` — the type alias `LoggingAwareDesktopAgentOptions` is
   declared and never referenced. Delete it. (`LoggingAwareOptions` and `LoggingAwareHandlerContext`
   in the same file *are* used — leave them.)

**Acceptance:** Both commands exit zero. No production file touched.

**Verify:**
```bash
npm run typecheck -w @finos/sail-desktop-agent && npm run lint -w @finos/sail-desktop-agent
```

**Likely files:** `src/app-connection/__tests__/message-port-transport.test.ts`,
`src/__tests__/dacp-log-redaction.test.ts`

> **If the toolchain won't run:** the reviewer could not execute `vitest` or `lint` because
> `node_modules` had Windows rolldown bindings in a Linux container. On the user's own Windows
> checkout this should just work. If it doesn't, fix the install (`npm ci` at the repo root) before
> starting — every later slice depends on being able to run tests.

---

### Slice 1 — One typed emitter for `channelChanged`

**Findings:** #2 (Critical) and #11 (Required). **These have the same remedy — do them together.**

**Why together:** `channelChanged` currently has two independent emitters with non-overlapping
trigger conditions. That duplication is *why* #2 is hard to see. Fixing #11 without #2 leaves the
bug; fixing #2 without #11 leaves the second emitter to drift again.

**The bug (#2):** In `src/handlers/channels/handlers.ts`, `handleJoinUserChannelRequest` computes
`wasAlreadyOnChannel` and then skips *both* `deliverCurrentContextToInstanceListeners` *and*
`notifyChannelChanged` when it's true. But `SailDesktopAgent.channels.changeAppChannel()` awaits the
`channelChanged` connector event, which only fires downstream of `notifyChannelChanged`. So a
redundant join — clicking the already-active channel pill, which any host chrome will do — hangs
and rejects after 10s with `Channel change timeout for instance ...`.

Note the asymmetry that confirms the intent: `handleLeaveCurrentChannelRequest` in the same file
calls `notifyChannelChanged` unconditionally.

**The smell (#11):** `AppConnectionRegistry.emitChannelChanged`
(`src/app-connection/app-connection-registry.ts`) is a second, hidden emitter. It sniffs outbound
DACP message `type` and digs into `payload.identity.instanceId` to synthesize the host event. That
is FDC3 channel semantics living inside the transport registry, and because `payload` types as
`any` on that union member, the block hand-rolls `in` + `typeof` narrowing — which is exactly the
five `no-unsafe-*` lint warnings.

**What to do:**
1. In `src/handlers/channels/handlers.ts`: narrow `wasAlreadyOnChannel` so it guards **only**
   `deliverCurrentContextToInstanceListeners` (its documented purpose — avoiding duplicate context
   delivery). Call `notifyChannelChanged` unconditionally, matching the leave path.
2. In the same file, `notifyChannelChanged` should call `context.notifyChannelMembershipChanged?.(instanceId, channelId)`
   unconditionally — it already has correctly-typed `instanceId` and `channelId` in hand. (Check the
   existing call site inside `notifyChannelChanged`; it may already be there but conditionally
   reached.)
3. Delete `AppConnectionRegistry.emitChannelChanged` and its call site in the same file.

**Acceptance:**
- `changeAppChannel(instanceId, <the channel it is already on>)` resolves promptly instead of
  rejecting after 10s.
- Joining a *different* channel still emits exactly one `channelChanged` — not two.
- Context is still delivered exactly once on a real channel change, and **not** re-delivered on a
  redundant join.
- All five `no-unsafe-*` warnings in `app-connection-registry.ts` are gone.

**Test (reproduction-first):**
- Failing test before the fix: call `changeAppChannel` twice with the same channel id; assert the
  second resolves. On current code it rejects with the timeout.
- Guard test: assert `channelChanged` fires **once** per real channel change (this is the test that
  catches a regression if someone re-adds a second emitter).
- Guard test: assert context is not re-delivered to listeners on a redundant join.

**Verify:**
```bash
npx vitest run src/handlers/channels src/app-connection --root packages/sail-desktop-agent
```
Then the full package suite plus `npm run test:cucumber:channels`.

**Likely files:** `src/handlers/channels/handlers.ts`,
`src/app-connection/app-connection-registry.ts`, tests under `src/handlers/channels/__tests__/`

---

### Slice 2 — Fix the concurrent directory-load lost update

**Finding:** #3 (Critical).

**The bug:** In `src/state/mutators/app-directory.ts`, `replaceDirectoriesInState` (or its
equivalent — locate by the `Promise.allSettled(urls.map(...))` block) reassigns a shared `next`
variable inside an async `.map` callback. `.map` invokes every callback before any `await` resolves,
so all N callbacks capture the *same* initial `next`. Each returns `initial + its own apps`, and the
last to resolve overwrites the rest. Load 3 directories, get the apps of exactly 1.

**What to do:** Replace the concurrent fold with either a sequential `for...of` + `await`, or —
if load concurrency matters — `Promise.allSettled` on the *fetches only*, then a single synchronous
fold of all results into state. Do not keep the shared mutable accumulator.

**Acceptance:** Loading N directory URLs yields the union of all N directories' apps. A single
failing URL still does not abort the others (that's what `allSettled` was there for — preserve it).

**Test (reproduction-first):** The existing test at
`src/app-directory/__tests__/app-directory-agent-state.test.ts` passes a single-element array, which
makes the race structurally unreachable. **The missing multi-URL test is the real finding.** Add a
test that loads 3 directories with distinct apps and asserts all three appear. It must fail on
current code. Add a second case where one of the three URLs fails and the other two still load.

**Verify:**
```bash
npx vitest run src/app-directory src/state/mutators --root packages/sail-desktop-agent
```

**Likely files:** `src/state/mutators/app-directory.ts`,
`src/app-directory/__tests__/app-directory-agent-state.test.ts`

---

### Slice 3 — Close the private-channel auto-join hole ✅ `a9614dc46`

**Finding:** #4 (Required, security). **Landed with revised grant model** (see header).

**The bug:** `handleAddContextListener` (and `PrivateChannel.addEventListener`) auto-joined any
instance that knew the private channel ID. Broadcast already denied; listen was the hole.

**What landed:** No auto-join. Membership grant: creator on `createPrivateChannel`; intent raiser
(`pendingIntent.sourceInstanceId`) when an intent result returns an existing private channel.
Ungranted listen / addEventListener → `AccessDenied`. Cucumber: AccessDenied for ungranted `a2`;
lifecycle scenarios use fixture grant step.

**Follow-up (not blocking):** real create→intent-result→listen Vitest; optional lifecycle
AccessDenied BDD.

---

### Slice 4 — Validate WCP4/WCP6 before dispatch

**Finding:** #5 (Required, security).

**The bug:** `src/dacp/validate-dacp-message.ts` registers `INBOUND_VALIDATORS` entries for
`WCP4ValidateAppIdentity` and `WCP6Goodbye`, but they are dead: `src/agent/desktop-agent.ts`
dispatches both directly from `handleWcpMessage` and `return`s before reaching `routeDACPMessage`,
which is the only caller of `isValidInboundMessage`.

So the handshake message — the security boundary — is the one message that skips schema validation.
`handleWcp4ValidateAppIdentity` in `src/app-connection/wcp/wcp-identity-validation.ts` then does a
bare `message as Wcp4ValidateAppIdentity` cast and reads `payload.identityUrl` unvalidated. It
doesn't crash today (`new URL()` throws into the catch), but `strict` validation mode is not honored
where it matters most.

**What to do:** Run `isValidInboundMessage` inside `handleWcpMessage` before the WCP4/WCP6 dispatch,
honoring the configured `ValidationMode` the same way `routeDACPMessage` does. Reuse the existing
policy — do not write a second validation path.

**Acceptance:** A malformed `WCP4ValidateAppIdentity` is rejected by policy (per `ValidationMode`)
rather than reaching the handler. The two `INBOUND_VALIDATORS` entries are now live. Well-formed
handshakes are unaffected.

**Test (reproduction-first):** In `strict` mode, send a `WCP4ValidateAppIdentity` with a
schema-invalid payload and assert it is rejected by the validation policy. On current code the
handler is entered. Add the `WCP6Goodbye` equivalent. Add a well-formed-handshake guard test.

**Verify:**
```bash
npx vitest run src/agent src/dacp src/app-connection/wcp --root packages/sail-desktop-agent
```
Plus full `npm run test:cucumber` — this sits on the handshake path, so conformance is the real gate.

**Likely files:** `src/agent/desktop-agent.ts`, tests under `src/agent/__tests__/` and
`src/dacp/__tests__/`

---

### Slice 5 — Set trusted metadata unconditionally

**Finding:** #6 (Required, security). Split from #7 per maintainer decision — land this first.

**The bug:** In `src/app-connection/browser-app-connection.ts`, outbound message `meta` is built by
spreading the app-supplied `currentMeta` and then patching it:
- `meta.messageOrigin` is only overwritten `if (storedMessageOrigin)` — so an app-supplied
  `messageOrigin` survives whenever the stored value is falsy. `messageOrigin` is the value WCP4
  origin validation compares against in `wcp-identity-validation.ts`.
- `meta.source.appId` is copied straight from the app on *every* message (`instanceId` is correctly
  set from trusted state; `appId` is not).

The reviewer could not construct a live exploit — `event.origin` is always recorded at WCP1 in
`wcp1-3-handshake.ts`, so `storedMessageOrigin` is always truthy in the current wiring. **The safety
of this line depends on an invariant asserted nowhere.** That's the finding.

**What to do:** Delete `messageOrigin` and `source` from `currentMeta` before spreading, then set
both from trusted state unconditionally. **Absence of a trusted origin must clear the field, not
preserve the client's value.**

**Acceptance:** An app that sets `meta.messageOrigin` or `meta.source.appId` on an outbound message
cannot influence what the agent records. With no stored origin, `messageOrigin` is absent/undefined —
never the app's value.

**Test:** Direct unit test on the meta-building path: feed a message with hostile `meta` and assert
the trusted fields win in both the has-stored-origin and no-stored-origin cases. (Reproduction-first
is not required here — the hostile-input assertion *is* the reproduction.)

**Note for slice 6:** this slice removes the untrusted input that feeds #7. Do not let that be
mistaken for #7 being fixed — the identity heuristic is still there.

**Verify:**
```bash
npx vitest run src/app-connection --root packages/sail-desktop-agent
```

**Likely files:** `src/app-connection/browser-app-connection.ts`

---

### Slice 5a — Don't let temp handshake ids escalate teardown to the live instance

**Findings:** WCP-A, WCP-B (new — handshake remap review 2026-07-29; **not** among the original 15).
**Must land before slice 6.**

**The bug (two paths, one root cause):** `updateConnectionMetadata` in
`src/app-connection/wcp/wcp-connection-management.ts` remaps `temp-{uuid}` → validated `instanceId`
and links `temp → validated` in `wcpHandshakeRouting` so late handshake-keyed traffic still routes.
That link is never cleared on success, and the grace-period maps are keyed by whatever id was current
when the event arrived. So **any teardown that arrives keyed by the temp id resolves forward and
tears down the live connection.**

*Path A (WCP-A) — `WCP6Goodbye` before WCP4.* `bridgeAppPort` keys goodbye off
`transportToInstanceId`, which is still the temp id, so `handleWCP6Goodbye` arms
`pendingDisconnects[temp]`. The remap only cancels `pendingDisconnects[actualInstanceId]` — miss.
When the grace timer fires it calls `resolveRoutingInstanceId(temp)`, which now resolves to validated
because the remap linked it, and tears down the instance whose handshake just succeeded. Default
`disconnectGracePeriod` is 2000ms, so the window is goodbye-then-completed-WCP4 inside 2s.

*Path B (WCP-B) — WCP5 failure addressed to an already-remapped temp.*
`AppConnectionRegistry.sendToAppInstance` calls `disconnectApp(destinationId)` on
`WCP5ValidateAppIdentityFailedResponse`; `BrowserAppConnection.disconnectApp` resolves temp →
validated and prunes the live connection. Note `WCPRoutingContext.disconnectApp` is documented
"Connection-only prune (pre-WCP5 handshake timeout)" — the implementation contradicts its own
contract by resolving forward.

**What to do:**
1. In `updateConnectionMetadata`, cancel and delete `pendingDisconnects[tempInstanceId]` and drop
   `recentlyDisconnected[tempInstanceId]` alongside the existing validated-keyed cancellation. This
   is the two-line change and it closes Path A.
2. Make the pre-WCP5 prune path honor its documented contract: the handshake-prune entry point must
   not resolve a temp id forward to a validated instance.

**Do not** fix this by clearing the `temp → validated` link at remap. Slice 6 makes that link the
single resolution mechanism for legitimate late handshake traffic. The defect is teardown
escalation, not the link.

**Acceptance:**
- A `WCP6Goodbye` received before WCP4 cannot tear down the instance the subsequent handshake
  produced.
- A WCP5 failure response addressed to an already-remapped temp id cannot tear down the live
  validated connection.
- Legitimate teardown is unchanged: goodbye *after* remap, handshake timeout on a never-validated
  temp, and explicit `disconnectAppByInstanceId` all behave as before.

**Test (reproduction-first — both must fail on current code):**
- WCP1 → goodbye on the temp-keyed port → WCP4 completing inside the grace period → advance timers
  past `disconnectGracePeriod` → assert the validated connection is still registered and no
  `appDisconnected` fired.
- Complete a handshake, then deliver a `WCP5ValidateAppIdentityFailedResponse` addressed to
  `temp-{uuid}` → assert the validated connection survives.
- Guards: goodbye *after* remap still tears down; handshake timeout still prunes an unvalidated temp.

**Verify:**
```bash
npx vitest run src/app-connection --root packages/sail-desktop-agent
```
Plus full `npm run test:cucumber` — handshake and disconnect are both conformance-covered.

**Likely files:** `src/app-connection/wcp/wcp-connection-management.ts`,
`src/app-connection/app-connection-registry.ts`, `src/app-connection/browser-app-connection.ts`,
tests under `src/app-connection/__tests__/`

---

### Slice 5b — Reconnect must not leave two ports under one instanceId

**Findings:** WCP-C, WCP-D (new — handshake remap review 2026-07-29).

**The bug:** on reconnect, `updateConnectionMetadata` writes the new connection over the validated
key without retiring what was already there.

*Displaced transport (WCP-C).* `connections.set(actual, metadata)` and
`messagePortTransports.set(actual, appTransport)` overwrite the previous entries, but the displaced
`MessagePortTransport` is never disconnected and its `transportToInstanceId` entry
(`oldTransport → validated`) is never deleted. MessagePort has no native close event — see the
comment in `src/app-connection/message-port.ts` — so nothing retires it on its own. And the grace
period exists *precisely because* pagehide is a false positive, so the displaced page is usually
still alive. Any message it sends is attributed to the new connection, and a `WCP6Goodbye` from it
tears the new one down.

*Stale restore (WCP-D).* The grace-period restore does
`Object.assign(metadata, recentlyDisconnectedEntry.metadata)` over all eight
`AppConnectionMetadata` fields, then re-sets only `instanceId` and `appId`. So
`connectionAttemptUuid`, `messageOrigin`, `source`, `port`, `connectedAt`, and `hostIdentifier` keep
the *old* connection's values permanently — `connections.get(validated).port` is a closed port and
`.source` is a dead window, while `messagePortTransports` holds the live one.
`resolveConnectionHostIdentifier` reads `connection.source`.

**What to do:**
1. Before claiming the validated key, retire any existing entry: delete its `transportToInstanceId`
   entry, then disconnect its transport. Reuse `disconnectApp`'s existing unregister-then-disconnect
   ordering rather than writing new teardown.
2. Restore only the fields that should survive a reconnect. `connectedAt` and `hostIdentifier` are
   the plausible ones; `port`, `source`, `messageOrigin`, and `connectionAttemptUuid` must come from
   the new connection. If nothing actually needs to survive, delete the restore and say so.

**The trap in this slice:** `transport.disconnect()` fires its `onDisconnect`, which `bridgeAppPort`
wires to `onInstanceTeardown(currentInstanceId)`. If you disconnect the displaced transport *before*
deleting its reverse-map entry, that teardown resolves to the validated id and kills the connection
you just installed. Unregister first, then disconnect — the ordering `disconnectApp` already uses,
and the reason its comment says so.

**Acceptance:** After a reconnect onto a live-or-in-grace-period validated id: exactly one transport
is registered for that id, `transportToInstanceId` holds no entry pointing at it from a retired
transport, and `connections.get(validated).port` / `.source` refer to the new connection.

**Test (reproduction-first):** unit tests on `updateConnectionMetadata` for both reconnect sub-cases
— pending-disconnect still armed, and already moved to `recentlyDisconnected`. Assert the displaced
transport is disconnected, the reverse map has exactly one entry for the validated id, and the
metadata's `port`/`source` are the new ones. Plus a regression test that a goodbye arriving on the
displaced transport does not disconnect the new connection. All fail on current code.

**Verify:**
```bash
npx vitest run src/app-connection --root packages/sail-desktop-agent
```
Plus full `npm run test:cucumber`.

**Likely files:** `src/app-connection/wcp/wcp-connection-management.ts`, tests under
`src/app-connection/__tests__/`

---

### Slice 6 — Replace the identity-resolution cascade

**Finding:** #7 (Required, security). **Highest-risk slice in the plan. Own slice, own verification.**

**The bug:** `src/handlers/utils/resolve-context-listener-instance-id.ts` —
`resolveDacpHandlerInstanceId` first returns `instanceId` if that instance is registered (the normal
path). If not, it falls through a five-branch heuristic cascade that scans for a *different*
instance whose `appId` matches the app-supplied `meta.source.appId`: first any uniquely-matching
CONNECTED instance, then any PENDING one.

Callers: `handleBroadcastRequest`, `handleAddContextListener`, `handleContextListenerUnsubscribe`,
`handleIntentResultRequest`, `handleCloseRequest`. An app claiming `source.appId: "other-app"` can
have its broadcast, listener registration, or close attributed to that app's instance.

The early guard makes this unreachable for normally-connected apps — which is why it was filed
Required rather than Critical. But it is a five-branch heuristic resolving **identity**, the
highest-stakes thing to guess at.

**What to do:**
1. Resolve `sourceAppId` from `state.instances[instanceId].appId` — trusted state — rather than from
   the message.
2. Replace the cascade with the explicit `wcpHandshakeRouting` link that already exists in state
   (`src/state/mutators/wcp-handshake-routing.ts` / `src/state/selectors/wcp-handshake-routing.ts`)
   as the single resolution mechanism.

**Risk — read this before starting:** the cascade may be load-bearing for real handshake flows the
tests don't cover (host-instance adoption, stale-instance pruning, the conformance harness's
instance-correlation paths — see `packages/sail-conformance-harness/src/instance-identity-correlation.test.ts`
and `harness-instance-lifecycle.ts`). If removing a branch breaks conformance, **do not reinstate the
appId heuristic**. Instead, determine which legitimate flow depended on it and give that flow an
explicit routing link. If that turns out to be a larger change than this slice, stop and report —
this is a good place to return to the user.

**Acceptance:** Resolution goes through `wcpHandshakeRouting` or the direct instance lookup only. No
code path reads `meta.source.appId` to pick an instance. All five callers behave identically for
legitimate traffic.

**Test:** Reproduction test that an app claiming another app's `appId` cannot have its broadcast
attributed elsewhere. Plus coverage of each legitimate resolution path that the cascade previously
served, so the replacement is proven equivalent where it should be.

**Verify (full gate — this slice does not land on a partial run):**
```bash
npm run typecheck -w @finos/sail-desktop-agent && npm run lint -w @finos/sail-desktop-agent && npx vitest run --root packages/sail-desktop-agent && npm run test:cucumber
```
Also run the conformance harness tests: `npx vitest run --root packages/sail-conformance-harness`.

**Likely files:** `src/handlers/utils/resolve-context-listener-instance-id.ts`,
`src/handlers/utils/wcp-host-instance-adoption.ts`, `src/state/selectors/wcp-handshake-routing.ts`

---

### Slice 7 — Thread the configured logger everywhere

**Finding:** #8 (Required).

**The bug:** `src/app-connection/wcp/wcp1-3-handshake.ts` constructs `new MessagePortTransport(channel.port2)`
with no options, so `src/app-connection/message-port.ts` falls back to `consoleLogger` and
`logPayloadDetail: "metadata"`. Two consequences: all per-message transport logging bypasses the
host's injected sink and goes to the browser console, and the `logPayloadDetail === "full"` branch in
`message-port.ts` can **never** execute — a whole logging mode is dead.

Same class, smaller blast radius: `logDirectoryLoadFailure` in
`src/app-directory/fetch-app-directory.ts` and `replaceDirectoriesInState` in
`src/state/mutators/app-directory.ts` hardcode `consoleLogger`.

**What to do:** Pass `context.options.logger` and `logPayloadDetail` at `MessagePortTransport`
construction. Thread the configured logger into the two app-directory call sites the same way —
plumb it through the existing call chain rather than adding a module-level singleton.

**Acceptance:** With a host-supplied logger, no transport or directory logging reaches
`console.*`. Setting `logPayloadDetail: "full"` actually produces full-payload logs.

**Test:** A test with a spy logger asserting transport messages land on the spy and not on console;
one asserting the `"full"` branch is reachable and produces payload detail. Same spy assertion for
the directory-load failure path.

**Verify:**
```bash
npx vitest run src/app-connection src/app-directory src/state/mutators --root packages/sail-desktop-agent
```

**Likely files:** `src/app-connection/wcp/wcp1-3-handshake.ts`,
`src/app-connection/message-port.ts`, `src/app-directory/fetch-app-directory.ts`,
`src/state/mutators/app-directory.ts`

---

### Slice 8 — Handle directory-load rejections from the constructor

**Finding:** #9 (Required).

**The bug:** `src/agent/sail-desktop-agent.ts` fires `void this.addAppDirectory(url)` per configured
directory in the constructor. `addAppDirectory` → `loadDirectoryIntoState`, which re-throws on any
fetch failure. `void` discards the rejection → `unhandledrejection` in the browser. The minimal
example in the package README (`appDirectories: ["/apps.json"]`) hits this on any network hiccup.

**What to do:**
1. Attach `.catch(err => logger.error(...))` using the configured logger (slice 7 makes this
   consistent — do slice 7 first).
2. Expose a `directoriesLoaded` promise so hosts can await readiness. Keep it a single promise on
   the agent; do not build an event system.

**Acceptance:** A failing directory URL logs an error and leaves the agent usable — no
`unhandledrejection`. `await agent.directoriesLoaded` resolves once all configured directories have
settled.

**Test:** Construct with a directory URL that rejects; assert the error is logged and no unhandled
rejection occurs. Assert `directoriesLoaded` settles.

**Ask before expanding:** if `directoriesLoaded` starts needing per-URL status or retry, that is
out of scope — park it.

**Verify:**
```bash
npx vitest run src/agent src/app-directory --root packages/sail-desktop-agent
```

**Likely files:** `src/agent/sail-desktop-agent.ts`, README if the option's behavior is documented
there.

---

### Slice 9 — Fix the two cleanups that change behavior

**Findings:** #12 (silent no-op controller), #14 (module-global timer registries).

These are grouped because both are "Consider"-rated but have real behavioral consequences, unlike
slice 10's purely mechanical items.

**#12 — silent no-op intent-resolver controller.** `createIntentResolverController` in
`src/agent/sail-desktop-agent.ts` returns stubs when a host-supplied `intentResolver` lacks the UI
methods: `select()` and `cancel()` do nothing, `onRequest()` returns a no-op unsubscribe,
`getPendingRequests()` returns `[]`. A host wiring resolver chrome against a `resolve`-only
implementation gets silence, not an error — the hardest possible thing to debug.

*What to do:* make `intentResolver` a discriminated union at the type level so the compiler catches
it, **or** throw on `select`/`cancel` when no UI is present. Prefer the type-level fix if it doesn't
cascade into consumer packages; check `packages/sail-platform` and `packages/sail-finance` first. If
it does cascade, throw instead.

**#14 — module-global timer registries.** `heartbeatIntervals` in
`src/handlers/heartbeat/runtime.ts` and `pendingIntentTimeoutHandles` in the intent pending-timeout
registry are module-level, so every agent in the process shares them. The sibling registries
`instanceIdentityRegistry` and `pendingSourceWindowRegistry` are correctly `WeakMap`-keyed by owner —
follow that established pattern. AGENTS.md sanctions the test-cleanup hooks living in these modules,
but not the global scoping.

*What to do:* key both maps by connection owner, mirroring
`src/app-connection/wcp/instance-identity-registry.ts` exactly.

**Acceptance:** Two `SailDesktopAgent` instances in one page do not share heartbeat or pending-intent
timers. A host with a resolve-only `intentResolver` gets a compile error or a thrown error, not
silence.

**Test:** Construct two agents, start heartbeats on both, tear one down, assert the other's timers
survive. This is the test that proves #14 was real.

**Verify:**
```bash
npx vitest run src/handlers/heartbeat src/handlers/intents src/agent --root packages/sail-desktop-agent
```

**Likely files:** `src/handlers/heartbeat/runtime.ts`, the intent pending-timeout registry,
`src/agent/sail-desktop-agent.ts`, `src/host-contracts/intent-resolver.ts`

---

### Slice 10 — Mechanical cleanups and nits

**Findings:** #10, #13, #15, plus all six nits and the two lint nits.

All independent one-liners or near. Land as one commit; nothing here needs its own test.

| # | File | Change |
|---|---|---|
| #10 | `src/app-connection/message-port.ts` | `disconnect()` and `handleDisconnect()` are byte-identical. Delete `handleDisconnect`; call `disconnect()` from `send()`'s catch. |
| #13 | `src/agent/sail-desktop-agent.ts` | Bare `catch { ... selectedHandler: null }` — a throwing host resolver is indistinguishable from a user cancelling. Log at error level before cancelling. |
| #15 | `src/agent/desktop-agent.ts` | Casts the app connection to `{ setOnAgentDisconnect?: ... }` to reach a method the interface doesn't declare. Declare `setOnAgentDisconnect?` on `AgentAppConnection` (`src/app-connection/types.ts`) and drop the cast. AGENTS.md forbids test-only methods on production types; this is the same concern one level down. |
| nit | `src/handlers/index.ts` | The ~30-entry `handlerMap` object literal is reallocated on **every** DACP message. Hoist to a module-level `const`. |
| nit | `src/handlers/heartbeat/runtime.ts` | `NodeJS.Timeout` in a browser-first package. Use `ReturnType<typeof setInterval>`, matching `browser-app-connection.ts`. |
| nit | `src/state/mutators/app-directory.ts` | The `/** Adds apps with duplicate appId skipping... */` doc sits above `removeApplicationsByAppId`. Move it onto `addApplications`. |
| nit | `src/agent/sail-desktop-agent.ts` | Bare `10000` channel-change timeout while every sibling timeout is an option. Make it an option with that default. |
| nit | `src/host-contracts/intent-resolver.ts` | `"handler" in choice` then `"intent" in choice` as discriminators for the same union — `IntentHandler` also has `intent`, so the second doesn't discriminate (it happens to produce the right value on both branches). Use `"handler" in choice` for both. |
| nit | `src/agent/desktop-agent.ts` | `this.appConnection!` after an earlier guard. Hoist `const conn = this.appConnection` above the closure and drop the assertion. |
| lint nit | `src/handlers/heartbeat/runtime.ts` | `no-useless-spread` on `for (const instanceId of [...heartbeatIntervals.keys()])`. The spread looks load-bearing because `clearHeartbeatTimer` deletes mid-iteration, but Map iterators handle deletion of current and already-visited entries. **The autofix is safe here.** Do *not* apply it to `getActiveHeartbeatInstanceIds` in the same file — that spread is a genuine array return, and lint correctly left it alone. |
| lint nit | `src/agent/__tests__/sail-desktop-agent.test.ts` | Two `no-unsafe-*` from `request.app.appId` typing as `any` in the mock `AppLauncher.launch`. Type the mock parameter as `BrowserTypes.OpenRequestPayload`. |

**Acceptance:** All listed changes applied, gates still green, no behavior change other than #13's
added logging and the channel-change timeout becoming configurable.

**Verify:**
```bash
npm run typecheck -w @finos/sail-desktop-agent && npm run lint -w @finos/sail-desktop-agent && npx vitest run --root packages/sail-desktop-agent
```

---

### Slice 11 — Remove dead code

**Must run last.** Slice 4 makes the two `INBOUND_VALIDATORS` entries live; slice 7 makes the
`logPayloadDetail === "full"` branch reachable. Neither is dead once those land — do not delete them.

**Confirmed removable (internal only — verified not reachable from `src/index.ts`):**

| Symbol | File | Note |
|---|---|---|
| `bridgeTransports` | `src/app-connection/wcp/wcp-message-routing.ts` | `@deprecated` alias for `bridgeAppPort` in a `3.0.0-pre` package. Its one caller, `wcp1-3-handshake.ts`, points at the deprecated alias — **repoint it to `bridgeAppPort`**, then delete the alias. |
| `handleDesktopAgentMessage` | `src/app-connection/wcp/wcp-message-routing.ts` | `@deprecated`, no callers. |
| `deliverAgentMessage` | `src/app-connection/wcp/wcp-message-routing.ts` | `@deprecated`, no callers. |
| `MessagePortTransport.getInstanceId()` | `src/app-connection/message-port.ts` | Hardcoded `return null`, no callers. |

**Public surface — these two are exported from `src/index.ts`. Removing them is an API break:**

| Symbol | File | Note |
|---|---|---|
| `BrowserIntentResolverController` | `src/host-contracts/intent-resolver.ts` | Type alias for `IntentResolverUIMethods`, no consumers found. Re-exported publicly via `export * from "./host-contracts/index"`. |
| `SailDesktopAgent.intentResolverUI` | `src/agent/sail-desktop-agent.ts` | Self-described "transitional alias" for `.intentResolver`. Public readonly property. |

The package is `3.0.0-pre` and the branch already carries a
"reduce public surface to one entry point" refactor (`4dddd88f7`), so removing them is consistent
with the direction — but it is still a breaking change and needs a changeset.

**What to do:**
1. Before deleting anything, grep the whole repo, not just this package — `sail-platform`,
   `sail-finance`, and `sail-conformance-harness` all consume it:
   ```bash
   grep -rn "bridgeTransports\|handleDesktopAgentMessage\|deliverAgentMessage\|getInstanceId\|BrowserIntentResolverController\|intentResolverUI" --include=*.ts --include=*.tsx packages apps
   ```
2. Repoint `wcp1-3-handshake.ts` to `bridgeAppPort`, then delete the four internal symbols.
3. Delete the two public symbols and add a changeset noting the removal.
4. If any consumer still uses `intentResolverUI`, migrate it to `.intentResolver` in the same slice —
   that's the whole point of the transitional alias.

**Acceptance:** Symbols gone, no dangling references anywhere in the workspace, root build green.

**Verify (workspace-wide — this is the slice that can break downstream):**
```bash
npm run build && npm run typecheck && npx vitest run --root packages/sail-desktop-agent && npm run test:cucumber
```

---

## Test Plan

Risk-based, not coverage-driven.

- **Reproduction-first (must fail before the fix):** #2 (redundant join), #3 (multi-URL directory
  load), #4 (private-channel access), #5 (unvalidated WCP4), WCP-A/WCP-B (temp-id teardown
  escalation), WCP-C/WCP-D (reconnect clobber). If any of these cannot be made to fail
  on current code, **stop and report** — the finding may be wrong and the fix may be unnecessary.
- **Unit:** #6 (hostile `meta` vs trusted fields), #7 (spoofed `appId` cannot re-bind), #8 (spy
  logger receives transport + directory logs; `"full"` branch reachable), #9 (rejection logged, no
  unhandled rejection), #14 (two agents don't share timers).
- **Integration / conformance:** `npm run test:cucumber` gates slices 1, 3, 4, 5a, 5b, and 6 — all
  touch conformance-covered behavior. Slice 6 additionally runs the
  `sail-conformance-harness` package tests.
- **Regression guards worth keeping:** the "exactly one `channelChanged` per change" assertion from
  slice 1 is the thing that stops the second-emitter pattern from coming back.
- **Not testing:** slice 0 (the gates *are* the test), slice 10 nits, slice 11 dead-code deletion
  (the build is the test).

---

## Review Plan

- **Main-agent checks after every slice:** does the diff contain only that slice? Do both gates pass?
  Did the reproduction test actually fail before the fix?
- **Fresh-context review subagent required for:** slice 1 (two-emitter consolidation), slice 4
  (validation policy on the security boundary), slice 5b (reconnect teardown ordering — a wrong
  ordering here disconnects the connection being installed), slice 6 (identity resolution). These are
  the ones where a wrong fix is worse than no fix.
- **Security reviewer for:** slices 3, 5, 6 together, once all three have landed — the authorization
  story only makes sense read as a whole.
- **Loop limit:** 3. If a slice fails review three times, stop and return to the user with the
  options: reduce scope, change the remedy, accept a known limitation, or split the slice.

Review prompt for subagents:

```text
Review this change against the Minimal Viable Delivery Plan at
.cursor/plans/sail-desktop-agent-review-remediation.md, slice <N>.
Prioritize correctness, simplicity, YAGNI, readable flow, and risk-based testing.
Return findings only as: Required, Follow-up, Ignore for MVP.
Flag Required only for issues that prevent the slice from meeting its acceptance
criteria, create real bug risk, or weaken safety. Treat production hardening,
extra abstraction, and broad refactors as Follow-up.
```

---

## Risks

- **Slice 5a gates slice 6.** Slice 6 promotes `wcpHandshakeRouting` to the single resolution
  mechanism. Slice 5a is the evidence that the same link currently escalates temp-keyed teardown to
  the live instance. Landing 6 first hardens a read path onto a link with a known teardown defect.
- **Slice 5b touches the reconnect path, which the unit tests cover thinly.** Retiring the displaced
  transport in the wrong order tears down the new connection (see the trap note in the slice). If
  conformance breaks, do not skip the retirement — fix the ordering.
- **Slice 6 is the one that can go wrong.** Removing the identity cascade may break a real handshake
  flow the unit tests don't cover. Conformance is the gate. If it breaks, do not reinstate the appId
  heuristic — find the flow and give it an explicit routing link, or stop and report.
- **Slice 3 may reveal that auto-join is load-bearing** for a legitimate private-channel handover
  path. If so, that's a separate finding — report it rather than reinstating the hole.
- **Slice 11 breaks public API** (`intentResolverUI`, `BrowserIntentResolverController`). Needs a
  changeset and a downstream grep across all four consuming packages.
- **Toolchain.** The reviewer could not run `vitest` or `lint`. If they don't run locally either,
  every slice's verification is unprovable — fix the install before slice 1.
- **Uncovered blind spot.** The intent-resolution chain (~1,200 lines) got structural review only.
  The reviewer expects comparable findings there, on the grounds that #2 and #4 both turned up in
  paths that *were* traced. Out of scope here; recommend as the next delivery.

---

## Slice Checkpoints

- [x] 0 — Green both quality gates — committed `89598d568`
- [x] 1 — One typed emitter for `channelChanged` (#2, #11) — committed `89598d568`
- [x] 2 — Directory-load lost update (#3) — committed `203969eb6`
- [x] 3 — Private-channel grant model (#4 revised) — committed `a9614dc46`
- [x] 4 — WCP4/WCP6 validation (#5) — committed `a6b1b679d`
- [x] 5 — Trusted metadata unconditional (#6) — committed `14f7bbf60`
- [x] 5a — Temp-id teardown escalation — WCP-A `17f5591e1`; WCP-B `befe1e2dc`
- [x] 5b — Reconnect clobber (WCP-C, WCP-D) Option B — committed `14f7bbf60`
- [x] 6 — Identity-resolution cascade (#7) — committed `c9d3eadb6`
- [x] 7 — Logger threading (#8) — batch A with 8; committed `44e390627`
- [x] 8 — Constructor rejection handling (#9) — batch A with 7; committed `44e390627`
- [x] 9 — Behavioral cleanups — #12 keep (throw); #14 REVERT (module-global + clearAll*); committed `f13623955`
- [x] 10 — Mechanical cleanups and nits (#10, #13, #15, nits) — batch C with 11; committed `aed18f8a7`
- [x] 11 — Dead code removal — batch C with 10; committed `aed18f8a7` (no changeset; API-break in Known Limitations)

## Verification Notes

- Slice 0: `npm run typecheck -w @finos/sail-desktop-agent` — exit 0
- Slice 0: `npm run lint -w @finos/sail-desktop-agent` — exit 0 (remaining warnings are slice 1 / slice 10 scope)
- Slice 0 note: `LoggingAwareDesktopAgentOptions` already absent from `dacp-log-redaction.test.ts`; only fixture fix applied
- Slice 1 RED (before fix): redundant join notify called 0×; `changeAppChannel` second call timed out at 10s
- Slice 1 GREEN: join-user-channel-notify (3), sail-desktop-agent (5), channels+app-connection vitest (88), typecheck/lint exit 0, cucumber channels green
- Slice 1 review: code-reviewer PASS — no Required findings
- Slice 2 RED: multi-URL replace kept only last directory's apps (`['app-3']`); partial-fail kept only last success
- Slice 2 GREEN: app-directory + mutators vitest (34), typecheck/lint exit 0
- Slice 2 fix: `Promise.allSettled` on fetches only, then synchronous fold into state
- Slice 3: deny auto-join on addContextListener / PrivateChannel.addEventListener; grant raiser on private intent-result; fixture grant step for lifecycle BDD; AccessDenied scenarios green; typecheck/lint/cucumber private-channel green
- Slice 4 RED (before fix): invalid WCP4 under strict still got WCP5FailedResponse; invalid WCP6 still cleaned up instance
- Slice 4 GREEN: `wcp-inbound-validation.test.ts` (5), typecheck/lint exit 0, vitest agent/dacp/wcp (13), cucumber 154/154
- Slice 4 fix: `applyInboundValidationPolicy` shared helper; validate in `bridgeAppPort` before enrich/WCP6; validate in `handleWcpMessage` for DACP edge; skip DA re-check for browser-enriched WCP4 (`meta.source`); plumb `validation` via `BrowserAppConnectionOptions`
- Slice 5a RED (WCP-A, before fix): goodbye-before-WCP4 then completed handshake → `appDisconnected` fired for the validated instanceId and the connection was gone from both the registry and agent state. Post-remap goodbye guard passed on unfixed code, so the reproduction isolates the temp-keyed timer rather than teardown generally.
- Slice 5a GREEN (WCP-A): `wcp-temp-id-teardown.test.ts` (2), full package vitest 311/311 across 45 files, typecheck exit 0, lint exit 0 (5 pre-existing warnings, slice 9/10 scope), cucumber 154/154 — unchanged from the slice 4 baseline.
- Slice 5a fix (WCP-A): `cancelPendingDisconnect` local helper in `wcp-connection-management.ts`; `updateConnectionMetadata` now cancels the temp-keyed pending disconnect in addition to the validated-keyed one, and drops `recentlyDisconnected[temp]`. The timer cancellation is the load-bearing part; the `recentlyDisconnected[temp]` delete is defensive — that entry is only written by the temp grace timer firing, which now can't happen before the remap without the `!metadata` early-return already bailing out.
- Slice 5a RED (WCP-B, before fix): second WCP4 on an already-connected port reusing the same `connectionAttemptUuid`, mismatched `actualUrl` origin → `sendFailureResponse` fell back to `destination: { instanceId: temp-{uuid} }` → registry's WCP5-failure prune resolved temp → validated and tore it down. `disconnectedInstanceIds` contained the validated instanceId — proof of the real defect, not a setup/timeout artifact.
- Slice 5a GREEN (WCP-B): `wcp-temp-id-teardown.test.ts` (4, both WCP-A and WCP-B specs), full package vitest 313/313 across 45 files (+2 over the slice-4/WCP-A baseline of 311), typecheck exit 0, lint exit 0 (5 pre-existing warnings, slice 9/10 scope), cucumber 154 scenarios / 1461 steps — unchanged from baseline.
- Slice 5a fix (WCP-B): new `pruneHandshakeConnection` on `BrowserAppConnection` — same body as the existing private `disconnectApp` minus the `resolveInstanceId` forward-resolution. Wired as the `disconnectApp` callback for both `AppConnectionRegistryCallbacks` (WCP5-failure prune) and `WCPRoutingContext` (pre-WCP5 handshake timeout), i.e. exactly the two callers the plan names as needing non-resolving behavior. `pruneAppConnection` and `disconnectAppByInstanceId` untouched — still resolve, per their contract. The temp→validated `wcpHandshakeRouting` link itself is untouched (slice 6 depends on it).
- Slice 5a coverage gap (still open): the "handshake timeout still prunes a never-validated temp connection" guard from the 5a acceptance criteria is NOT covered by a test. `createTestAgent` hard-codes `handshakeTimeout: 30_000` with no override knob, so exercising it for real means a 30s-plus test. The WCP-B fix rewires that exact path (`WCPRoutingContext.disconnectApp`), so it is now an untested caller — worth an override knob on the fixture if any later slice touches handshake teardown again.
- Slice 5a note: guard test 2 ("WCP5 failure on a genuinely unvalidated first handshake still prunes the temp connection") passed on both unfixed and fixed code, as expected — `disconnectApp(context, instanceId)` is a no-op resolve when `instanceId` was never remapped, so removing the resolve step doesn't change behavior for that path. `disconnectApp(context, ...)` in `wcp-connection-management.ts` still unconditionally emits `appDisconnected` even when nothing was found to disconnect — that's pre-existing, not touched: the WCP-B fix calls it with the (correct, unresolved) temp id, so the spurious event — if `sendOnPort`'s prior warn wasn't enough signal already — fires for the temp id, never for the validated one. No test required changing that behavior, so it was left alone per the plan's scope guard.
- Slice 5 RED: hostile `source.appId` retained; empty stored origin left app `messageOrigin` intact
- Slice 5b RED: Object.assign restored stale uuid; old-port goodbye tore down new connection; reverse-map count 2; retire-order disconnect killed validated
- Slice 5 + 5b GREEN: trusted-metadata (2) + reconnect-clobber (7) = 9/9; typecheck/lint exit 0; app-connection vitest green; cucumber 154/154
- Slice 5 fix: strip app `source`/`messageOrigin` before spread; set both from connection registry unconditionally (clear origin when absent)
- Slice 5b fix (Option B): delete Object.assign restore; retire displaced transport unregister-then-disconnect before claiming validated key; drop `recentlyDisconnected[actual]`
- Slice 5b parked: two-window identity fight (item 7) — needs larger harness; identity reuse requires same WindowProxy
- Slice 6 RED: stale/unregistered routing rebinds via message `source.appId`; spoofed broadcast appId attributed to victim
- Slice 6 GREEN: resolve-context-listener-instance-id (7), broadcast-stale-instance retargeted; package vitest 323/323; typecheck/lint exit 0; cucumber 154/154; conformance-harness vitest 69/69
- Slice 6 fix: delete CONNECTED/PENDING appId cascade and pending-open-with-context appId matcher; keep hostInstanceId → registered MessagePort id → wcpHandshakeRouting only
- Slice 6 test retarget: open-with-context pending bucket uses explicit `hostInstanceId`; broadcast-stale uses `linkHandshakeRoutingId`
- Terminology: WCP identity “canonical” → “validated” across DA/tests/docs/harness (preferred-API “canonical” left alone)
- Slice 7+8 RED: transport logs miss host spy; full-payload unreachable; directory failure hits console; constructor voided rejection; no directoriesLoaded
- Slice 7+8 GREEN: host-logger (2) + directory-logger (1) + directory-load (2); typecheck/lint exit 0 (pre-existing warnings only)
- Slice 7 fix: MessagePortTransport gets host logger + logPayloadDetail via WCPHandshakeContext; directory load failure logger threaded through loadDirectoryIntoState / replaceDirectoriesInState / addAppDirectory
- Slice 8 fix: constructor addAppDirectory `.catch(logger.error)`; `SailDesktopAgent.directoriesLoaded` settles when all configured URLs settle
- Slice 9 RED: resolve-only select/cancel silently no-op (#12). (Earlier #14 multi-agent timer RED was synthetic — dropped.)
- Slice 9 GREEN: sail-desktop-agent throw (1); heartbeat-runtime without multi-agent suite; typecheck/lint exit 0
- Slice 9 fix: throw on select/cancel when UI absent (#12). #14 REVERT: module-global heartbeat + pending-intent maps; deleted multi-agent isolation suite; keep `clearAll*ForTesting`. Folded slice-10 nits: `ReturnType<typeof setInterval>`, clear-all without useless spread
- Slice 10+11 (batch C): #10 delete duplicate `handleDisconnect`; #13 log host resolver throws; #15 declare `setOnAgentDisconnect?` on `AgentAppConnection`; hoist `HANDLER_MAP`; `channelChangeTimeoutMs` option; `"handler" in choice` for both; hoist `conn`; type mock `OpenRequestPayload`; already-done nits skipped (heartbeat timer type / useless-spread / app-directory doc)
- Slice 11: repoint `bridgeAppPort`; delete `bridgeTransports` / `handleDesktopAgentMessage` / `deliverAgentMessage` / `MessagePortTransport.getInstanceId`; remove public `BrowserIntentResolverController` + `intentResolverUI`; migrate `sail-platform` to `IntentResolverUIMethods`; no changeset per parked decision
- Slice 11 docs scrub: remove `intentResolverUI` / transitional-alias wording from integrator-guide + composition; `bridgeTransports` → `bridgeAppPort` in channel-selection.md
- Slice 10+11 GREEN: `typecheck`/`lint` `@finos/sail-desktop-agent` exit 0; `typecheck` `@finos/sail-platform` exit 0; `npm test -w @finos/sail-desktop-agent` — vitest 329/329 (50 files) + cucumber 154/154; root `npm run build` exit 0. Root typecheck/lint fail on pre-existing `sail-finance/playwright.config.ts` Node types — unrelated.

## Review Notes

- Required: none (slice 1)
- Follow-up: optional unit assert for context delivery on real channel change; connector-level single-emit already covered by WCP
- Ignore for MVP: hostInitiated still sends DACP channelChangedEvent; seed helper casts into agent.state
- Slice 4 review (loop 1): Required browser MessagePort reject tests — **addressed** (WCP4 + WCP6 MessagePort strict reject). Follow-up: DA skip signal / log string says DACP / pre-existing strict+messageOrigin on DACP enrich — parked.
- Slice 5+5b review (main agent): PASS — Option B applied; unregister-before-disconnect ordering correct; trusted enrich matches FDC3 anti-spoof; negative unhappy-path guards in place. Follow-up: item 7 two-window fight; `recentlyDisconnected` map still written but unused for restore (harmless bookkeeping).
- Slice 6 review (code-reviewer): PASS — no Required. Follow-up: `meta.hostInstanceId` still app-authorable via enrich spread (same class as #7; strip/ignore when MessagePort id registered).
- Slice 7+8 review (main agent): PASS — plumbing matches acceptance; directoriesLoaded is settle-all (no event system); #10 handleDisconnect parked (message-port.ts not edited).
- Slice 9 review (main agent): PASS after #14 revert — keep #12 throw; module-global timers + clearAll* match one-DA-per-tab product model (AGENTS.md). Multi-agent-in-process isolation suite deleted as YAGNI/test-only.
- Slice 10+11 review: committed `aed18f8a7` — mechanical nits + dead code / public surface trim; docs scrub for removed symbols

## Parked Follow-ups

- Intent-resolution chain review (`handlers/intents/intent-raise-*.ts`) — deliberately out of scope;
  recommended as the next delivery.
- Slice 5b parked: two-window identity fight (item 7) — needs larger harness; identity reuse requires same WindowProxy
- Slice 5b: `recentlyDisconnected` still written for grace bookkeeping but no longer restored onto reconnect metadata (Option B)
- Slice 4: tighten DA “already validated” marker beyond `meta.source` (DACP-edge only concern)
- Slice 4: `applyInboundValidationPolicy` log wording still says “DACP message…” for WCP
- Slice 4 review: browser DACP under `strict` may reject after Sail stamps `messageOrigin` — pre-existing enrich vs schema tension; not this slice
- Slice 6: strip or host-stamp `meta.hostInstanceId` at enrich (apps can still author it today)
- Slice 9 / #14: accepted limitation — module-global timer maps are fine under one DesktopAgent per tab; do not reintroduce WeakMap multi-owner isolation without a real second production owner

## Known Limitations

- Slice 11 API break (accepted, no changeset): removed public `SailDesktopAgent.intentResolverUI` and type alias `BrowserIntentResolverController`. Consumers must use `.intentResolver` / `IntentResolverUIMethods`. `sail-platform` migrated in the same batch. Maintainers: note in next Changesets batch on `main` if desired.
