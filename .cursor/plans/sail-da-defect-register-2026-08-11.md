# Defect register: sail-desktop-agent, dual-agent review 2026-08-11

Status: **findings ratified, no fixes started**
Current slice: none. Nothing here has been implemented.

## Provenance

Two agents reviewed `packages/sail-desktop-agent` from an **identical brief**, in parallel, read-only:

- **Sonnet 5** — native subagent. 6 min 35 s, 45 tool calls, 178 k tokens. Returned 3 findings + 1 note.
- **Grok 4.5** (`cursor-grok-4.5-high`, via `cursor-agent --mode plan`) — 15 min 05 s. Returned 8 findings.

Brief: top 8 findings, ranked by severity, each with file:line, mechanism, and a concrete failure
scenario. Explicitly excluded formatting, naming, test-coverage gaps, and speculative abstraction.

**The two agents produced ten distinct findings and agreed on exactly one** (#1 below). Every claim
checked was accurate — this is not one model being wrong, it is two competent reviewers sampling
different parts of the package and both stopping early. A single review pass, from either model,
leaves most of the findings on the table.

## How these were ratified

Each claim was checked by **reading the cited source**, not by trusting either report. Nine of ten
are confirmed exactly as described. One (#8) is confirmed as a mechanism only.

**What ratification does not cover:** no tests were written or run, and nothing was reproduced at
runtime. "The guard is absent" is proven by reading. "Therefore the bad outcome occurs" remains a
short inference for every item except #8, where it is a long one.

One upstream check was run specifically to try to *invalidate* #2, the highest-value finding:
`handlers/index.ts:209,231` route straight to the handlers, `dacp/validate-dacp-message.ts:68,79`
validate message shape only, and neither handler is among the five `resolveDacpHandlerInstanceId`
call sites. **No ownership gate exists anywhere on that path.** The finding survived.

## Findings

### 1. Pending intents never settle on the wire — `getResult()` hangs forever

- **Severity:** critical. **Found by both agents**, independently ranked top-two by each.
- **Where:** `handlers/intents/intent-raise-shared.ts:121-131`, `:163-177`; `handlers/cleanup.ts:85-96`
- **Mechanism:** `registerPendingIntentPromise` stores `resolve: () => {}` / `reject: () => {}` and
  nothing ever overwrites them — `pendingIntentPromises.set(...)` has exactly one production call
  site. The timeout at `:163-177` deletes the map entry and calls `resolvePendingIntent` on state but
  sends no DACP response. `cleanup.ts:92` calls `promiseData.reject(...)` — the no-op — then `:95`
  clears state, again with no wire response.
- **Failure:** App B is targeted by `raiseIntent`, receives the intent, then crashes or hangs before
  returning a result. After `pendingIntentTimeoutMs` the intent vanishes from state with zero traffic
  to App A, whose `IntentResolution.getResult()` promise never settles. Identical outcome if B
  disconnects while the intent is pending. Affects `raiseIntent` and `raiseIntentForContext`.
- **Contrast:** `handlers/utils/open-with-context.ts` sends `OpenError.AppTimeout` on both the
  timeout and the disconnect path, and `intent-delivery-helpers.ts:156-180` sends
  `ResolveError.IntentDeliveryFailed`. This is the one path that notifies nobody.

### 2. Cross-instance unsubscribe — one app can silently kill another's listeners

- **Severity:** critical. Found by Grok only.
- **Where:** `handlers/events/handlers.ts:107-115`; `handlers/intents/intent-listener-handlers.ts:130-135`
- **Mechanism:** Both handlers look the listener up by `listenerUUID` and check only that it exists.
  Neither compares `listener.instanceId` against the calling `instanceId` from context. The caller's
  id is port-derived and trustworthy; it is simply never used as an authorisation check.
- **Failure:** App B sends `eventListenerUnsubscribeRequest` (or the intent equivalent) carrying App
  A's `listenerUUID`. A silently stops receiving channel-changed or intent events, with no error on
  either side.
- **This is a second instance of an already-closed bug class.** The `meta.hostInstanceId` fix
  (`sail-da-defect-fixes.md` slice 1) closed exactly this for the five `resolveDacpHandlerInstanceId`
  callers — broadcast, context listener, unsubscribe, intentResult, close. These two handlers were
  never in that set. `sail-desktop-agent-audit-2026-08.md:422` explicitly warned the exposed surface
  was "**not every DACP call**"; nobody swept the rest.

### 3. Intent delivery retargets away from the explicitly chosen instance

- **Severity:** major. Found by Grok only.
- **Where:** `handlers/intents/intent-delivery-helpers.ts:195-216`
- **Mechanism:** While waiting for a listener, `deliverPendingIntentsForListener` selects pending
  intents by `targetAppId` + `intentName` only, then `:205-214` rewrites `targetInstanceId` to
  whichever instance just registered.
- **Failure:** `raiseIntent(..., { appId: "X", instanceId: "A" })` while A has no listener yet.
  Instance B of the same app calls `addIntentListener` first, and both the intent and the resolution
  source go to B. Same race when the DA launches a new instance and an older same-app instance
  registers during launch.

### 4. WCP6 grace timer survives `disconnectInstance` / `pruneAppConnection`

- **Severity:** major. Found by Grok only.
- **Where:** `app-connection/wcp/wcp-connection-management.ts:171-183` (`disconnectApp`); the cancel
  lives only in `disconnectAppByInstanceId` at `:133-137`
- **Mechanism:** Teardown via `sail-desktop-agent.ts:518-521` → `pruneAppConnection` → `disconnectApp`
  never clears `pendingDisconnects`.
- **Failure:** A false-positive WCP6 arms the grace timer, the host tears the instance down, the same
  `instanceId` is relaunched inside the grace window, and the stale timer fires `onInstanceTeardown`
  on the new session.
- **Adjacent prior work:** `sail-desktop-agent-review-remediation.md:335-348` fixed
  `pendingDisconnects[tempInstanceId]` in `updateConnectionMetadata` — a different path. Same class,
  second instance.

### 5. Orphaned `PendingIntent` when delivery throws mid-flight

- **Severity:** major. Found by Sonnet only.
- **Where:** `handlers/intents/intent-raise-shared.ts:179-188` (`cleanupPendingIntentRequest`),
  called from `intent-raise-intent.ts:222` and `intent-raise-intent-for-context.ts:289`
- **Mechanism:** The cleanup clears the promise-map entry and its timeout handles but never calls
  `resolvePendingIntent(state, requestId)`. If a throw lands after `registerPendingIntentState` but
  before `attachPendingIntentTimeout`, the entry stays in `state.intents.pending` with no timer ever
  armed to collect it.
- **Failure:** `postMessage` throws during immediate delivery (non-cloneable payload, or the port
  closed a tick earlier). The client correctly receives a terminal error, but the pending entry
  survives and can later be resurrected and redelivered by `deliverPendingIntentsForListener`.

### 6. Intent resolver offers the raising app as a handler for its own intent

- **Severity:** major. Found by Sonnet only.
- **Where:** `handlers/intents/intent-resolver-helpers.ts:93-143` vs `intent-helpers.ts:166-171`
- **Mechanism:** `findIntentHandlers` filters the source instance out of running listeners.
  `createResolverAppIntent` is an independent query with no `source` parameter at all, and `:135-143`
  pushes every connected instance of each directory match.
- **Failure:** App A raises an intent that two apps can handle, one being A itself. The
  single-candidate fast path would exclude A; because there are two candidates the resolver path runs
  instead and lists A as a selectable handler for its own intent.

### 7. `stop()` tears down ports but not `AgentState` or heartbeats

- **Severity:** major. Found by Grok only.
- **Where:** `agent/sail-desktop-agent.ts:293-300`
- **Mechanism:** `stop()` calls `this.appConnection.stop()` and sets `isStarted = false`. It never
  calls `disconnectInstance` / `cleanupDACPHandlers`, so no state, listener, pending intent or
  heartbeat interval is torn down.
- **Failure:** Host calls `stop()` then `start()`. Ghost CONNECTED instances, live listeners, pending
  intents and running heartbeat intervals all persist against dead ports.

### 8. Unserialized concurrent `setState` on async inbound DACP

- **Severity:** unproven — see caveat. Found by Grok only.
- **Where:** `agent/sail-desktop-agent.ts:283-284` (`void this.handleMessage(message)`), `:431-433`
  (`this.state = callback(this.state)`)
- **Mechanism confirmed:** inbound messages are fire-and-forget async with no queue, and `setState`
  is a plain read-modify-write with no serialization.
- **Not confirmed:** no specific handler was traced that reads state, awaits, then writes — which is
  what an actual lost update requires. **Do not fix this until a concrete interleaving is
  demonstrated.** Treat as a hypothesis, not a defect.
- **Adjacent prior work:** `sail-desktop-agent-review-remediation.md:193` — "Slice 2: fix the
  concurrent directory-load lost update". Same class, fixed in one location only.

### 9. Duplicate WCP1 with the same `connectionAttemptUuid` leaks a port and stacks timeouts

- **Severity:** major. Found by Grok only.
- **Where:** `app-connection/wcp/wcp1-3-handshake.ts:55`, `:84-86`, `:108-117`
- **Mechanism:** the registry key is `temp-${connectionAttemptUuid}`. A second Hello with the same
  uuid overwrites `connections`, `messagePortTransports` and `transportToInstanceId` at `:84-86`
  without calling `disconnect()` on the previous `MessagePortTransport`, and arms a second timeout at
  `:108` without cancelling the first.
- **Failure:** double Hello or a client retry leaves two live ports for the same key, and the older
  timeout can fire `disconnectApp` on the newer attempt while it is still `appId === "unknown"`.
- **Adjacent prior work:** `sail-desktop-agent-review-remediation.md:794` (slice 5a) covers a
  duplicate **WCP4** reusing the same uuid. WCP1 was not covered. Same class, second instance.

### 10. `contextSequence` is module-level, shared across agents in one process

- **Severity:** minor. Found by Sonnet only. **Already known.**
- **Where:** `state/mutators/channel.ts:11`
- **Already recorded** at `sail-desktop-agent-audit-2026-08.md:318`, which names the exact file and
  line. No action needed beyond noting that a fresh review rediscovered it.

## Cross-reference against existing plans

| Finding | Existing plan coverage |
|---|---|
| #1 pending intent | **None.** `audit:387` mentions `pendingIntentPromises` only as an accepted *serializability* limitation — not this defect |
| #2 cross-instance unsubscribe | Class closed for 5 other handlers (`sail-da-defect-fixes.md` slice 1); these two never covered. `audit:422` flagged the gap |
| #3 retargeting | **None** |
| #4 WCP6 timer | Adjacent — `review-remediation.md:335-348`, different path |
| #5 orphaned PendingIntent | **None** |
| #6 resolver self-target | **None** |
| #7 `stop()` | **None** |
| #8 concurrent `setState` | Adjacent — `review-remediation.md:193`, one location |
| #9 duplicate WCP1 | Adjacent — `review-remediation.md:794` covers WCP4 |
| #10 `contextSequence` | **Already recorded** — `audit:318` |

**The meta-finding is more valuable than any single defect: three of these (#2, #4, #9) are second
instances of bug classes this repo has already fixed once.** The working pattern has been
fix-the-reported-site rather than sweep-the-class. Any future fix pass on this package should grep
for siblings of the defect being fixed before closing the slice.

**Why the test suite did not catch #4, #7 and #9:** `sail-desktop-agent-audit-2026-08.md:107` already
records that the BDD edge no-ops `setOnInstanceTeardown` and `pruneAppConnection`, so "any
`AppConnectionRegistry` MessagePort leak is **structurally invisible to BDD**". The blind spot was
documented; nobody had looked inside it manually until now.

## Recommended slicing

Not started. Suggested order when this is picked up:

1. **Slice A — #1 and #2.** Both fully verified, both small. #1 is an FDC3 conformance failure; #2 is
   a two-line ownership check per file in a class already fixed elsewhere, so the shape of the fix is
   settled. Needs a Prove-It test each: a hanging `getResult()` that starts passing, and an
   attacker-instance unsubscribe that starts failing.
2. **Slice B — #3, #5, #6.** Intent-routing correctness. One coherent area.
3. **Slice C — #4, #7, #9.** WCP and agent lifecycle. Needs real integration tests first; BDD cannot
   see any of it.
4. **#8** — do not schedule until an interleaving is demonstrated.
5. **#10** — already known, lowest value, fold into any slice touching `state/mutators`.

## Known limitations of this register

- **Nothing here was reproduced at runtime.** All ratification was source reading.
- Both agents were run once each. Neither result is a measurement.
- Grok's remaining reasoning is not recoverable — `--mode plan` returned findings only, and the run
  shares no context with the repo's other tooling.
- Coverage is a **sample, not a sweep**. Both agents were briefed to prioritise breadth over depth
  and to cap at 8 findings. The 1-in-10 overlap strongly suggests more defects remain unfound.
