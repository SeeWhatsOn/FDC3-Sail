# Open items carried out of closed plans

**What this is.** A single home for work that was still open inside plans that have since been
**archived**. Without this file, archiving those plans would have silently dropped the items — which
`.cursor/plans/archive/README.md` forbids.

**What this is *not*.** It is not a copy of every open item in the repo. Work that lives in a plan
that is still **live** stays there and is only pointed at from here. One home per item; nothing below
is duplicated from a live plan.

Where the live work lives:

| Area | Live plan |
|---|---|
| DA defects #3–#10 (intent routing, WCP lifecycle) | `sail-da-defect-register-2026-08-11.md` |
| DA cleanup park list (28 catch-blocks, 3 identity stores, `TEdge`, `initialState`, …) | `sail-desktop-agent-audit-2026-08.md` §10 |
| `ChannelControl` — keep or delete | `sail-desktop-agent-feature-decisions.md` §1 |
| Docs: snippet CI + 4 open doc defects | `website-docs-blueprint.md` |
| Observability seam | `agent-observability-seam.md` |
| Draft-PR blockers | `draft-pr-readiness.md` |

Every `file:line` below was re-verified against `a6c6b62` on 2026-08-14. Where an archived plan's
claim did not survive that check, the correction is stated inline; the original wording stays in the
archived plan.

---

## 0. Broken now — `npm run validate` and `npm run test:cucumber` fail

**This is not a follow-up. It is a live break, and it is in no plan's tracking.**

`packages/sail-desktop-agent/package.json:27` wires
`"test:cucumber:tags": "node scripts/check-fdc3-tag-coverage.mjs"`, and that script **has never
existed in git** (`git log --all -- '**/check-fdc3-tag-coverage.mjs'` is empty; there is no
`packages/sail-desktop-agent/scripts/` directory at all). It was added by slice 6 of the test-suite
realignment (`bc7280ca`) and the file was never committed.

The failure propagates all the way up:

- `packages/sail-desktop-agent` → `test:cucumber` (`:26`) and `validate` (`:34`) both invoke it
- root `test:cucumber` (`package.json:27`) delegates to the package script
- root `validate` (`package.json:34`) runs root `test:cucumber`

Reproduced 2026-08-14: `npm run test:cucumber:tags -w @finos/sail-desktop-agent` exits non-zero with
`MODULE_NOT_FOUND`.

It went unnoticed because every plan's verify command calls **`npx cucumber-js` directly**, which
bypasses the npm script entirely. That is also the workaround until it is fixed.

**Decide:** write the tag-coverage checker slice 6 intended, or drop `test:cucumber:tags` from both
scripts. Do not leave it as-is.

---

## 1. From `archive/dacp-handler-deps-refactor.md`

### Still open

- **Two `connectionAttemptUuid` hardening items.** Validate that `connectionAttemptUuid` is
  UUID-shaped and reject one colliding with a live link (~3 lines,
  `app-connection/wcp/wcp1-3-handshake.ts:46,55` — still used verbatim, no format check); and add
  `clearHandshakeRoutingId(state, routingId)` so links can be cleared by key
  (`state/mutators/wcp-handshake-routing.ts` has only the clear-by-value
  `clearHandshakeRoutingIdsForInstance`). **Highest-value hardening item here.** Same root cause as
  defect-register **#9** (duplicate WCP1 reusing a `connectionAttemptUuid` leaks a port and stacks
  timeouts). Different symptom, same bug class — **fix them together.**
- **Host-controller `changeAppChannel` silently no-ops and reports success.**
  `state/mutators/instance.ts:70-81` (`joinUserChannel`) no-ops when the `instanceId` is not
  registered, and `handlers/channels/handlers.ts:94-130` sends a success response unconditionally
  regardless. The host path never resolves the id first
  (`agent/sail-desktop-agent-controllers.ts:167-177`). A host gets "OK" for a channel change that did
  not happen.
- **`schedulePendingIntentDelivery`'s two adjacent positional booleans** are a transposition hazard —
  `intent-raise-shared.ts:133-139`, `(targetInstanceIsLaunched: boolean, explicitTargetInstanceId =
  false)`. One-file fix; the single item that survived cutting slice 4.
- **`registerPendingIntentTimeout` can silently overwrite a live handle.**
  `intents/intent-pending-timeout-registry.ts:30-38` stores by `(requestId, kind)` with no
  clear-before-set. Unreachable today — each kind is registered once per request — so this is a
  ~2-line guard against a future third call site.
- **`createHandlerParams` allocates ~17 fields, closures and a fresh dispatcher per inbound message**
  when only `instanceId` varies (`agent/sail-desktop-agent.ts:398-423`). **Parked deliberately, not
  forgotten** — not a performance problem at DACP message rates.
- **A flaky unit test exists but is unidentified.** One run at `1d0b4d5c7` failed 1 of 373; two
  immediate re-runs passed on the same commit, and that run reported `environment 288.67s` against a
  normal ~31s while `tsc --noEmit` ran concurrently. **Working rule: a single failure does not count
  until it reproduces on an otherwise-quiet machine. Do not run Vitest alongside other heavy
  commands.**

### Corrected — do not carry these forward as written

- **~~"The real defect is lifetime, not width" — `startHeartbeat`'s captured `instanceId` stays the
  WCP4 `temp-…` id forever.~~** The **identity half does not reproduce.** Checked independently three
  times on 2026-08-14. `startHeartbeat(instanceId, params)` (`handlers/heartbeat/handlers.ts:21`)
  takes the **validated** id as an explicit parameter, and every long-lived closure — `sendHeartbeat`,
  `onTimeout`, and the `setInterval` body — reads *that* parameter, not `params.instanceId`. The
  caller passes the resolved id (`wcp-identity-validation.ts:289`). Where the whole bundle survives
  into the callback, `teardownInstance(params, instanceId)` overrides the id
  (`instance-teardown.ts:158-163`), and `resolveTeardownInstanceId` (`:23-44`) additionally resolves a
  `temp-` id through the handshake-routing link. A regression test already pins it:
  `handlers/__tests__/heartbeat-runtime.test.ts:77` — *"keys heartbeat timers by the instanceId passed
  to startHeartbeat, not the handler params id"*.

  **What survives:** the *structural* capture is real — a `setInterval` living for the instance's
  whole life holds a request-scoped `params` bundle whose `instanceId` field is stale. Nothing reads
  it for identity today, so it is a **latent hazard, not a live defect**: the next person to reach for
  `params.instanceId` inside one of those closures introduces the bug. Worth a comment at the capture
  site. It is **not** the "highest-value next piece of work" the archived plan called it.
- **~~`getHandlerForMessageType` is a per-message closure, contradicting its own comment.~~**
  **Resolved incidentally** by `98716f08` — `HANDLER_MAP` and its lookup `getHandlerFor` are back at
  module scope (`handlers/index.ts:186,233`).
- **~~Root `tsconfig.json` references a non-existent `packages/sail-ui` (`TS6053`).~~** **Fixed** by
  `87b68517b`; root `tsconfig.json` now references only `sail-desktop-agent`, `sail-platform` and
  `sail-finance`.
- **~~`sail-finance/vite.config.ts` fails on a missing `@tailwindcss/vite`.~~** Not a code defect —
  it **is** declared (`packages/sail-finance/package.json:28`). The archived plan hit this in a
  worktree where `npm install` had not run. Environment, not source.

---

## 2. From `archive/typescript-strictness-rollout.md`

- **No retained `CLOSED` instance state — a spec SHOULD that Sail does not meet.** FDC3's
  `browserResidentDesktopAgents.md` ("Disconnects") requires DAs to track close/navigate for accurate
  `findInstances` / `findIntent` / `findIntentsByContext`, and says instance details SHOULD be
  retained after close, because navigation is indistinguishable from a close.
  `removeInstance` (`state/mutators/instance.ts:62-68`) deletes the key instead, so a navigating app
  vanishes from `findInstances` and returns under a new `instanceId`. `AppInstanceState`
  (`state/types.ts:28-31`) still has only `PENDING` / `CONNECTED`.

  Fix is a third `AppInstanceState` member plus selector filtering — **not** dropping the delete,
  since `TargetInstanceUnavailable` depends on `getInstance` returning `undefined`. **Needs its own
  plan.**

  **Cheaper than it was:** the predicate extraction landed (`8894d29fc`), so the tautology this makes
  load-bearing now lives in one place — `isInstanceReceivable` (`state/selectors/instance.ts`) —
  instead of four call-site copies. Two things to handle when it ships: `isLaunchTargetReady` needs
  the same treatment (its `PENDING && is-the-launcher` clause must not accept a closed launcher), and
  the `intent-delivery-helpers.ts:77-88` gate must exclude `CLOSED`.
- **`intent-delivery-helpers.ts:77` gates delivery on the wrong axis.** FDC3 ties delivery to
  listener registration (`IntentDeliveryFailed` = "has not added an intent handler within a
  timeout"), not to connection state, and `isIntentListenerReady` already exists at `:34`.
  **Investigated 2026-08-14; verdict: a real internal defect but unreachable over the wire, so no
  production change was made.** Open as a **product decision**, not as a bug fix.
- **`conformance-app-directory.ts:78` casts parsed JSON with `as DirectoryApp[]`, unvalidated.**
- **A transport-logging flake** (`wcp-host-logger-threading.test.ts`) with a known cause and no
  attempted fix.
- **`website/` has never been measured** under `noUncheckedIndexedAccess` — `website/tsconfig.json`
  extends `@docusaurus/tsconfig`, not `tsconfig.root.json`.
- **Other type-aware lint rules** were never evaluated.

---

## 3. From `archive/sail-da-test-suite-realignment.md`

*(Its worst leftover is §0 above — the missing tag-coverage script.)*

**Needs a product decision:**

- **`intentResultRequest.payload.intentResult` as `null` / `{error}`.** Sail's invented vocabulary
  for "no result" / "handler rejected". FDC3 2.2's `IntentResult` is `{context?, channel?}` with
  `additionalProperties: false`. Same class as the `ListenerNotFound` codes slice 1 retired.
  **This is the real blocker for `validation: "strict"` ever being recommendable** — and note slice 5
  concluded `warn` must stay the default, because a schema gate pre-empts the handlers that produce
  FDC3's own specific errors (`MalformedContext`, `InvalidArguments`, `NoChannelFound`) and returns a
  generic `MalformedMessage` instead. **Do not silently reverse that.**
- **A `scripts/` directory convention** — see the archived plan's slice 6 outcome. Now doubly
  relevant, since the one script that convention was about is the missing file in §0.

**Mechanical, no decision needed:**

- The "Dynamic registrations" step definitions send `contextType`, putting a 3.0 field into 2.x
  scenarios (2 scenarios).
- **Dead step definitions** (`disconnect.steps.ts`, `generic.steps.ts:227-327`,
  `start-app.steps.ts:208-240`) and **unused `matchData`** (`test/support/testing-utils.ts:254`,
  still exported, still unused).
- **`raise-intent.feature:45-49` — half done.** It was retagged `@fdc3_3.0` (line 44), so the "retag"
  option was taken; the "or delete" half was never decided, and it remains a near-duplicate of
  `intent-context-metadata.feature:15`.
- **`intent-metadata-performance.feature` untag** — still open. The file carries `@performance` at
  line 1 and `@fdc3_3.0` on the scenarios at lines 11 and 17.
- `vi.useFakeTimers()` is latent in files beyond the two that were fixed. *(Unverified — needs a
  behavioural audit, not a grep.)*
- `events/handlers.ts` accepts `undefined` as subscribe-to-all though the union is
  `'USER_CHANNEL_CHANGED' | null`. **Partly addressed:** the site now carries an explicit rationale
  and an `oxlint-disable` naming it ("parsed from an inbound DACP message; the schema type is an
  assumption about a well-behaved peer, not a guarantee"). Behaviour unchanged. Decide whether that
  closes it or whether the union should widen to match.

---

## 4. From `archive/sail-desktop-agent-review-remediation.md`

- **Slice 5a coverage gap.** Handshake-timeout pruning of a never-validated temp connection is
  untested, because `createTestAgent` hard-codes `handshakeTimeout: 30_000` and `TestAgentOptions`
  (`wcp-desktop-agent.integration.fixtures.ts:23-33`) exposes no override. The gap is still flagged
  in code: `app-connection/__tests__/wcp-temp-id-teardown.test.ts:128-133` carries a
  `KNOWN COVERAGE GAP` comment. Adding an override knob is the whole fix.
- **Slice 5b — the two-window identity fight** was never addressed; it needs a larger harness.
- **Slice 4 — `applyInboundValidationPolicy` log wording** still says "DACP message…" on the WCP path
  (`dacp/validate-dacp-message.ts:140,144`). Cosmetic but misleading in logs.
- **Slice 3 follow-up — no real create→intent-result→listen Vitest test** for private channels; no
  test file exists under `src/handlers/private-channels/__tests__/`.

**Honour this decision, do not re-litigate it:** module-global timer maps stay (one DA per tab, per
`AGENTS.md`). Do not reintroduce WeakMap owner-keying — slice 9 reverted exactly that as YAGNI.

---

## 5. From `archive/sail-desktop-agent-surface-reduction.md`

- Its one open item — *"38 of 458 Cucumber messages fail schema validation, worth a follow-up"* — is
  **effectively closed**. The specific example it cited (`broadcastRequest` with `channelId: null`) is
  resolved: `channelId: null` no longer appears in any step definition, fixed as "Out-of-plan fix #5"
  of the test-suite realignment, which ruled it a product bug and made `channelId` required. The
  broader triage was continued and closed by that plan's slice 5. Nothing to carry.

---

## 6. From `archive/reusable-browser-host-kit.md`

- **Slice B — the FINOS toolbox host profile** is genuinely parked, with no trigger until toolbox
  scores are needed again: `forceNewWindow` popups, `closeWindow` → `windowClosed` relay, auto intent
  resolve, channel selector disabled, heartbeat off. This content is **not** duplicated in
  `website/docs` — the only other place it exists is working code in
  `packages/sail-conformance-harness/`. `sail-finance` still lacks the B kit; harness-green plus
  sail-finance-toolbox-red is usually that gap, not a DA defect. Operational detail is in `AGENTS.md`.
- **Slice A is done, and the website now documents it better than the plan did** —
  `getting-started.md:76-98,133`, `packages/desktop-agent/overview.md:22,61-71`, and
  `packages/desktop-agent/integrator-guide.md:191-234,308-363` cover constructing `SailDesktopAgent`,
  implementing `AppLauncher`, the `iframe.name` = `instanceId` rule, and disconnect-on-close.
- **Two facts recorded nowhere else**, preserved here: `packages/sail-platform/src/browser-host/` was
  deleted, and the conformance harness's dependency on `sail-platform` was removed.

---

## 7. From `archive/sail-desktop-agent-class-collapse.md` and `archive/mvd-sail-da-slice-a.md`

Nothing open. Both were verified fully landed and committed, and both carried a stale
"uncommitted" note that was false at archive time — corrected in their ARCHIVED headers.
