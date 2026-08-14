# Open items carried out of closed plans

**What this is.** A single home for work that was still open inside plans and review documents that
have since been **archived or deleted**. Without this file, removing those would have silently
dropped the items — which `.cursor/plans/archive/README.md` forbids.

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

Every `file:line` below was re-verified against `a6c6b62`/`d49abb8d` on 2026-08-14. Where an archived
plan's claim did not survive that check, the correction is stated inline; the original wording stays
in the archived plan.

---

## 0. CI failures — all FIXED 2026-08-14 (`d49abb8d`, `8d6c2b1b`, `4421a39d`)

Found during the plans prune, tracked here, and fixed the same day. Kept as a record because two of
them had been silently red for weeks and the reasons are worth not re-learning.

### 0a. `docs:build` failed on every run — FIXED

`website/docs/packages/desktop-agent/conformance.md` used HTML comments as the generated-section
markers. HTML comments are invalid in MDX:

> Unexpected character `!` (U+0021) before name … (note: to create a comment in MDX, use `{/* text */}`)

Docusaurus died at that file, so **no page was built and `onBrokenLinks: "throw"` never ran** — the
docs link-checking the config implies was not happening at all. Fixed by changing both markers to
`{/* … */}` in `website/scripts/generate-conformance-inventory.mjs` and the file it writes.

It also surfaced that the generated section itself was **stale** — real tag counts had drifted
(12/11/119 against a documented 10/13/121), so `docs:conformance-inventory:check` was failing too.
Regenerated.

**Still open, now visible:** with the build running, Docusaurus reports two genuine broken anchors —
`intro.md` and `architecture/deployment-targets.md` both link to
`./architecture/overview#two-entry-points`, and no such heading exists. This is defect 2 of the four
in `website-docs-blueprint.md`. It only *warns* because `onBrokenAnchors` is unset (defaults to
`warn`); consider setting it to `throw` once the four doc defects are fixed.

### 0b. Typecheck and ESLint ran before Build — FIXED

`sail-desktop-agent` and `sail-platform` publish types from `dist` (`"types": "./dist/index.d.mts"`)
and `dist` is gitignored, so on a clean runner every consumer failed `TS2307`. Measured with `dist`
removed: `npm run lint` reported **140 errors** and exited 1; `npm run typecheck` exited 2. With
`dist` present, both clean.

Fixed by moving Build ahead of ESLint in `.github/workflows/ci.yml`, and ahead of `lint` in the root
`validate` script, which had the same ordering. Prettier stays first — it is syntactic and cheap.

This is also why `draft-pr-readiness.md` item 9 recorded "typecheck now exits 0": that check ran
against a stale local `dist`, not a clean tree.

### 0c. `test:cucumber` pointed at a script that was never committed — FIXED

Slice 6 of the test-suite realignment wired `test:cucumber:tags` to
`scripts/check-fdc3-tag-coverage.mjs` (`bc7280ca`) and never committed the file, so the package and
root `test:cucumber`, the root `validate`, and **CI's Cucumber step** all failed with
`MODULE_NOT_FOUND`. It hid because every plan's verify command calls `npx cucumber-js` directly,
bypassing the npm script.

Restored the guard as slice 6 specified: an untagged scenario matches no version profile and silently
never runs, so it asserts the cumulative `fdc3-3.0` profile selects the same scenario count as
`default`. Verified both ways — passes at 154/154, and stripping one tag reproduces slice 6's
documented failure exactly (`fdc3-3.0 (153) != default (154)`, exit 1).

**The convention question slice 6 left open is now settled by default:** the guard lives at
`packages/sail-desktop-agent/scripts/`, still the only per-package `scripts/` dir in the repo. Revisit
if a second one appears.

### 0d. Two WCP integration tests failed ~60% of runs — FIXED

`wcp-multi-pending-adoption.integration.test.ts` and
`wcp-desktop-agent.integration.test.ts` each timed out on a MessagePort wait. Measured before the
fix: **3 of 5** combined runs failed; the first file alone failed **8 of 10**.

**This was first mis-called as a contention flake.** It reproduces on an idle machine, which is this
repo's own bar (§1) for a failure that counts. Both turned out to be **test-harness lost-wakeup
races**, not product defects — a raw `addEventListener` alongside the code under test showed the
message arriving on the port on time and in order; the waiter simply was not listening yet.

- `waitForPortMessage` swapped `appPort.onmessage` and restored a `priorHandler`, so it only
  listened from the moment it was called. Anything arriving first went to the installed handler —
  usually `connectWcpApp`'s WCP5 resolver, which resolved unconditionally and was never cleared, and
  re-resolving a settled promise is a silent no-op. Replaced with a **per-port inbox** attached at
  `captureAppMessagePort`, so arrival order no longer matters.
- `broadcastCollector.stop()` ran *before* the `vi.waitFor` that asserted on its contents, removing
  the listener while the event was still in flight. Moved after.

Verified 5/5 in order and 5/5 under `--sequence.shuffle`, where the same commands failed 3/5 before.

### 0e. CI's Build step omitted `sail-one`, and `sail-one` could not build — FIXED

`packages/sail-one/html/` never existed, so `vp build` died on
`globSync("html/**/*.html")` with "You must supply options.input". The cause was `.gitignore`: a bare
`html/` rule, which git matches **at every depth**, so the directory was never committable. The
layout was already declared — `vite.config.ts` sets `mainHtmlPath = "/html/index.html"` and rewrites
`/` to it, and the README names `html/ui/channel-selector.html` by path.

Removed the over-broad rule, added the three entries, and changed CI's Build step to `npm run build`
rather than a hand-maintained package list that had drifted and omitted `sail-one` — the falsely-green
step behind `draft-pr-readiness.md` item 9.

### The one skipped test is deliberate — leave it

`intent-delivery-pending-target.test.ts` asserts the behaviour we **want** for defect-register #3 and
currently fails. It is skipped rather than inverted, because inverting it would bless the
over-permissive `PENDING || CONNECTED` check at `intent-delivery-helpers.ts:77-88` as intended.
`app-connection/__tests__/pending-instance-dacp-gate.test.ts` (passing) guards the ordering that
makes the defect unreachable over the wire. **Un-skip it when slice B fixes #3** — or sooner, if that
guard ever goes red.

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

---

## 8. From the two deleted root review documents

`ARCHITECTURE-REMEDIATION-PLAN.md` (2026-07-30) and `FDC3-SAIL-REVIEW.md` (2026-07-28) were deleted
on 2026-08-14. Both had been overtaken: they were written before the `sail-platform` cull and before
`sail-one` existed, so their central framing — "should `sail-finance` consume `SailPlatform`?", and a
scorecard of a `sail-platform` surface that no longer exists — no longer parses. Most of their live
findings already had better-maintained homes (`draft-pr-readiness.md`, the audit, the defect
register, `sail-platform-extensibility.md`).

`draft-pr-readiness.md` item 7 independently listed both files as working docs that should not ship
to `finos/FDC3-Sail`, which is a second reason to remove rather than keep them.

**These are the findings that existed nowhere else.** Each was re-read in source on 2026-08-14
before being carried across.

### Security

- **FDC3 app iframes render with no `sandbox` attribute.** The highest-value orphan, and the one
  finding here with real security weight. Confirmed by grep: **zero** `sandbox` hits across
  `packages/sail-finance/src` and `packages/sail-one/src`.
  - `sail-finance/src/components/layout-grid/panel-templates/FDC3IframePanel.tsx:66-79`
  - `sail-one/src/grid/grid.tsx:274-285` — **`sail-one` did not exist when the review was written**,
    so the gap was copied into a second shell without ever being recorded.

  Any app in the directory runs with full same-origin-parent privileges. Needs a decision on the
  right `sandbox` token set, since FDC3 apps legitimately need scripts and same-origin messaging —
  this is not a one-word fix, which is presumably why it stalled.

- **WCP5 outbound remap trusts an app-supplied `instanceId` with no format guard.**
  `app-connection/app-connection-registry.ts:103` —
  `if (actualInstanceId && appId && destinationId !== actualInstanceId)` takes `actualInstanceId`
  straight from `message.payload.instanceId` and rewrites the connection's metadata and routing.
  Nothing rejects a `temp-`-prefixed or otherwise malformed value. Related in spirit to the
  `connectionAttemptUuid` hardening in §1 and to defect-register #9 — same "trust an id off the
  wire" class. Worth fixing in the same pass.

### Correctness and hygiene

- **Handshake-failure events are asymmetric.** The WCP4 *timeout* path emits `handshakeFailed`
  (`app-connection/wcp/wcp1-3-handshake.ts:115`), but the WCP5 *rejection* path
  (`app-connection/wcp/wcp-identity-validation.ts:370-393`) sends the failure response and returns
  without emitting anything. A host watching `handshakeFailed` sees timeouts but is blind to
  rejections. Small and well-specified — the best candidate here to just do.

- **`closeRequest` has no inbound validator.** It is absent from `INBOUND_VALIDATORS`
  (`dacp/validate-dacp-message.ts:61-93`) while its sibling request types are covered. *(The other
  half of this finding — the ownership check — is genuinely fixed; `handleCloseRequest` uses only
  the port-derived `params.instanceId`, and `resolve-context-listener-instance-id.ts:11-18` records
  that the `meta.hostInstanceId` tier was removed.)*

- **Listener ids reuse `requestUuid` instead of a fresh uuid.** Two sites:
  `handlers/broadcast/handlers.ts:210` and `handlers/events/handlers.ts:56`, both
  `const listenerId = message.meta.requestUuid`. Hygiene rather than a live bug — it conflates "the
  request that created this listener" with "this listener".

- **Timeouts are not consolidated onto one config.** `dacp/dacp-constants.ts:15-17` hardcodes
  10000 / 100000 / 15000, while `handshakeTimeout`, `disconnectGracePeriod` and
  `intentResolutionTimeout` live in a separate optional bag (`app-connection/wcp/wcp-types.ts:119,126,132`)
  rather than in `DesktopAgentConfig`. The WCP3 handshake payload still advertises only three fields
  (`wcp1-3-handshake.ts:95-99`), so an app cannot discover the timeouts it is being held to. Only one
  of these (`channelChangeTimeoutMs`) is noted anywhere else, in the audit.

- **immer usage is not uniform.** `state/mutators/app-directory.ts` and
  `state/mutators/wcp-handshake-routing.ts` do not use `produce`; `setAutoFreeze` is never called
  (zero hits in `src`); and `app-connection/wcp/wcp-connection-management.ts:232` mutates
  `AppConnectionMetadata` in place (`metadata.instanceId = actualInstanceId`). Distinct from the
  audit's immer finding, which is about a redundant double-guard in `private-channel.ts`.

- **Two byte-identical Playwright specs.** `packages/sail-finance/tests/e2e/example.spec.ts` and
  `packages/sail-finance/tests/example.spec.ts` — same md5 (`c0a86308…`). Delete one.

### Repo hygiene

- **`SECURITY.md` is boilerplate and routes reports to a public GitHub issue.** It also still claims
  support for version `0.0.1`. Both wrong for a project about to be offered upstream.
- **`AGENTS.md` still names `v3-pre` as the integration branch** (`AGENTS.md:73`, hedged again at
  `:110`), which has not been true for some time.

### Deliberately not carried

The rest of both documents was **superseded, not merely duplicated**, and was dropped:
their `SailPlatform` composition analysis (D1–D3, W1, W2 — reversed and documented in
`sail-platform-extensibility.md`), the docs rebuild (W13 — done, tracked in `website-docs-blueprint.md`),
`ChannelControl` (W3 — `sail-desktop-agent-feature-decisions.md` §1), the identity-store and
`recentlyDisconnected` items (W7–W9 — reframed in the audit §5.7/§10), BLOCK-B/BLOCK-C/NEW-2/NEW-3/
C-3/C-6 and the `debug: true` default (all verified **fixed**), and both scorecards (numbers now
wrong: 6 packages not 5, 60 Vitest files not 42, 154 scenarios not 152).
