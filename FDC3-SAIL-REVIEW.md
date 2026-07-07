# FDC3 Sail Production Readiness Review

*Review date: 2026-07-06 · Branch:* `chore/collapse-browser-app-connection-into-desktop-agent` *(descends from* `v3-pre`*) · Reviewer: evidence-based architecture/security/conformance pass.*

> Scope note: this is a diagnosis-only review. No implementation code was changed. Findings are grounded in source, docs, the committed conformance exports, CI config, and package manifests, with file paths cited throughout.

---

## Executive Summary

**Overall verdict: a genuinely well-architected prototype in late-beta — not production-ready today, and its own documentation over-claims that it is.**

FDC3 Sail has a clean, deliberate core: a transport-agnostic FDC3 Desktop Agent with a well-guarded WCP identity-validation boundary, a curated public API, strong unit/BDD coverage on the agent itself, and real release/security tooling (Changesets, CodeQL, Scorecard, Semgrep, CVE scanning). The two-layer separation (pure agent ⟂ deployment) is the right architecture and is largely honored in code.

But it is not shippable as a production interop platform in its current state, and — more damaging for an open-source project — the docs claim it is. The single most serious technical issue is the **Electron shell granting Node.js integration to third-party app iframes that are themselves rendered with no sandbox**, a plausible remote-code-execution path. Alongside that sit a cluster of trust/robustness gaps (no runtime schema validation wired into the shipped agent, an origin allowlist that ships disabled and fails open, conformance/test fixtures compiled into the production bundle), 26 failing FINOS conformance scenarios, and a set of concrete documentation contradictions — most notably a direct "production-ready" vs. "not yet ready for production use" conflict between the docs site and the README, plus install instructions for npm packages that **do not exist on the public registry**.

**Biggest strengths**

- Clean two-layer architecture; the WCP4 identity check (origin triple-match + app-directory-origin binding) is a real, well-implemented security control (`packages/sail-desktop-agent/src/app-connection/wcp/wcp-identity-validation.ts`).
- Strong regression nets on the core agent: 58 Vitest files + ~134 Cucumber scenarios, no skipped/`.only` tests, assertions that check real behavior.
- Serious CI/OSS scaffolding: Prettier/ESLint/typecheck/build/Vitest/Cucumber gate, plus CodeQL, Scorecard, Semgrep, dependency review, CVE scanning; Changesets-based release pipeline.
- Conformance trajectory is real: 15→31→53 passing across harness runs; delivery and intent-result paths that used to time out now pass.

**Biggest risks**

- **Electron** `nodeIntegration:true` **+** `nodeIntegrationInSubFrames:true` over unsandboxed third-party iframes → RCE-class exposure (Critical).
- **FDC3 app iframes rendered with no** `sandbox` **attribute** (High).
- **Documentation over-claims production readiness** and instructs `npm install` of unpublished packages (High for trust/adoption).
- **26 failing FINOS conformance scenarios** (v6), including client metadata APIs and session teardown (High).
- **No DACP/WCP payload schema validation wired into the shipped agent** despite the README claiming all DACP messages are Zod-validated (Medium-High).

**Is it ready for external open-source users today?** As a *contributable incubating project*, yes — with honest framing. As a *production interop platform you can install and deploy*, no.

**Top recommended actions (in order)**

1. Fix Electron `webPreferences` (remove Node integration for content/subframes) and add an explicit iframe `sandbox` allowlist in `sail-web`.
2. Reconcile the production-readiness messaging and fix the docs-vs-code drift (unpublished npm packages, `generate:schemas`, `dev:harness`, `WCPConnector`, release process).
3. Wire the existing Zod validator into the default agent, or stop claiming validation happens.
4. Land the conformance session-teardown + client-metadata fixes and re-run the toolbox to a fresh, single source-of-truth baseline.

---



## Final Verdict

1. **Is this a well-architected open-source FDC3 Desktop Agent?**
  Yes, at the core. The `sail-desktop-agent` package is cleanly layered, transport-agnostic, curated at its public boundary, and well-tested. The architecture is sound; the gaps are at the edges (deployment security, validation wiring, conformance teardown), not in the core design.
2. **Is this a credible interop platform foundation?**
  As a foundation, yes; as a finished platform, no. `sail-platform-api` is real but incomplete — workspace/layout/config APIs are `unknown`-typed, remote persistence throws "not yet implemented," and the flagship `sail-web` app doesn't actually use the `SailPlatform` entry point the docs recommend. `sail-server` is a one-line stub.
3. **Is it ready for external open-source users today?**
  For contributors: yes, with caveats. For consumers who want to `npm install` and deploy: no — the packages aren't published, the Electron target is insecure and excluded from the default build, and the docs mislead on readiness.
4. **Minimum changes required before calling it production-ready** — see [Release Blocking Issues](#release-blocking-issues). In short: fix Electron/iframe sandboxing, wire runtime validation, close the conformance metadata/teardown gaps, publish the packages, and align documentation with reality.
5. **Recommendation to FINOS/OSS maintainers:** **Accept with conditions.** This is worth accepting and evolving as a FINOS *Incubating* project, but not worth tagging as production-ready or cutting a "1.0/production" release until the blockers below are closed. Hold any "production-ready" marketing until the security and conformance conditions are met.

---



## Final Scorecard


| Area                                       | Score (1–5) | Justification                                                                                                                                                     |
| ------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product clarity                            | 3           | Identity is clear (agent + browser/electron deployments + platform SDK), but readiness messaging directly contradicts itself and `sail-server` is a shipped stub. |
| Desktop Agent API usability                | 3           | Curated `index.ts` with an explicit "not exported" note is good; undermined by wholesale `export *` of internal state selectors/mutators.                         |
| Platform API usability                     | 3           | Well-documented config, but `unknown`-typed workspace/layout APIs and unimplemented remote backend; not dogfooded by the reference app.                           |
| FDC3 conformance                           | 2           | v6: 53 pass / 26 fail (~67%). Core delivery works; metadata APIs, teardown, and timing scenarios still fail.                                                      |
| Architecture                               | 4           | Clean two-layer separation, no cross-package `src` imports, sensible subpath exports. Minor leaks.                                                                |
| Browser transport / WCP / DACP correctness | 3           | Identity boundary is strong; but no payload schema validation wired, session-teardown hygiene issues, same-appId sole-pending auto-adopt.                         |
| Code quality                               | 3           | Readable and consistent; some AI-generated-style verbosity, `as unknown as` casts around wire types, dead/misleading config (`debug:true`).                       |
| Security posture                           | 2           | Electron Node-in-subframes RCE risk, unsandboxed iframes, validation not wired, allowlist ships off and fails open.                                               |
| Performance / runtime robustness           | 3           | Reasonable; timeouts exist but some are very long (61s intent budget), stale-instance accumulation affects correctness.                                           |
| Test confidence                            | 3           | Strong on core agent; zero tests for `sail-ui`/`sail-electron`/`sail-server`, dead duplicate Playwright specs, no coverage thresholds.                            |
| Documentation accuracy                     | 2           | Multiple concrete, reproducible drift items and a direct readiness contradiction.                                                                                 |
| Open-source readiness                      | 3           | Good CI/security scanners and Changesets; hurt by stale CoC name, minimal/boilerplate SECURITY.md, no PR template, license inconsistency, unpublished packages.   |
| Contributor experience                     | 3           | Dense, useful `AGENTS.md`; but CI doesn't run on the `v3-pre` integration branch where work actually happens.                                                     |
| Release readiness                          | 2           | Pipeline exists but has never published; Electron build excluded/broken; docs describe two contradictory release processes.                                       |


**Overall: ~2.7 / 5 — a strong, coherent prototype approaching beta, not a production platform.**

**Release recommendation: Do not ship yet (as "production"); safe to continue as FINOS Incubating with honest framing.**

**Minimum bar to change that recommendation:** close all [Release Blocking Issues](#release-blocking-issues) (Electron/iframe hardening, wire validation, conformance metadata + teardown fixes, align docs, publish packages), then re-run the FINOS toolbox to a single authoritative baseline.

---

## Focused Package Review: `sail-desktop-agent`

_This section scores the core package on its own merits. Deployment-layer issues (Electron Node integration, iframe sandboxing, `debug:true`, fixture bundling) belong to `sail-web`/`sail-electron` and are deliberately **excluded** here — they are not this package's responsibility. This is the most important and most complete package in the repo, and it deserves to be judged independently._

**Package verdict: the strongest part of the project — near-complete and dependable in design, held back from "done" by a handful of isolated correctness bugs and a public-API surface that needs tightening. ~3.8/5.**

### What it is

The pure, environment-agnostic FDC3 runtime: agent state (immer-based), the full DACP handler set, and the WCP identity/connection primitives, with DACP routing that only activates when an app-connection edge is attached (`agent/desktop-agent.ts` `attachAppConnection`). Browser hosts layer `SailDesktopAgent` on top; tests attach a `DacpTestAppConnection`. This "pure core + attachable transport edge" design is the package's defining strength and is genuinely well-executed.

### Scale & coverage (measured)

- **93 non-test source files, ~13,082 LOC.**
- **41 Vitest files in `src` + 17 Cucumber feature files (152 scenarios)** — a very healthy test-to-source ratio, no `.skip`/`.only`/`@wip`.
- Full FDC3 surface implemented: `broadcast/`, `channels/`, `private-channels/`, `intents/`, `open/`, `events/`, `heartbeat/`, `wcp/`.
- Publishable, versioned (`3.0.0-pre.1.0`), Apache-2.0, curated subpath exports (`.` vs `./browser`).

### Package Scorecard

| Sub-area | Score (1–5) | Justification |
|---|---|---|
| FDC3 API completeness | 4 | Full surface present; delivery, intent-result (void/context/channel/private), channels, private-channel lifecycle, and intent-listener-conflict all pass conformance. Gaps are isolated, not structural. |
| Conformance (agent-attributable only) | 3 | Excluding harness-side (C-4) and the client-library gap (C-1), the agent genuinely owns ~5–6 rows: `createAppIntents` dedup (C-5), 30s pending-intent timeout (C-6), traceId forwarding (C-3), and the unexplained `desktopAgent`/open-routing cases (C-2). Real but bounded. |
| Architecture & design | 4.5 | Pure-core-plus-attachable-edge is excellent; immer state; injectable logger/validator/launcher; clean handler decomposition; no cross-package `src` imports. |
| Public API design | 3 | Curated `index.ts` with an explicit private-by-design note is good, but `export *` of `state/selectors` and `state/mutators` (`index.ts:26-27`) leaks internal reducer plumbing into the semver contract. |
| Code quality | 4 | Dense, accurate JSDoc; small focused handlers; readable. Docked for `as unknown as <WireType>` casts at the wire boundary (`wcp-identity-validation.ts:253,363`) with standing TODOs about generated-type/schema mismatch. |
| Test quality & coverage | 4 | Behavioral assertions (error codes, state transitions, transport message counts), table-driven cases, strong BDD. Docked because there are no coverage thresholds and some regression nets assert the wire payload without reproducing the real client-visible failure (C-1/C-2). |
| Runtime correctness / robustness | 3 | The hardcoded 30s `attachPendingIntentTimeout` that tears down bookkeeping regardless of delivery (`intent-raise-shared.ts:180`) is a real robustness defect; stale-instance accumulation inflates `findIntent` counts under churn. |
| Package documentation | 4 | Excellent in-code JSDoc and a real package README/website docs; the one blemish is the *root* README's inaccurate "all DACP messages are Zod-validated" claim, since the validator is opt-in here (the package correctly provides the hook — `validator?: MessageValidator` — and applies it at `handlers/index.ts:38`). |

**Package overall: ~3.8/5 — production-capable core, not yet production-proven.**

### Why it scores well above the project as a whole

The project-level 2.7 is dragged down by deployment security (Electron/iframe), unpublished packages, and docs drift — **none of which are this package's fault.** Judged alone, `sail-desktop-agent` is a well-architected, well-tested, near-complete FDC3 agent. Its conformance failures are mostly *not* its own (harness teardown, a missing client-library method), and the ones that are (`createAppIntents` dedup, the 30s timeout, traceId forwarding) are small, pinpointed, and independently fixable.

### What stands between this package and "done"

1. **Fix the three agent-owned conformance bugs:** dedupe `createAppIntents` by `appId` (C-5); add a `delivered` guard / configurable budget to `attachPendingIntentTimeout` (C-6); forward app-provided `traceId`/`antiReplay`/`custom` on raised intents (C-3).
2. **Resolve C-2** with a live harness trace — the `desktopAgent` field is present in code and in a client that doesn't strip it, so the loss point is currently unexplained and the regression net doesn't reproduce it.
3. **Tighten the public API:** replace `export *` of `state/selectors` and `state/mutators` with an explicit, intentional export list before publishing a stable version.
4. **Decide validation policy:** either default-inject `createZodValidator()` or make the root README stop claiming validation is always on.
5. **Add coverage thresholds** so the strong existing suite protects future refactors (especially relevant given the in-flight `collapse-browser-app-connection-into-desktop-agent` work).
6. **Retire the wire-type `as unknown as` casts** once a validated boundary exists.

### Maintainer confidence for this package specifically

**Higher than for the repo overall.** A maintainer could accept and evolve `sail-desktop-agent` with confidence today: the tests are strong enough to catch regressions in the core paths, the architecture is documented, and the failure-attribution discipline (`conformance-test-failure-review.md`) is a real asset. The two reservations are the API-surface leakage (a stability risk once external users pin to it) and the fact that the package has never actually been published, so its semver/packaging contract is unproven in the wild.

---

## Checklist



### Areas of Strength

- Transport-agnostic core agent with clean deployment separation (`README.md` architecture; borne out in `packages/sail-desktop-agent/src/`).
- Robust WCP4 identity validation: origin triple-check + app-directory-origin binding (`wcp-identity-validation.ts:79-125`, `wcp-identity-url-matching.ts`).
- Curated public API with an explicit private-by-design note (`packages/sail-desktop-agent/src/index.ts:87-90`).
- Deep, honest regression nets on the agent (58 Vitest + ~134 Cucumber scenarios; no `.skip`/`.only`/`@wip`).
- Real security/OSS tooling: CodeQL, Scorecard, Semgrep, dependency-review, CVE-scanning workflows; Changesets release pipeline (`.github/workflows/`).
- Measurable conformance progress with a detailed, self-critical failure-attribution doc (`conformance-test-failure-review.md`).



### Areas of Weakness

- Electron shell security posture (Node integration in subframes).
- No `sandbox` on FDC3 app iframes; conformance/test fixtures + `debug:true` compiled into the production bundle.
- Runtime schema validation exists but is not wired into the shipped agent.
- 26 failing conformance scenarios (client metadata, teardown, timing).
- Documentation drift and a direct production-readiness contradiction; unpublished npm packages the docs tell users to install.
- Packages with no tests (`sail-ui`, `sail-electron`, `sail-server`); dead Playwright specs; no coverage gates.
- CI does not run on the `v3-pre` integration branch; `sail-server` license/`private` inconsistencies.



### Critical Considerations

- The Electron deployment is one of two advertised targets, yet it is both insecure and excluded from the default build — it should not be presented as a supported production target until hardened.
- "Production-ready" language on the docs site is not supportable given conformance status, security gaps, and unpublished packages; it risks the project's credibility with FINOS and adopters.

---



## Release Blocking Issues

Only Critical/High items that block a production or "production-ready" open-source release.

### BLOCK-1 — Electron grants Node.js to third-party app subframes (Critical, Security)

- **Location:** `packages/sail-electron/src/main.ts:12-17` (`WEB_PREFERENCES`), reused for content view and popup views (`:53-56`, `:134-195`).
- **Evidence:** `nodeIntegration: true` **and** `nodeIntegrationInSubFrames: true` are applied to the `WebContentsView` that loads `SAIL_URL` (the sail-web app), which in turn iframes arbitrary FDC3 app URLs. `contextIsolation: true` isolates the *preload* context only; it does not remove renderer/subframe Node access.
- **Why it matters:** Any FDC3 app loaded in a panel — if malicious, compromised, or supply-chain-poisoned — gets `require`, `process`, `child_process`, filesystem, etc. in the Electron renderer. That is remote code execution on the host OS from a web app.
- **Recommended fix:** Set `nodeIntegration: false`, `nodeIntegrationInSubFrames: false`, `sandbox: true`; expose only what's needed via the existing `contextBridge` preload (`packages/sail-electron/src/preload/desktop-agent-proxy.ts` already uses this pattern correctly). Add a `session.setPermissionRequestHandler` and a CSP for loaded content.
- **Blocks release:** Yes.



### BLOCK-2 — FDC3 app iframes rendered with no `sandbox` (High, Security)

- **Location:** `packages/sail-web/src/components/layout-grid/panel-templates/FDC3IframePanel.tsx:65-80`.
- **Evidence:** the `<iframe>` sets `src`, `name`, `style` only — no `sandbox` or `allow`. Grep confirms zero `sandbox=` usages in `sail-web/src`.
- **Why it matters:** the iframe is the only structural containment for third-party apps in the browser host and it provides none. Compounds BLOCK-1 in the Electron build.
- **Recommended fix:** add an explicit `sandbox` allowlist (e.g. `allow-scripts allow-forms allow-popups`; grant `allow-same-origin` only where the app's directory origin genuinely requires it) and a minimal `allow` policy. Validate against real FDC3 apps since WCP uses `postMessage`/`MessageChannel`, which survive sandboxing.
- **Blocks release:** Yes.



### BLOCK-3 — Documentation claims production readiness and installability that don't hold (High, Docs/Product)

- **Location:** `website/docs/intro.md:61,65`, `website/docs/run-sail.md:99` vs `README.md:190`; `website/docs/getting-started.md:70`.
- **Evidence:** docs site says "FDC3 Sail is a **production-ready product**"; README says "**not yet ready for production use**." Docs tell users to `npm install @finos/sail-desktop-agent @finos/fdc3`, but `npm view` returns **404** for both `@finos/sail-desktop-agent` and `@finos/sail-platform-api` — neither has ever been published.
- **Why it matters:** an external developer following the docs fails at step one; conflicting readiness claims destroy trust for a FINOS-incubating project.
- **Recommended fix:** pick one honest readiness message (Incubating/beta), correct it everywhere, and either publish the packages or change the docs to a clone-and-build primary path until they are.
- **Blocks release:** Yes for any "production-ready" claim or public adoption push.



### BLOCK-4 — 26 failing FINOS conformance scenarios (High, Conformance)

- **Location:** `packages/sail-conformance-harness/results/conformance-report-v6.txt` (53 pass / 26 fail).
- **Evidence:** failing clusters — `getResultMetadata` returns empty (4, a client-library gap), `AppMetadata` missing `desktopAgent` on harness path (2), intent `traceId` not forwarded (1), close-context teardown (4, harness-side, down from 26 in v5), `findIntent`/`findIntentsByContext` count inflation (3), `findInstances` instanceId mismatch (1), open-with-context 20s timeouts (3), `GetInfo2` 10s timeout (1), 61s delayed-result 80s timeouts (2, a real agent bug). ~22 of the 26 are positively evidenced from the text export; a few rows (`AOpensBWithWrongContext`, the long-duration `raiseIntent (throws error)` scenarios) are ambiguous in the raw dump.
- **Why it matters:** conformance is the core value proposition of an FDC3 agent. ~67% pass is not a production bar.
- **Recommended fix:** see [FDC3 Conformance Findings](#fdc3-conformance-findings).
- **Blocks release:** Yes for a conformance-claiming release.



### BLOCK-5 — Runtime message validation exists but is not enabled in the shipped agent (Medium-High, Security/Docs)

- **Location:** `packages/sail-desktop-agent/src/handlers/index.ts:37-53` (validation is conditional on an injected `validator`); `packages/sail-platform-api/src/services/validation/zod-validator.ts` (`createZodValidator`) is never passed by `SailDesktopAgent` (`agent/sail-desktop-agent.ts`) or `createSailBrowserDesktopAgent` (`sail-platform-api/src/sail-browser-desktop-agent.ts`). `README.md:144-159` claims "Sail validates all FDC3 DACP messages using Zod schemas."
- **Evidence:** inbound WCP/DACP messages are only shape/duck-typed (`app-connection/wcp/wcp-types.ts:29-52`, `isDACPMessage`/`isAppMessage`). The full Zod validator is built and tested but dead in the default path.
- **Why it matters:** a connected (WCP4-passed) but malicious app can send malformed/type-confused payloads straight to handlers; and the README asserts a guarantee the product doesn't provide.
- **Recommended fix:** inject `createZodValidator()` by default in `createSailBrowserDesktopAgent`/`SailDesktopAgent` (with an opt-out), or correct the README. Prefer wiring it on.
- **Blocks release:** Yes for the security claim; otherwise High.

---



## FDC3 Conformance Findings

Baseline: **v6 = 53 pass / 26 fail** (`conformance-report-v6.txt`). Note a documentation-hygiene issue: `conformance-test-failure-review.md` still calls **v5 (53/49)** the "current baseline" — the results folder itself is internally stale and should be updated to v6.

### C-1 — `getResultMetadata()` returns empty (4 rows) — external/dependency blocker, not a source fix

- **Observed:** `RaiseIntentContextResultMetadata`, `RaiseIntentContextWithMetadataResult`, `RaiseIntentChannelResultMetadata`, `RaiseIntentVoidResultMetadata` all fail `expected '' to not equal ''`.
- **Root cause (confirmed):** the DA side is fully wired — `handlers/intents/intent-result-handlers.ts:136-171` and `intent-result-metadata.ts` (`buildIntentResultWirePayload`, `attachIntentResultClientMetadata`) populate `raiseIntentResultResponse.payload.metadata` and attach it to the client-visible result (Vitest green). But the pinned client library `@finos/fdc3-agent-proxy@2.2.3` **has no** `getResultMetadata()` **method at all** — its `DefaultIntentResolution` exposes only `getResult()` (verified: zero `getResultMetadata` hits across the installed `@finos/fdc3`/`@finos/fdc3-agent-proxy` dist trees). This cluster **cannot be fixed in** `sail-desktop-agent` **source.**
- **Fix:** bump `@finos/fdc3`/`@finos/fdc3-agent-proxy` to a version that implements `getResultMetadata()`, then re-run the toolbox. Track as a dependency-upgrade item, not an agent bug.
- **Regression test:** after the dependency bump, a WCP/browser-path test asserting a non-empty `getResultMetadata()` on the *client*.



### C-2 — `AppMetadata` missing `desktopAgent` on harness path (2 rows)

- **Observed:** `GetAppMetadata`/`AppInstanceMetadata` — "expected [...] to include 'desktopAgent'".
- **Root cause:** in-repo tests confirm `desktopAgent` is set on the wire JSON for the open/directory path (`handlers/open/handlers.ts:46,264,322`; `get-app-metadata-harness-path.test.ts:82-83` passes). Yet the toolbox still sees it missing — so either a different response path omits it or the field is stripped before reaching the client. Note `wcp-identity-validation.ts:219-227` builds the `ImplementationMetadata.appMetadata` for WCP5 **without** a `desktopAgent` field, which is at least one path that omits it.
- **Fix:** audit every `AppMetadata` producer (WCP5 implementation metadata, getAppMetadata response, findInstances) for the `desktopAgent` field; the regression net asserts the wire payload but not the actual failing client path.
- **Regression test:** harness-path test asserting `desktopAgent` on the metadata the client actually receives for both directory and running-instance lookups.



### C-3 — Intent `traceId`/`antiReplay`/`custom` not forwarded (1 row)

- **Observed:** `IntentContextMetadataWithAppMetadata` — `expected '<generated-uuid>' to equal 'intent-trace-456'`.
- **Root cause:** the DA generates its own trace metadata instead of forwarding the app-provided `ContextMetadata` fields on a raised intent. See `handlers/intents/intent-result-metadata.ts` and the raise-intent handler path.
- **Fix:** when the raising app supplies `traceId`/`signature`/`antiReplay`/`custom`, propagate them into the delivered `ContextMetadata` rather than overwriting with a fresh UUID.
- **Regression test:** raise an intent with a fixed `traceId` and assert the receiving listener sees that exact value.



### C-4 — Session-teardown / "App didn't return close context within 1 sec" (4 rows in v6, down from 26 in v5)

- **Observed:** `ACBasicUsage1`, `ACBasicUsage2`, `UCBasicUsage1`, `UCContextMetadataOnBroadcast` fail because mock apps don't return close context before the next scenario.
- **Root cause:** harness session hygiene, **largely already fixed** — the new `harness-finos-teardown.ts` (`createHarnessFinOsTeardownObserver`, `parseMockAppControlTeardownBroadcast`) + `harness-browsing-context-close.ts` cut this from 26 rows (v5) to 4 (v6). Residual rows look like a timing race in the deferred-disconnect observer (`setTimeout(disconnect, deferDisconnectMs)`, default 0). **This is harness-only, not shipped-agent code** — a good production-readiness signal.
- **Fix:** tighten the teardown observer timing so all four residual scenarios return to baseline deterministically.
- **Regression test:** a harness lifecycle test asserting instance/connection count returns to baseline after a scenario close.



### C-5 — `findIntent`/`findIntentsByContext` count inflation (3 rows) and `findInstances` id mismatch (1 row)

- **Observed:** `FindIntentAppD`, `FindIntentAppDRightContext`, `FindIntentByContextSingleContext` — "expected length 1, got 2"; `FindInstances` — instanceId mismatch.
- **Root cause (confirmed in code):** `createAppIntents` (`handlers/intents/intent-helpers.ts:281-345`) builds `AppIntent.apps` in two unconditional passes — first every matching **directory** app (no `instanceId`), then every matching **running listener** (with `instanceId`) — **with no dedupe by** `appId`. An app that is both in the directory and running appears twice. Stale instances from teardown (C-4) can compound this. The `findInstances` mismatch is a separate launcher-vs-WCP-canonical instanceId reconciliation issue (`handlers/open/handlers.ts:~145` pre-registers the launcher-assigned id before WCP4; if the canonical id diverges, `findInstances` and `IntentResolution.source.instanceId` disagree).
- **Fix:** dedupe by `appId` in `createAppIntents` (prefer the running-instance row when both exist); reconcile launcher and WCP5-assigned instanceIds for `findInstances`. The failure-review flags the dedupe *policy* as blocked on FINOS clarification — worth confirming the intended shape before coding.
- **Regression test:** open N instances of a directory app, assert `findIntent` count and `findInstances` instanceIds match exactly.



### C-6 — Timing/timeout scenarios (open-with-context 20s ×3, GetInfo2 10s, 61s delayed results ×2)

- **Observed:** Mocha timeouts on `AOpensBWithContext3`/`AOpensBWithSpecificContext`/`AOpensBMultipleListen` (20s), `GetInfo2` (10s), and `RaiseIntentVoidResult61secs`/`RaiseIntentContextResult61secs` (80s).
- **Root cause:**
  - **61s delayed results — genuine agent bug (high confidence).** `attachPendingIntentTimeout` (`handlers/intents/intent-raise-shared.ts:177-195`) is called with a **hardcoded 30000ms default** from both raise paths (`intent-raise-intent.ts:230`, `intent-raise-intent-for-context.ts:105`). Its callback unconditionally deletes the pending-intent bookkeeping at t=30s **regardless of whether the result was already delivered** (no `delivered` guard). When the target's result arrives at t≈61s, `getPendingIntent` returns `undefined`, `handleIntentResultRequest` throws "No pending intent found," and the original `raiseIntent()` promise never settles → Mocha's 80s hard timeout. This constant conflates "how long to wait for a listener" with "max intent round-trip time."
  - **Open-with-context 20s + GetInfo2 10s:** likely a response-routing/instance-identity issue — the DA's own `AppTimeout` (15s, `dacp-constants.ts:17`) fires *before* Mocha's 20s cutoff, so a graceful timeout response *should* reach the client in time; that Mocha itself times out implies the response isn't routing back, pointing at the same launcher-vs-canonical instanceId divergence as C-5's `findInstances`. Needs a live trace to confirm.
- **Fix:** give `attachPendingIntentTimeout` a `delivered` guard (or clear it on delivery, not just on result) and make the max round-trip budget configurable/larger than the listener-wait; trace the open/GetInfo instanceId routing.
- **Regression test:** a >30s-delayed intent-result test asserting clean delivery (this directly reproduces the hardcoded-30s bug).



### Conformance bottom line

Delivery and intent-result plumbing genuinely work now. The remaining failures split into **harness/session hygiene** (largest, and mostly not core-agent bugs) and a **small, well-identified set of client-metadata gaps** in `sail-desktop-agent`. These are isolated and actionable, not systemic — but they must be closed and re-baselined before any conformance claim.

---



## Product & API Review

- **Desktop Agent API:** `packages/sail-desktop-agent/src/index.ts` is curated and self-aware (explicit note that `BrowserAppConnection`/`MessagePortTransport` live behind the `/browser` subpath). Good. The blemish: `export * from "./state/selectors/index.js"` and `export * from "./state/mutators/index.js"` (`index.ts:26-27`) dump internal reducer-style state plumbing into the public surface, and `sail-platform-api/src/index.ts:102` re-exports the auto-generated `dacp-schemas` the README says not to hand-edit. Both widen the semver contract unintentionally.
- **Platform API:** `SailPlatformConfig` is well-documented (`packages/sail-platform-api/src/sail-platform.ts:35`), but `WorkspacesApi`/`LayoutsApi`/`ConfigApi` are `Promise<unknown>`/`unknown` (`:140-161`), giving integrators nothing to build against; remote persistence throws "Remote storage backend not yet implemented" (`client/sail-platform-client.ts:76-78`). Persistence is localStorage-only.
- **Edge cases:** the origin allowlist (`wcp4-origin-allowlist.ts`) **fails open** — if `messageOrigin` is `undefined`, or if `instanceId`/`connectionAttemptUuid` can't be resolved, it falls through to the original handler and allows the connection. For a security control this should fail closed.
- **Product fit:** the app-developer journey is standards-based and well-documented (`website/docs/add-your-app.md` — use `@finos/fdc3`, call `getAgent()`, add a directory entry). The platform-owner journey is weaker: the docs recommend `SailPlatform`, but the flagship `sail-web` app uses the lower-level `createSailBrowserDesktopAgent` directly and there's no embedder example beyond the demo shell itself.

---



## Product Coherence & Adoption Review

- **What is Sail?** Coherently described as "a fully open source implementation of FDC3" = a core Desktop Agent library + browser/Electron deployments + a platform SDK + a conformance harness. That identity is clear and consistent across README, `intro.md`, and package descriptions. The incoherence is about *maturity and installability*, not identity.
- **Which package would a new external developer install?** Answerable in intent (`@finos/sail-desktop-agent` for a custom host, `@finos/sail-platform-api` for a fuller one) but **not in practice** — neither is on npm (404), so the only working path is clone-and-build, which the docs don't present as primary.
- **Platform owner path:** exists on paper (`SailPlatform`, `allowedOrigins`, middleware) but is undercut by unimplemented remote persistence, `unknown`-typed workspace APIs, and the reference app not dogfooding the recommended SDK.
- **Demo-only assumptions in production paths:** the FINOS conformance app directory and a default fixture directory are unconditionally merged into the `sail-web` bundle (`main.tsx:10-11,91-95`); `debug:true` is hardcoded (`main.tsx:89`); `sail-electron` defaults to `http://localhost:8090` (`main.ts:19`); `sail-server` is an empty stub yet is described in the run docs as part of the dev stack.
- **Boundaries:** package boundaries are clean at the import level (no cross-package `src` imports), with one exception: `sail-web/src/main.tsx:10` imports `conformance-appd.json` from the harness package by relative path, coupling the web app to a test-harness fixture.
- **Local-demo → real-deployment path:** the honest answer is that it isn't there yet — publishing, security hardening, real persistence, and de-fixturing the bundle all stand between the demo and a deployment.

---



## Maintainer Confidence Assessment

Could an OSS maintainer confidently accept, support, and evolve this? **Cautiously yes** — the bones are good and the intent is disciplined, but several things would make a maintainer nervous today:

- **API stability:** the `export `* leakage of state selectors/mutators and generated schemas means the public surface includes things that will churn; semver commitments would be hard to honor as written.
- **Breaking-change control:** Changesets is set up correctly and the release workflow is real — good. But it has never fired (no published versions), so the process is unproven in practice.
- **Refactor safety net:** strong for `sail-desktop-agent`; weak-to-absent for `sail-ui`, `sail-electron`, `sail-server`, and the browser E2E path (dead duplicate Playwright specs, never run in CI). No coverage thresholds anywhere.
- **Conformance actionability:** excellent — the failure-review doc is unusually candid and attributes each failure to an owner/root cause. This is a real asset for a new maintainer.
- **Architecture documentation:** good (`AGENTS.md` is dense and useful; website architecture docs are current). But the README architecture diagram is stale (`WCPConnector` no longer exists), and in-progress refactor plans reference paths that no longer exist.
- **CI gating gap:** the primary quality workflow (`ci.yml`) triggers only on `main`, while development happens on `v3-pre` and feature branches off it — so lint/typecheck/build/test may not gate the PRs that actually matter. Only CodeQL/Scorecard cover `v3-pre`.
- **Support/security expectations:** `SECURITY.md` is boilerplate (supports only "0.0.1," routes vulnerability reports to public GitHub issues — which is itself a poor practice for security disclosures); CoC still carries the old "Electron FDC3 Desktop Agent" project name; no PR template.

---



## Documentation Review

Concrete, reproducible drift (all verified):


| #   | Claim / reference                                    | Reality                                                                                | Location                                                                                                                                                   |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 | "production-ready product"                           | README says "not yet ready for production use"                                         | `website/docs/intro.md:61,65`, `run-sail.md:99` vs `README.md:190`                                                                                         |
| D-2 | `npm run generate:schemas`                           | script does not exist in any `package.json`                                            | `README.md:156`; generated file is actually at `sail-platform-api/src/services/validation/dacp-schemas.ts`, not the README's `sail-desktop-agent/...` path |
| D-3 | `npm run dev:harness`                                | actual script is `dev:conformance`                                                     | `website/docs/development.md:40,80`, `conformance-harness/overview.md:19` vs `package.json:15`                                                             |
| D-4 | `WCPConnector` (architecture diagram)                | class is `BrowserAppConnection`; no `WCPConnector` in `src/`                           | `README.md:54`; stale comments also in `FDC3IframePanel.tsx:17`                                                                                            |
| D-5 | Manual git-tag release process                       | actual process is Changesets                                                           | `README.md:167-177` vs `.github/workflows/release.yml` + `development.md:211-240`                                                                          |
| D-6 | "Sail validates all DACP messages using Zod schemas" | validator is not wired into the shipped agent (BLOCK-5)                                | `README.md:144-159` vs `handlers/index.ts:37-53`                                                                                                           |
| D-7 | CoC title                                            | "Code of Conduct for Electron FDC3 Desktop Agent & App Directory" — stale project name | `.github/CODE_OF_CONDUCT.md:1`                                                                                                                             |
| D-8 | SECURITY.md supported versions                       | lists only `0.0.1`; boilerplate; routes vuln reports to public issues                  | `SECURITY.md`                                                                                                                                              |


The website docs are, notably, *more* current than the README in several places (they use `BrowserAppConnection` correctly). The README is the stale artifact relative to both the code and the docs site.

---



## Architecture Review

- **Monorepo:** npm workspaces, 8 packages, orchestrated via plain `npm -w` + `concurrently` and a unified `vite-plus` (`vp`) toolchain (`package.json` `overrides` alias `vite`/`vitest`). No turbo/nx — acceptable at this size.
- **Layering:** the two-layer split (pure `sail-desktop-agent` ⟂ deployment `sail-web`/`sail-electron`, with `sail-platform-api` as the SDK) is real and honored. Subpath exports (`.` vs `./browser`) correctly separate the environment-agnostic core from browser-only WCP primitives.
- **Boundaries:** no cross-package `src` imports found; Vitest resolves workspaces via `dist/` exports per `AGENTS.md`. The one coupling is the `sail-web` → harness JSON fixture import (see Product Coherence).
- **Gaps:** `sail-conformance-harness` is missing from the root `tsconfig.json` project references despite being built/typechecked in CI; `sail-server` is a stub; `sail-electron` is excluded from the default `npm run build` and flagged as mid-migration (Rollup → `vp pack`).
- **In-flight refactor:** `plans/work-items/collapse-browser-app-connection-into-desktop-agent.md` (the current branch's theme) is collapsing `BrowserAppConnection` into `DesktopAgent`; the plan's own file manifest references stale paths (`src/core/…`), so the architecture is actively moving and docs/plans lag it.

---



## Code Quality Review

- **General:** readable, consistent formatting/linting, sensible naming, good module decomposition in the agent. Handlers are small and focused.
- **Smells:**
  - Repeated `as unknown as <WireType>` casts around WCP responses (`wcp-identity-validation.ts:253,363`; `wcp1-3-handshake.ts:103`) with TODO comments about generated-type/schema mismatch — a real type-safety soft spot at the wire boundary.
  - Dead/misleading config: `debug:true` hardcoded in `main.tsx:89` while `consoleLogger.debug` is a no-op (`interfaces/logger.ts`), so the flag does nothing today but invites future payload leakage if wired to a verbose logger.
  - `export *` of internal state modules (see API Review).
  - Verbose explanatory comment blocks and some duplicated helper logic consistent with AI-assisted authorship — not harmful, but adds surface area.
- **Refactor targets:** unify the wire-type casts behind a validated boundary (which the Zod validator could provide if wired); tighten the public `index.ts` exports; consolidate the two WCP source-window/pending maps.

---



## Security Review

Highest-severity first (full detail in [Release Blocking Issues](#release-blocking-issues) for BLOCK-1/2/5):

1. **Electron Node-in-subframes (Critical)** — `sail-electron/src/main.ts:12-17`. RCE-class exposure to any loaded FDC3 app.
2. **Unsandboxed app iframes (High)** — `FDC3IframePanel.tsx:65-80`.
3. **No payload schema validation wired (Medium-High)** — `handlers/index.ts:37-53`; validator built but unused by default agent.
4. **Origin allowlist fails open and ships disabled (Medium)** — `wcp4-origin-allowlist.ts:71-101`. When origin/routing metadata is absent it falls through to allow; and `sail-web` never sets `allowedOrigins`, so the sole boundary is "origin must match an app-directory entry" — and the conformance-harness apps are merged into that same directory (`main.tsx:91-95`), trusting test apps at production level.
5. **Same-appId sole-pending auto-adopt (Low-Moderate)** — `wcp-host-instance-adoption.ts` (`findSolePendingHostInstanceId`) adopts any single pending instance of the same appId with no UUID correlation; a same-appId race, not a cross-trust bypass.
6. **Popout relay has no origin filter (Low-Moderate)** — `dockview-popout.ts:42-58` forwards any `WCP1Hello` to the opener; bounded by WCP4, so resource-consumption class, not identity bypass.
7. **Unconditional identity-payload logging (Low)** — `wcp-identity-validation.ts:51,127,255` log appId/instanceId/identityUrl via `logger.info` in every build (not secrets, but noisy).
8. **Strong control worth crediting:** the WCP4 origin triple-check + directory-origin binding genuinely prevents cross-origin appId impersonation (`wcp-identity-validation.ts`, `wcp-identity-url-matching.ts`). `postMessage("*")` is avoided in the WCP path (tests assert a specific `targetOrigin`); the one `"*"` use is in a Sail-owned channel-selector asset.

**Positive baseline:** CodeQL, Semgrep, Scorecard, dependency-review, and CVE-scanning workflows are all present — the scanning posture is better than most incubating projects. `webSecurity` is left default-on in Electron; localStorage holds only layout/config, no secrets.

---



## Performance Review

- **Timeouts:** handshake 5s, disconnect grace 2s, intent-resolution 60s (`browser-app-connection.ts:79-81`), plus a separate **hardcoded 30000ms pending-intent timeout** (`intent-raise-shared.ts:180`) that tears down intent bookkeeping regardless of delivery — the confirmed cause of the 61s-delayed-result conformance failures (C-6). Scattered, hardcoded timeout constants with overlapping responsibilities are a robustness smell.
- **Memory/lifecycle:** a 30s `setInterval` prunes stale disconnects (`browser-app-connection.ts:127`); but the conformance runs show stale CONNECTED instances accumulating within a session and inflating `findIntent` counts — teardown is the weak link, and it has both correctness and memory implications under churn.
- **Rendering:** dockview-based panel grid; each FDC3 app is an iframe. No obvious rendering bottleneck reviewed, but no performance tests exist.
- **Bundle:** conformance + default fixture app directories and demo assets are compiled into the `sail-web` production bundle — dead weight for a real deployment and a correctness/trust concern, not just size.

---



## Test Coverage Review


| Package                    | Vitest/spec             | Cucumber                  | Test script                      | Assessment                                       |
| -------------------------- | ----------------------- | ------------------------- | -------------------------------- | ------------------------------------------------ |
| `sail-desktop-agent`       | 58                      | 17 files (~134 scenarios) | yes                              | Strong, behavioral, no skips                     |
| `sail-conformance-harness` | 11                      | 0                         | yes (runs in CI)                 | Real wiring/intent-resolution tests              |
| `sail-platform-api`        | 4                       | 0                         | yes                              | Includes allowlist + channel tests               |
| `sail-web`                 | 3 Vitest + 2 Playwright | 0                         | Vitest yes; Playwright not in CI | Playwright specs are byte-identical placeholders |
| `sail-ui`                  | 0                       | 0                         | none                             | 17+ components, zero tests                       |
| `sail-electron`            | 0                       | 0                         | none                             | Untested Electron shell (see BLOCK-1)            |
| `sail-server`              | 0                       | 0                         | none                             | Stub                                             |
| `website`                  | 0                       | n/a                       | n/a                              | Expected                                         |


- **CI reality:** Vitest (all wired projects, incl. conformance-harness) + Cucumber run in CI; **Playwright never runs**; the conformance *toolbox* run is manual (browser UI), not automated.
- **Gaps:** no coverage thresholds anywhere; the security-critical Electron and iframe surfaces have no tests; the browser WCP path is not exercised by an automated E2E in CI (`conformance.md` itself admits BDD uses `MockTransport`, so the real browser transport is not conformance-tested via BDD).
- **Quality where it exists:** spot-checked tests (`close-request.test.ts`, `intent-resolution.test.ts`) assert real behavior and error codes, not mock echoes.

---



## CI/CD & Tooling Review

- **Gates (**`ci.yml`**):** Prettier → ESLint → typecheck → build (6 packages) → docs build → Vitest → Cucumber. Solid as far as it goes.
- **Gaps:**
  - Triggers on `main` only; active development is on `v3-pre` and branches off it → the main quality gate may not run on the PRs that matter. Only CodeQL/Scorecard list `v3-pre`.
  - No Playwright step; no automated conformance run; no coverage gate.
- **Release:** Changesets-based (`release.yml`, gated by `NPM_TOKEN`), publishing only `sail-desktop-agent` + `sail-platform-api`. Correct in design, unproven in practice (nothing published yet).
- **Package hygiene:** `sail-server` declares `ISC` license in an Apache-2.0 repo and lacks `private:true`; `sail-electron` also lacks `private:true`/`publishConfig` — both could be accidentally published under `@finos` outside the Changesets flow. `sail-ui`/`sail-web`/`sail-conformance-harness` are correctly `private:true`.

---



## Accessibility Review

Limited assessment (no a11y-focused agent, no automated a11y tests in the repo). Observations:

- `sail-ui` is shadcn/Radix-based, which provides a reasonable a11y baseline (focus management, ARIA) for primitives.
- The app shell (`sail-web`) is a dockview grid of iframes; no a11y tests, no evidence of keyboard-navigation or screen-reader validation for the workspace/panel/channel-selector UI.
- **Recommendation:** add at least automated a11y smoke checks (axe) to the Playwright suite (once it runs in CI) for the shell chrome; treat this as post-release polish, not a blocker.

---



## Open-Source Readiness

- **License:** Apache-2.0 at root; consistent for the two publishable packages; **inconsistent** `ISC` on `sail-server`; several packages omit a `license` field.
- **Governance/community:** FINOS Incubating badge, CLA/ICLA guidance, meetings/mailing list — good. CoC present but stale-named; **no PR template**; SECURITY.md is minimal boilerplate that routes vulnerabilities to public issues (should be a private channel).
- **Examples:** no `examples/` directory; the "example" is the demo shell plus fixture directories. An external integrator has docs but no standalone runnable sample host.
- **Publishing:** pipeline exists; packages are unpublished (404). This is the single biggest adoption blocker for consumers.
- **Vulnerability reporting:** should move off public GitHub issues to GitHub private security advisories or a security@ address.

---



## Actionable Fixes



### Must Fix Before Release

- **Electron:** disable `nodeIntegration`/`nodeIntegrationInSubFrames`, enable `sandbox:true`, add CSP + permission handler (`sail-electron/src/main.ts`). [BLOCK-1]
- **Iframes:** add an explicit `sandbox` allowlist to `FDC3IframePanel.tsx`. [BLOCK-2]
- **Docs/readiness:** reconcile production-ready messaging; fix `generate:schemas`, `dev:harness`, `WCPConnector`, and the release-process description; either publish the packages or make clone-and-build the documented primary path. [BLOCK-3, D-1..D-6]
- **Conformance:** bump `@finos/fdc3-agent-proxy` for `getResultMetadata` (C-1), finish harness teardown (C-4), fix the hardcoded 30s pending-intent timeout (C-6), dedupe `createAppIntents` (C-5), forward app `traceId` (C-3), and trace the `desktopAgent`/open-routing cases (C-2); re-run the toolbox to a fresh v7 baseline and delete the stale v5 "current baseline" claim. [BLOCK-4]
- **Validation:** wire `createZodValidator()` into the default agent or correct the README. [BLOCK-5]
- **Allowlist:** make `wireWcp4OriginAllowlist` fail closed. [Security #4]



### Should Fix Soon After Release

- Run CI on `v3-pre` (and feature branches); add Playwright to CI; add coverage thresholds.
- De-fixture the `sail-web` bundle (gate conformance/default app directories and `debug` behind env/dev flags).
- Tighten public exports (`sail-desktop-agent/src/index.ts`, `sail-platform-api/src/index.ts`).
- Fix `sail-server` license + add `private:true` to `sail-server`/`sail-electron`; add `sail-conformance-harness` to root tsconfig references.
- Update SECURITY.md (real supported versions, private reporting channel); rename the CoC; add a PR template.
- Add tests for `sail-ui`; remove the duplicate placeholder Playwright specs.



### Nice To Have

- Type the `WorkspacesApi`/`LayoutsApi`/`ConfigApi` surfaces; implement or clearly defer the remote storage backend.
- Provide a standalone embedder example that uses `SailPlatform` (and make `sail-web` dogfood it).
- Add axe-based a11y smoke tests to the shell.
- Reduce `as unknown as` wire casts behind the validated boundary.

---



## Recommended Work Plan

1. **Security hardening sprint (blockers first):** Electron `webPreferences` + iframe sandbox + fail-closed allowlist + wire the Zod validator. Add regression/E2E coverage for these surfaces. *(Unblocks the two most severe issues.)*
2. **Truth-in-docs sprint:** one honest readiness message everywhere; fix D-1..D-8; decide publish-now vs clone-and-build-primary; publish the two packages if going public.
3. **Conformance close-out:** complete C-4 teardown → C-1/C-2/C-3 metadata → then C-5 dedupe (unblock with FINOS) → re-baseline to v7; wire an automated toolbox/E2E run into CI.
4. **CI & OSS hygiene:** run `ci.yml` on `v3-pre`/feature branches; add Playwright + coverage gates; fix package license/private flags; SECURITY.md, CoC, PR template.
5. **Platform maturation:** type the platform APIs, implement/defer remote persistence, add an embedder example, de-fixture the bundle.

---

## Open Questions & Assumptions

1. **Is** `nodeIntegration`**/**`nodeIntegrationInSubFrames` **in Electron intentional?** The preload already uses `contextBridge`, so Node-in-renderer looks like legacy misconfiguration. Needs team confirmation. *(Assumption: unintentional.)*
2. **Is the missing** `sandbox` **on iframes deliberate** (some FDC3 apps needing `allow-same-origin`+`allow-scripts`) or an oversight? Confirm before choosing the sandbox allowlist.
3. **Are the packages unpublished because this is pre-release** `v3-pre` **state**, or a genuine gap? Determines whether BLOCK-3 is "fix docs" or "publish now."
4. **Should the origin allowlist be on by default in** `sail-web`**,** or is `sail-web` intended as a permissive reference app with enterprises expected to wire their own? Affects whether #4 is a bug or a documented deployment responsibility.
5. **Is the CI** `branches:[main]`**-only trigger intentional** (some other gate protecting `v3-pre`) or an oversight leaving the integration branch under-gated?
6. **Conformance discrepancies (C-1/C-2):** in-repo Vitest asserts the wire payload is correct while the toolbox still fails — confirm whether the gap is in the get-agent client, a specific unaudited response path, or a stale export. The regression nets currently don't reproduce the real client-side failure.
7. `desktopAgent` **omission in WCP5** `ImplementationMetadata.appMetadata` (`wcp-identity-validation.ts:219-227`) — is this an intended difference from the getAppMetadata path, or the actual source of C-2?

---

*This review distinguishes technical potential from release readiness deliberately: the core is a serious, coherent, well-tested FDC3 Desktop Agent with a defensible architecture — a strong foundation worth investing in. It is not, today, a production-ready interoperability platform, and its documentation should stop saying that it is until the blocking security, conformance, publishing, and validation gaps are closed.*