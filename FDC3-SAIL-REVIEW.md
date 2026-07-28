# FDC3 Sail Production Readiness Review

*Review date: **2026-07-28** · Branch: `wip/v3-local` @ `4dddd88f7` · Supersedes the 2026-07-07 review (written against `chore/collapse-browser-app-connection-into-desktop-agent`).*

> **Scope note:** diagnosis only. No implementation code was changed. Every finding below was re-verified against the tree at `4dddd88f7` on the date above; findings carried forward from the previous review were individually re-checked rather than assumed.

> **Verification method and its limits.** All findings are **static** — source, package manifests, CI config, committed conformance exports, and a live npm registry query. **Build, typecheck, unit tests, and the FINOS conformance toolbox were not executed for this review.** This checkout's `node_modules/@finos/*` symlinks resolve to a Windows host path (`/mnt/host/c/...`) and the `vite-plus` toolchain ships Windows-native binaries, so the toolchain cannot run in this environment. Nothing here should be read as "the build is green" or "the build is broken" — neither was tested. Claims that require execution are marked **UNMEASURED** and are not scored as if they were measured.

---

## Why this review replaces the previous one

The 2026-07-07 review was accurate when written, then aged badly and *invisibly*. On 2026-07-23 the bulk package-rename commit (`ceb13eae0`) rewrote package names throughout the review file, so it read as current while none of its content had been re-verified. Three packages were deleted after it was written.

**Resolved or made obsolete since 2026-07-07:**

| Previous finding | Status |
|---|---|
| BLOCK-1 — Electron `nodeIntegration`/`nodeIntegrationInSubFrames` RCE (**Critical**) | **Obsolete.** `packages/sail-electron` deleted 2026-07-20 (`cd1b4b0e4`). No Electron code in the repo. |
| `sail-server` stub, `ISC` license, missing `private:true` | **Obsolete.** Package dropped 2026-07-22 (`f5570ad60`). |
| `sail-ui` — 17+ components, zero tests | **Obsolete.** Package gone; `sail-theme` replaced it. |
| BLOCK-5 — Zod validator built but not wired | **Superseded.** Zod removed entirely; replaced by `@finos/fdc3-schema` validators **wired on by default**. See NEW-1 for the residual. |
| D-4 — `WCPConnector` in README architecture diagram | **Fixed.** Zero occurrences repo-wide; diagram says `BrowserAppConnection`. |
| C-3 — app `traceId`/`antiReplay`/`custom` not forwarded | **Fixed** (`4494c5cd7`). `intent-result-metadata.ts:189-200` forwards them explicitly. |
| `export *` of `state/selectors` + `state/mutators` leaking the semver surface | **Fixed** (`4dddd88f7`). Neither is exported from `index.ts`. |
| C-2 — `desktopAgent` missing, "loss point unexplained" | **Superseded.** `77cac2a39` deliberately gates `desktopAgent` on bridging advertisement (`handlers/open/handlers.ts:248-250`). Now a policy decision needing re-test, not a mystery. |
| Open Question 7 — is the `desktopAgent` omission in WCP5 `ImplementationMetadata` intended? | **Answered: yes, intended.** `wcp-identity-validation.ts:220-227` omits it, consistent with the bridging gate. |
| "CI doesn't run on `v3-pre`" | **Gap real, branch name stale.** Work moved to `wip/v3-local`; CI still triggers on `main` only. |

The previous review's headline verdict (**2.7/5**, "Security posture: 2") was dominated by the Electron finding. With that package gone, validation wired, and the public API tightened, the security and API scores rise materially. The **documentation** position, by contrast, got *worse*, and the **conformance** position became unmeasured.

---

## Executive Summary

**Overall verdict: a well-architected FDC3 Desktop Agent at the end of beta, with a genuinely strong core, one unresolved containment gap, and a documentation layer that now actively misdescribes the code.**

The last three weeks removed the project's most serious security exposure by deleting the Electron target outright, replaced the dead Zod validator with schema validation that is actually wired into the default message path, and tightened the public export surface to a single curated entry point. The core `sail-desktop-agent` package is the strongest part of the repo and has gotten stronger.

What has not moved: the packages are still unpublished (verified 404 today), FDC3 app iframes still render with no `sandbox` attribute, the origin allowlist still fails open, and the documentation still tells users to install packages that don't exist, run scripts that don't exist, and relies on a validation mechanism that was deleted. The conformance baseline is now stale enough to be unusable — the committed v6 export predates roughly ten conformance-fixing commits.

**Biggest strengths**

- Clean two-layer architecture (pure agent ⟂ deployment), honored in code: no cross-package `src` imports.
- WCP4 identity validation — origin triple-match plus app-directory-origin binding — is a real, well-implemented control (`app-connection/wcp/wcp-identity-validation.ts`, `wcp-identity-url-matching.ts`).
- Inbound DACP/WCP schema validation is now **on by default**, sourced from `@finos/fdc3-schema` so it cannot drift from the targeted FDC3 version (`dacp/validate-dacp-message.ts`, wired at `handlers/index.ts:26-53`).
- Single curated public entry point after `4dddd88f7`; internal reducer plumbing no longer in the semver contract.
- Dense regression nets on the core: 42 Vitest files in `sail-desktop-agent` plus 17 Cucumber feature files / 152 scenarios, no `.skip`/`.only`/`@wip`.
- Real OSS/security tooling: CodeQL, Scorecard, Semgrep, dependency-review, CVE scanning, OSPS baseline; Changesets release pipeline.
- FDC3 3.0 work has begun in earnest (`agent/fdc3-version.ts`, intent-listener conflict detection, `closeRequest` gated on 3.0 advertisement).

**Biggest risks**

- **FDC3 app iframes render with no `sandbox`** — now the top security finding (High).
- **Documentation describes a system that no longer exists**: Zod validation, `generate:schemas`, a `dacp-schemas.ts` path, `sail-server` in the repo tree, `dev:harness` (High for trust/adoption).
- **Packages remain unpublished** while docs instruct `npm install` (High).
- **Conformance status is unknown** — the committed baseline is stale, and the failure-review doc still names an even older one (High, unmeasured).
- **Origin allowlist fails open and ships disabled** (Medium).

**Is it ready for external open-source users today?** As a *contributable incubating project*, yes, with honest framing — and the framing has improved as the surface shrank. As a *production interop platform you can install and deploy*, no.

**Top recommended actions (in order)**

1. Add an explicit iframe `sandbox` allowlist in `sail-finance`; make the WCP4 origin allowlist fail closed.
2. Rewrite the README's validation section to describe `@finos/fdc3-schema` validation and its `warn` default; delete the Zod/`generate:schemas` instructions.
3. Re-run the FINOS toolbox to a fresh baseline and retire v5/v6 as "current".
4. Reconcile the production-readiness messaging; publish the two packages or make clone-and-build the documented primary path.
5. Clean up the deletion fallout: dangling `sail-ui` tsconfig reference, `sail-server` in `.changeset/pre.json` and `development.md`.

---

## Final Verdict

1. **Is this a well-architected open-source FDC3 Desktop Agent?**
   Yes, and more clearly than three weeks ago. `sail-desktop-agent` is cleanly layered, transport-agnostic, curated at its public boundary, and well-tested. The remaining gaps are at the edges — deployment containment, validation strictness, and an unmeasured conformance position — not in the core design.
2. **Is this a credible interop platform foundation?**
   As a foundation, yes; as a finished platform, no. `sail-platform` is real but incomplete: `WorkspacesApi`/`LayoutsApi`/`ConfigApi` are `unknown`-typed (`sail-platform.ts:139-159`), remote persistence throws "not yet implemented" (`client/sail-platform-client.ts:78`), and `sail-finance` still bypasses the recommended `SailPlatform` entry point in favour of `createSailBrowserDesktopAgent` (`main.tsx:110`).
3. **Is it ready for external open-source users today?**
   For contributors: yes. For consumers who want to `npm install` and deploy: no — neither package is on the registry, iframe containment is absent, and the docs mislead on both readiness and mechanism.
4. **Minimum changes before calling it production-ready** — see [Release Blocking Issues](#release-blocking-issues).
5. **Recommendation to FINOS/OSS maintainers:** **Accept with conditions.** Worth accepting and evolving as a FINOS *Incubating* project. Hold any "production-ready" claim until iframe containment, documentation accuracy, publishing, and a re-measured conformance baseline are in place.

---

## Final Scorecard

| Area | Score (1–5) | Δ vs 2026-07-07 | Justification |
|---|---|---|---|
| Product clarity | 3.5 | ▲ 0.5 | Scope tightened honestly — Electron and the server stub removed rather than left as aspirational targets. Readiness messaging still contradicts itself. |
| Desktop Agent API usability | 4 | ▲ 1.0 | Single curated entry point after `4dddd88f7`; internal selectors/mutators no longer exported. Residual: `export *` of `host-contracts` and `interfaces`. |
| Platform API usability | 3 | — | Unchanged: `unknown`-typed workspace/layout/config APIs, unimplemented remote backend, not dogfooded by the reference app. |
| FDC3 conformance | **n/a** | — | **UNMEASURED.** The committed v6 export predates ~10 conformance-fixing commits. Scoring it would be fabricating a number. See [Conformance](#fdc3-conformance-status-unmeasured). |
| Architecture | 4.5 | ▲ 0.5 | Two-layer separation intact and simplified by three package deletions; no cross-package `src` imports. Docked for deletion fallout in build config. |
| Browser transport / WCP / DACP correctness | 3.5 | ▲ 0.5 | Identity boundary strong; schema validation now wired. Docked for `warn`-by-default, same-appId sole-pending auto-adopt, and session-teardown hygiene. |
| Code quality | 3 | — | Readable and consistent; `as unknown as` wire casts are more widespread than previously reported (10+ sites), and `debug:true` is still hardcoded. |
| Security posture | 3 | ▲ 1.0 | Critical Electron exposure gone; validation wired. Held back by unsandboxed iframes, fail-open allowlist, and unconditional full-payload identity logging. |
| Performance / runtime robustness | 3 | — | The hardcoded 30s pending-intent timeout with no `delivered` guard is unchanged; stale-instance accumulation still affects `findIntent` correctness. |
| Test confidence | 3 | — | Strong on the core agent; `sail-theme` untested; duplicate byte-identical Playwright specs still present and still not in CI; no coverage thresholds. |
| Documentation accuracy | **1.5** | ▼ 0.5 | **Worse.** The README now documents a validation mechanism that was deleted, a script that does not exist, and a file path that does not exist. |
| Open-source readiness | 3 | — | Good scanners and Changesets; still stale CoC name, boilerplate SECURITY.md routing vulns to public issues, no PR template, unpublished packages. |
| Contributor experience | 3 | — | `AGENTS.md` is dense and useful but names `v3-pre` as the integration branch; CI still doesn't gate the branch where work happens. |
| Release readiness | 2 | — | Pipeline exists, has never published. `.changeset/pre.json` still lists the deleted `@finos/sail-server`. |

**Overall: ~3.2 / 5 across measured areas** (up from ~2.7), **with conformance explicitly unscored.** A strong, coherent late-beta agent — not yet a production platform.

**Release recommendation: do not ship as "production."** Safe and reasonable to continue as FINOS Incubating with honest framing.

---

## Focused Package Review: `sail-desktop-agent`

*Deployment-layer issues (iframe sandboxing, `debug:true`, fixture bundling) belong to `sail-finance` and are excluded here.*

**Package verdict: the strongest part of the project, and stronger than three weeks ago. ~4.1/5** (was ~3.8). The public-API leak that capped the previous score is closed, and validation is wired. What remains is a small set of pinpointed correctness bugs.

### Scale & coverage (measured statically, 2026-07-28)

- **93 non-test source files, 13,226 LOC** (was 93 / 13,082 — essentially flat).
- **42 Vitest files in `src`** plus **17 Cucumber feature files / 152 scenarios**; no `.skip`/`.only`/`@wip`.
- Full FDC3 surface: `broadcast/`, `channels/`, `private-channels/`, `intents/`, `open/`, `events/`, `heartbeat/`, `wcp/`, plus new `agent/fdc3-version.ts` and `handlers/intents/intent-listener-conflict.ts` for FDC3 3.0.
- Publishable, versioned `3.0.0-pre.1.0`, Apache-2.0, single root export.

> A correction to the previous review: its Strengths section claimed "58 Vitest files + ~134 Cucumber scenarios", contradicting its own package section ("41 Vitest + 152 scenarios"). The 58/134 figure was wrong when written. The measured figures above supersede both.

### Package Scorecard

| Sub-area | Score | Δ | Justification |
|---|---|---|---|
| FDC3 API completeness | 4.5 | ▲ 0.5 | Full 2.2 surface plus in-progress FDC3 3.0 (version comparison, intent-listener conflict detection, `closeRequest` gating). |
| Conformance (agent-attributable) | **n/a** | — | UNMEASURED — the export is stale. Two agent-owned defects remain identified in code (C-5, C-6). |
| Architecture & design | 4.5 | — | Pure-core-plus-attachable-edge remains excellent; immer state; injectable logger/launcher; clean handler decomposition. |
| Public API design | 4 | ▲ 1.0 | `4dddd88f7` reduced the surface to one entry point. Docked only for remaining `export *` of `host-contracts` and `interfaces`, and a malformed `exports` condition order (NEW-4). |
| Code quality | 3.5 | ▼ 0.5 | Dense accurate JSDoc, small handlers. Docked further because `as unknown as <WireType>` casts are broader than previously reported — 10+ non-test sites including all of `dacp-message-creators.ts`. |
| Test quality & coverage | 4 | — | Behavioral assertions, table-driven cases, strong BDD. Still no coverage thresholds. |
| Runtime correctness / robustness | 3 | — | `attachPendingIntentTimeout` (`intent-raise-shared.ts:177-195`) still hardcodes 30 000 ms and still tears down bookkeeping with no `delivered` guard. `createAppIntents` still double-counts. |
| Package documentation | 3.5 | ▼ 0.5 | In-code JSDoc remains excellent — `validate-dacp-message.ts` documents *why* `warn` is the default, which is exactly right. Docked because the root README's validation section is now wholly fictional. |

### What stands between this package and "done"

1. **Dedupe `createAppIntents` by `appId`** (C-5) — confirmed still open, see below.
2. **Add a `delivered` guard to `attachPendingIntentTimeout`** and separate "how long to wait for a listener" from "max intent round-trip" (C-6) — confirmed still open.
3. **Bump `@finos/fdc3`/`@finos/fdc3-agent-proxy`** past 2.2.3 for `getResultMetadata()` (C-1) — confirmed still open.
4. **Decide the validation default**: `warn` is a defensible transition state, but it is not an enforcement boundary. Ship a plan to reach `strict`.
5. **Add coverage thresholds** so the strong suite protects future refactors.
6. **Retire the `as unknown as` wire casts** now that a validated boundary exists.

---

## Release Blocking Issues

Only items that block a production or "production-ready" release. Renumbered — the previous BLOCK-1 (Electron) no longer exists.

### BLOCK-A — FDC3 app iframes render with no `sandbox` (High, Security)

- **Location:** `packages/sail-finance/src/components/layout-grid/panel-templates/FDC3IframePanel.tsx`.
- **Evidence:** grep for `sandbox` across `packages/sail-finance/src` returns **zero hits**. The `<iframe>` sets `src`, `name`, and `style` only.
- **Why it matters:** the iframe is now the *only* structural containment for third-party apps, since the Electron target — which previously compounded this — is gone. Removing Electron narrowed the blast radius to the browser tab; it did not add containment.
- **Recommended fix:** add an explicit `sandbox` allowlist (e.g. `allow-scripts allow-forms allow-popups`), granting `allow-same-origin` only where an app's directory origin genuinely requires it, plus a minimal `allow` policy. Validate against real FDC3 apps — WCP uses `postMessage`/`MessageChannel`, which survive sandboxing.
- **Blocks release:** Yes.

### BLOCK-B — Documentation describes a system that no longer exists (High, Docs/Product)

This was previously a readiness-messaging problem. It is now also a *mechanism* problem, and it got worse rather than better.

- **Evidence:**
  - `README.md:141` — "Sail validates all FDC3 Desktop Agent Communication Protocol (DACP) messages using **Zod schemas** auto-generated from the official FDC3 JSON schemas." **There is no Zod in the repository** — no dependency in any `package.json`, no `createZodValidator`, no generated schema file.
  - `README.md:151` — instructs `npm run generate:schemas --workspace=@finos/sail-desktop-agent`. **No such script exists** in any manifest.
  - `README.md:154` — names `packages/sail-desktop-agent/src/handlers/validation/dacp-schemas.ts` as the generated file. **That path does not exist.** (The previous review's correction — "it's actually at `sail-platform/src/services/validation/`" — is also now wrong; that file is gone too.)
  - `website/docs/development.md:55` — repo-tree diagram still lists `sail-server/  # Node.js backend server (@finos/sail-server)`, a package deleted 2026-07-22.
  - `.changeset/pre.json` — still lists `"@finos/sail-server": "0.0.1"` in `initialVersions`.
- **Why it matters:** a reader following the README to understand or extend validation will look for a mechanism that was deleted, find nothing, and lose confidence in every other claim in the document. This is more damaging than the previous "validator not wired" finding, because the previous state was at least *describable*.
- **Recommended fix:** rewrite `README.md:141-160` to describe `dacp/validate-dacp-message.ts`, its `@finos/fdc3-schema` source, the `off`/`warn`/`strict` modes, and the `warn` default. Delete the `generate:schemas` instructions. Sweep `development.md` and `.changeset/pre.json` for deleted packages.
- **Blocks release:** Yes.

### BLOCK-C — Production-readiness claim contradicts the README (High, Docs/Product)

- **Location:** `website/docs/intro.md:61,65` and `website/docs/run-sail.md:68` vs `README.md:184`.
- **Evidence:** the docs site says "FDC3 Sail is a **production-ready product** for hosting FDC3 applications" and "Sail is **production-ready** for running FDC3 workloads"; the README says it is "currently in active development and **not yet ready for production use**."
- **Why it matters:** conflicting readiness claims from the same project destroy trust for a FINOS-incubating effort, and the docs-site claim is not supportable while conformance is unmeasured and the packages are unpublished.
- **Recommended fix:** pick one honest message (Incubating/beta) and apply it everywhere.
- **Blocks release:** Yes for any "production-ready" claim.

### BLOCK-D — Packages are not published (High, Adoption)

- **Evidence (live registry query, 2026-07-28):** `npm view @finos/sail-desktop-agent` and `npm view @finos/sail-platform` both return **E404 — Not Found**. Neither has ever been published. `website/docs/getting-started.md` instructs `npm install`.
- **Why it matters:** an external developer following the docs fails at step one. This remains the single biggest adoption blocker.
- **Recommended fix:** publish both under the `pre` tag, or make clone-and-build the documented primary path until you do.
- **Blocks release:** Yes for a public adoption push.

### BLOCK-E — Conformance status is unknown (High, Conformance — UNMEASURED)

- **Evidence:** the newest committed export, `packages/sail-conformance-harness/results/conformance-report-v6.txt`, was last written **2026-06-23** (`11c8cda71`). Since then roughly ten conformance-affecting commits have landed, including DACP listener ordering for the open-with-context race (`09b5b7024`), FINOS `closeWindow` relay and the `desktopAgent` bridging gate (`77cac2a39`), WCP host-identifier resolution when `window.name` is cleared (`677d1686c`), popup adoption stabilisation (`da22e7f66`), and `AppLauncher.close` wiring (`1c2e75a68`).
- **Compounding:** `results/conformance-test-failure-review.md:3` still declares **"Current baseline: `conformance-report-v5.txt` (53 pass / 49 fail)"** — one generation older than the newest committed export and two generations behind the code. The results folder now carries three mutually inconsistent notions of "current."
- **Why it matters:** conformance is the core value proposition of an FDC3 agent. The project currently cannot state its own conformance position, and the previous review's headline "53 pass / 26 fail (~67%)" now describes code that no longer exists. Quoting it would be misleading.
- **Recommended fix:** re-run the FINOS toolbox against `wip/v3-local`, commit the export as the single authoritative baseline, update `conformance-test-failure-review.md` to match, and delete or clearly archive v3–v5.
- **Blocks release:** Yes for any conformance claim.

---

## FDC3 Conformance Status (UNMEASURED)

**No pass/fail figure is quoted in this review, deliberately.** The committed baseline is stale (BLOCK-E) and the toolbox could not run in this environment. What follows is the status of individual defects *as verified in source*, independent of any harness run.

### C-1 — `getResultMetadata()` unavailable in the client library — **still open, external**

- **Verified today:** all packages still depend on `@finos/fdc3` `^2.2.3`; the installed `@finos/fdc3-agent-proxy` is **2.2.3**, and a recursive grep of that package returns **zero** occurrences of `getResultMetadata`.
- The agent side is wired (`handlers/intents/intent-result-handlers.ts`, `intent-result-metadata.ts`). This cluster cannot be fixed in `sail-desktop-agent` source.
- **Fix:** dependency bump, then re-run. Track as a dependency item, not an agent bug.

### C-2 — `desktopAgent` on `AppMetadata` — **superseded by a design decision**

- The previous review flagged this as an unexplained loss. It is now **deliberate**: `handlers/open/handlers.ts:248-250` documents `desktopAgent` as the FDC3 2.1+ experimental bridging field and emits it only when `includeDesktopAgent` is true (bridging claimed). `wcp-identity-validation.ts:220-227` consistently omits it from WCP5 `ImplementationMetadata.appMetadata`.
- **Action:** confirm against the FINOS toolbox whether its expectation is compatible with bridging-gated emission. If the toolbox expects the field unconditionally, this becomes a spec-interpretation question to raise with FINOS, not a code fix.

### C-3 — app-provided `traceId`/`antiReplay`/`custom` forwarding — **fixed**

- `intent-result-metadata.ts:189-200` now explicitly forwards `traceId`, `signature`, `antiReplay`, and `custom` when present, with DA source/timestamp taking precedence. Commit `4494c5cd7`.

### C-4 — Session teardown — **substantially addressed, needs re-measurement**

- `harness-finos-teardown.ts`, `harness-browsing-context-close.ts`, and `harness-instance-lifecycle.ts` are in place, and `1c2e75a68` wired `AppLauncher.close` to always disconnect on panel removal. This is harness and host code, not shipped-agent code — a good production-readiness signal. Residual status unknown pending a fresh run.

### C-5 — `findIntent`/`findIntentsByContext` count inflation — **CONFIRMED still open**

- **Verified in source:** `handlers/intents/intent-helpers.ts` — `createAppIntents` builds `AppIntent.apps` in two unconditional passes. The first (`// First, add apps from directory in directory order`) pushes every matching directory app with no `instanceId`; the second (`// Then, add running instances with their instanceId`) pushes every matching running listener. **Neither pass dedupes by `appId`**, so an app that is both in the directory and running appears twice.
- **Reader beware:** a *different* function in the same file (around `:202-206`) does dedupe — `const runningAppIds = new Set(...)` with a `.filter(app => !runningAppIds.has(app.appId))`. It is easy to mistake that for the fix. `createAppIntents` has no equivalent.
- **Fix:** dedupe by `appId` in `createAppIntents`, preferring the running-instance row. The failure-review flags the dedupe *policy* as pending FINOS clarification — confirm the intended shape before coding.

### C-6 — Hardcoded 30s pending-intent timeout — **CONFIRMED still open**

- **Verified in source:** `handlers/intents/intent-raise-shared.ts:177-195`. `attachPendingIntentTimeout(context, requestId, timeoutMs = 30000)` is called with the default from both raise paths (`intent-raise-intent.ts:230`, `intent-raise-intent-for-context.ts:105`). Its callback deletes the pending-intent bookkeeping at t=30s **with no `delivered` guard** — only a `pendingIntentPromises.has(requestId)` presence check, which does not distinguish "still waiting" from "already delivered."
- **Consequence:** a result arriving after 30s finds no pending intent, `handleIntentResultRequest` throws, and the originating `raiseIntent()` promise never settles. This constant conflates "how long to wait for a listener" with "maximum intent round-trip time."
- **Fix:** add a `delivered` guard (or clear the timer on delivery rather than on result), and make the round-trip budget configurable and larger than the listener wait.
- **Regression test:** a >30s-delayed intent-result test asserting clean delivery. This reproduces the bug directly and does not require the toolbox.

---

## Security Review

Highest severity first.

1. **Unsandboxed app iframes (High)** — `FDC3IframePanel.tsx`; zero `sandbox=` in `sail-finance/src`. See BLOCK-A. Now the top finding.
2. **Origin allowlist fails open and ships disabled (Medium)** — `packages/sail-platform/src/wcp4-origin-allowlist.ts:76` guards with `messageOrigin !== undefined && !allowedOrigins.includes(messageOrigin)`, so an absent origin falls through to *allow*. `sail-platform/src/sail-browser-desktop-agent.ts:76-77` only wires the allowlist when `config.allowedOrigins` is supplied, and **`sail-finance` never supplies it** — no `allowedOrigins` occurrences in that package. The sole boundary is therefore "origin must match an app-directory entry," and the conformance-harness app directory is merged into that same directory (`main.tsx:10`), trusting test apps at production level. A security control should fail closed.
3. **Validation defaults to non-enforcing (Medium)** — see NEW-1.
4. **Unconditional full-payload identity logging (Low-Medium, worse than previously reported)** — `wcp-identity-validation.ts:52` logs the entire `wcp4Message.payload` and `:256` logs the entire WCP5 `response.payload` via `logger.info` in every build. The previous review described this as logging "appId/instanceId/identityUrl"; it is in fact whole-payload logging. Not secrets today, but it is an unbounded surface that will leak whatever future WCP payloads carry.
5. **Same-appId sole-pending auto-adopt (Low-Moderate)** — `wcp-host-instance-adoption.ts` (`findSolePendingHostInstanceId`) adopts a single pending instance of the same appId with no UUID correlation. A same-appId race, not a cross-trust bypass.
6. **Strong control worth crediting** — the WCP4 origin triple-check plus directory-origin binding genuinely prevents cross-origin appId impersonation (`wcp-identity-validation.ts`, `wcp-identity-url-matching.ts`).

**Positive baseline:** CodeQL, Semgrep, Scorecard, dependency-review, CVE-scanning, and OSPS workflows are all present — a better scanning posture than most incubating projects. **And the biggest structural improvement this cycle was a deletion:** removing `sail-electron` eliminated an RCE-class exposure outright rather than patching it. That is the right call and worth stating plainly.

---

## New Findings (not in the previous review)

### NEW-1 — Schema validation is wired but non-enforcing by default (Medium, Security/Docs)

- **Location:** `packages/sail-desktop-agent/src/dacp/validate-dacp-message.ts`; wired at `handlers/index.ts:26-53`; default set at `agent/default-config.ts:38` (`validation: "warn"`).
- **What's good:** validators come from `@finos/fdc3-schema` — the same generated source as the `BrowserTypes` the agent types against — so the check cannot drift from the targeted FDC3 version. Only inbound app-sendable messages are validated. The rationale for the `warn` default is documented in-source and is sound: `strict` would break clients sending slightly off-spec shapes, so surfacing first is the right sequencing.
- **The gap:** in `warn` mode a failing message is logged and **dispatched anyway** (`handlers/index.ts:53`). A connected but malicious app can still push malformed or type-confused payloads into handlers. This is a real improvement over the previous "not wired at all" state, but it is not yet an enforcement boundary, and the `as unknown as` wire casts downstream still assume well-formed input.
- **Fix:** publish a timeline to `strict`; consider `strict` for the WCP handshake messages specifically, where off-spec shapes are least defensible.

### NEW-2 — Dangling `sail-ui` project reference in root `tsconfig.json` (Medium, Build)

- **Location:** `tsconfig.json:8` — `{ "path": "./packages/sail-ui" }`.
- **Evidence:** `packages/sail-ui` does not exist; the package was replaced by `sail-theme`, which is **not** referenced. `sail-conformance-harness` is also still missing from the references list despite being built and typechecked in CI.
- **Status: UNMEASURED impact.** A dangling project reference is normally a hard `tsc --build` error, but I could not run the toolchain to confirm whether this surfaces in CI or is bypassed by the `vite-plus` pipeline. Either way it is deletion fallout that should be cleaned up.

### NEW-3 — Deleted `sail-server` still present in release and docs config (Low, Release)

- `.changeset/pre.json` `initialVersions` still lists `"@finos/sail-server": "0.0.1"`; `website/docs/development.md:55` still shows it in the repo tree. Harmless today, confusing during the first real publish.

### NEW-4 — `exports` condition order puts `import` before `types` (Low, Packaging)

- **Location:** `packages/sail-desktop-agent/package.json` — `"." : { "import": ..., "types": ..., "default": ... }`.
- **Why it matters:** conditional exports are matched in declaration order, and `types` must be listed **first** for TypeScript to resolve declarations reliably under `node16`/`nodenext` resolution. Consumers on `moduleResolution: "bundler"` (as this repo uses internally) will not notice; external consumers on stricter resolution modes may fail to get types.
- **Fix:** reorder to `types`, then `import`, then `default`. Cheap, and worth doing before the first publish since it is part of the packaging contract.

---

## Documentation Review

All items re-verified 2026-07-28; line numbers refreshed.

| # | Claim / reference | Reality | Location |
|---|---|---|---|
| D-1 | "production-ready product" | README says "not yet ready for production use" | `website/docs/intro.md:61,65`, `run-sail.md:68` vs `README.md:184` |
| D-2 | `npm run generate:schemas` | Script exists in no manifest | `README.md:151` |
| D-3 | Generated file at `sail-desktop-agent/src/handlers/validation/dacp-schemas.ts` | Path does not exist; no generated schema file anywhere | `README.md:154` |
| D-4 | "validates all DACP messages using **Zod** schemas" | No Zod in the repo; validation is `@finos/fdc3-schema`-based and defaults to `warn` | `README.md:141` vs `dacp/validate-dacp-message.ts` |
| D-5 | `npm run dev:harness` | Actual script is `dev:conformance` | `website/docs/development.md:39,74`, `packages/conformance-harness/overview.md:19` vs `package.json:15` |
| D-6 | Manual per-package git-tag release process | Actual process is Changesets (`release.yml`, `changeset:version`, `release:publish`) | `README.md:163-167` |
| D-7 | Repo tree lists `sail-server/` | Package deleted 2026-07-22 | `website/docs/development.md:55` |
| D-8 | CoC title: "Code of Conduct for **Electron** FDC3 Desktop Agent & App Directory" | Stale project name — and now doubly so, since Electron is gone | `.github/CODE_OF_CONDUCT.md:1` |
| D-9 | SECURITY.md supports version `0.0.1`; routes vulnerability reports to **public** GitHub issues | Boilerplate; public issues are the wrong channel for vulnerability disclosure | `SECURITY.md` |
| D-10 | `AGENTS.md` names `v3-pre` as the integration branch | Work happens on `wip/v3-local` | `AGENTS.md:73,110` |

**Resolved since the last review:** the `WCPConnector` reference is gone — the README architecture diagram now correctly shows `BrowserAppConnection` and `AppConnectionRegistry`, and `WCPConnector` appears nowhere in the repo.

**Assessment:** the website docs are cleaner than they were — the `sail-electron` and `sail-web` package pages are gone and `deployment-targets.md` now describes only the browser host. The **README is the stale artifact**, and its validation section is the single most misleading passage in the project.

---

## Architecture Review

- **Monorepo:** npm workspaces, **5 packages** (down from 8): `sail-desktop-agent`, `sail-platform`, `sail-finance`, `sail-conformance-harness`, `sail-theme`, plus `website`. Orchestrated with plain `npm -w` + `concurrently` on a unified `vite-plus` (`vp`) toolchain. No turbo/nx — appropriate at this size.
- **Layering:** the two-layer split (pure `sail-desktop-agent` ⟂ deployment `sail-finance`, with `sail-platform` as the SDK) is real, honored, and simplified by the deletions. The `/browser` subpath export was removed; everything public now comes from the package root, and the app-connection edge is internal (`attachAppConnection()` is `@internal`).
- **Boundaries:** no cross-package `src` imports, enforced by `npm run lint:boundaries` (oxlint). **One exception, unchanged:** `packages/sail-finance/src/main.tsx:10` imports `conformance-app-directory` from the harness package by relative path, coupling the production web app to a test-harness fixture.
- **Deletion fallout:** dangling `sail-ui` tsconfig reference (NEW-2); `sail-conformance-harness` still absent from tsconfig references; `sail-server` in `.changeset/pre.json` (NEW-3).
- **In flight:** `.cursor/plans/` carries a `sail-one` shell porting plan (`da497d253`, `47f25c242`) — the architecture is still actively moving, so expect further doc lag.

---

## Code Quality Review

- **General:** readable, consistently formatted, well-decomposed; handlers are small and focused. JSDoc quality in the agent is genuinely high — `validate-dacp-message.ts` documenting *why* `warn` is the default is the kind of comment that survives a refactor.
- **Smells:**
  - **`as unknown as <WireType>` casts are more pervasive than previously reported** — 10+ non-test sites including `wcp-identity-validation.ts:254,364`, `wcp1-3-handshake.ts:88`, `browser-app-connection.ts:193,204`, `channels/handlers.ts:124`, and every response creator in `dacp/dacp-message-creators.ts:98,122,149,184`. The previous review cited two. Now that a schema-validated boundary exists, these are removable in principle.
  - `debug: true` hardcoded at `packages/sail-finance/src/main.tsx:111`.
  - Conformance and default app-directory fixtures unconditionally merged into the `sail-finance` bundle (`main.tsx:10-11`).
  - Verbose explanatory comment blocks consistent with AI-assisted authorship — not harmful, but it inflates surface area.
- **Refactor targets:** collapse the wire casts behind the validated boundary; gate fixtures and `debug` behind an env flag; reorder the `exports` conditions.

---

## Test Coverage Review

Counted statically, 2026-07-28. **Not executed** — see the verification note at the top.

| Package | Test files | Cucumber | Assessment |
|---|---|---|---|
| `sail-desktop-agent` | 42 | 17 files / 152 scenarios | Strong, behavioral, no skips |
| `sail-conformance-harness` | 14 | 0 | Real wiring/lifecycle/intent-resolution tests (was 11) |
| `sail-platform` | 5 | 0 | Includes allowlist + channel tests (was 4) |
| `sail-finance` | 3 Vitest + 2 Playwright | 0 | Playwright specs are **byte-identical duplicates** (same md5: `packages/sail-finance/tests/example.spec.ts` and `tests/e2e/example.spec.ts`) |
| `sail-theme` | 0 | 0 | Untested |
| `website` | 0 | n/a | Expected |

- **CI reality:** Vitest and Cucumber run in CI; **Playwright never runs**; the conformance toolbox run is manual.
- **Gaps:** no coverage thresholds anywhere (`vitest.config.ts` has no `coverage` block); the iframe containment surface has no tests; the real browser WCP path is not exercised by an automated E2E in CI — BDD uses `MockTransport` by design.
- **Improvement worth noting:** the harness gained three test files this cycle, concentrated on exactly the instance-lifecycle and teardown paths that C-4 implicated.

---

## CI/CD & Tooling Review

- **Gates (`ci.yml`):** Prettier → ESLint → typecheck → build → docs build → Vitest → Cucumber, plus a `lint:boundaries` oxlint step in `npm run validate`. Solid as far as it goes.
- **Gaps:**
  - `on: push`/`pull_request` → `branches: [main]` **only**. Active development is on `wip/v3-local`, so the main quality gate does not run on the PRs that matter. Only CodeQL/Scorecard cover other branches.
  - No Playwright step; no automated conformance run; no coverage gate.
- **Release:** Changesets-based (`release.yml`, `release:publish` builds `sail-desktop-agent` + `sail-platform` then `changeset publish`). Correct in design, **never fired** — nothing published.
- **Package hygiene:** improved by deletion. `sail-conformance-harness`, `sail-finance`, and `sail-theme` are correctly `private: true`; the two publishable packages carry Apache-2.0. The previous `ISC`-license and missing-`private` findings died with `sail-server` and `sail-electron`. Residual: `.changeset/pre.json` still names the deleted server package.

---

## Open-Source Readiness

- **License:** Apache-2.0 at root and on both publishable packages. The previous `ISC` inconsistency is resolved by deletion. Private packages omit a `license` field, which is acceptable.
- **Governance/community:** FINOS Incubating badge, CLA/ICLA guidance, meetings, `MAINTAINERS.md` — good. CoC present but stale-named (D-8); **no PR template** (`.github/` contains only `CODE_OF_CONDUCT.md`, `ISSUE_TEMPLATE/`, and `workflows/`); SECURITY.md is minimal boilerplate routing vulnerabilities to public issues (D-9).
- **Examples:** no `examples/` directory; the example is the demo shell plus fixture directories. An external integrator has docs but no standalone runnable sample host.
- **Publishing:** pipeline exists; packages are unpublished (verified 404). Biggest adoption blocker.
- **Vulnerability reporting:** move off public GitHub issues to GitHub private security advisories or a `security@` address. This is a one-line fix with outsized credibility value for a FINOS project.

---

## Accessibility Review

Limited assessment — no a11y-focused tooling in the repo, and nothing executed.

- `sail-theme` is shadcn/Radix-derived, which provides a reasonable a11y baseline (focus management, ARIA) for primitives.
- The app shell is a dockview grid of iframes; no a11y tests, no evidence of keyboard-navigation or screen-reader validation for the workspace/panel/channel-selector UI.
- **Recommendation:** add axe-based a11y smoke checks to the Playwright suite once it runs in CI. Post-release polish, not a blocker.

---

## Actionable Fixes

### Must Fix Before Release

- **Iframes:** add an explicit `sandbox` allowlist to `FDC3IframePanel.tsx`. [BLOCK-A]
- **README validation section:** rewrite `README.md:141-160` to describe `@finos/fdc3-schema` validation and the `warn` default; delete the Zod and `generate:schemas` instructions. [BLOCK-B, D-2/D-3/D-4]
- **Readiness messaging:** pick one honest message across `intro.md`, `run-sail.md`, and `README.md`. [BLOCK-C, D-1]
- **Publish** both packages under the `pre` tag, or make clone-and-build the documented primary path. [BLOCK-D]
- **Re-baseline conformance:** run the toolbox against `wip/v3-local`, commit a single authoritative export, update `conformance-test-failure-review.md`, archive v3–v5. [BLOCK-E]
- **Allowlist:** make `wireWcp4OriginAllowlist` fail closed when `messageOrigin` is absent. [Security #2]
- **C-5:** dedupe `createAppIntents` by `appId`.
- **C-6:** add a `delivered` guard to `attachPendingIntentTimeout` and separate the listener-wait from the round-trip budget.

### Should Fix Soon After Release

- Run CI on `wip/v3-local` and feature branches; add Playwright to CI; add coverage thresholds.
- Clean up deletion fallout: `tsconfig.json:8` dangling `sail-ui`, add `sail-conformance-harness` and `sail-theme` references, remove `@finos/sail-server` from `.changeset/pre.json` and `development.md:55`. [NEW-2, NEW-3]
- Reorder the `exports` conditions so `types` comes first. [NEW-4]
- De-fixture the `sail-finance` bundle: gate the conformance/default app directories and `debug` behind env flags.
- Bump `@finos/fdc3`/`@finos/fdc3-agent-proxy` past 2.2.3 for `getResultMetadata()`. [C-1]
- Publish a plan to move validation from `warn` to `strict`. [NEW-1]
- Update SECURITY.md (real supported versions, private reporting channel); rename the CoC; add a PR template.
- Remove the duplicate placeholder Playwright spec; update `AGENTS.md` branch references.

### Nice To Have

- Type the `WorkspacesApi`/`LayoutsApi`/`ConfigApi` surfaces; implement or explicitly defer the remote storage backend.
- Provide a standalone embedder example using `SailPlatform`, and make `sail-finance` dogfood it.
- Reduce the `as unknown as` wire casts behind the validated boundary.
- Scope the WCP identity logging down from whole payloads to specific fields. [Security #4]
- Add axe-based a11y smoke tests to the shell.

---

## Recommended Work Plan

1. **Containment + truth-in-docs sprint.** Iframe `sandbox`, fail-closed allowlist, and the README validation rewrite. These are small, independent, and they close the two findings most likely to embarrass the project in review.
2. **Re-baseline conformance.** Run the toolbox, commit one authoritative export, reconcile the failure-review doc. Until this happens the project cannot state its own conformance position — and neither can this review.
3. **Agent-owned conformance fixes.** C-5 dedupe (confirm policy with FINOS first), C-6 `delivered` guard, C-1 dependency bump. Each has a regression test that does not require the toolbox.
4. **Publish.** Fix the `exports` ordering, clean the changeset config, cut the first `pre` release. The pipeline is correct but unproven; proving it is itself valuable.
5. **CI & OSS hygiene.** Gate the real integration branch, add Playwright and coverage, fix SECURITY.md/CoC/PR template.
6. **Platform maturation.** Type the platform APIs, implement or defer remote persistence, add an embedder example, de-fixture the bundle.

---

## Open Questions & Assumptions

1. **Is the missing iframe `sandbox` deliberate** — do some FDC3 apps require `allow-same-origin` + `allow-scripts` together? Confirm before choosing the allowlist, since that combination substantially weakens the sandbox.
2. **Is the FINOS toolbox's `desktopAgent` expectation compatible with bridging-gated emission?** The gate is now a deliberate design decision (C-2); if the toolbox expects the field unconditionally, this is a spec-interpretation question for FINOS, not a code fix.
3. **What is the timeline from `warn` to `strict` validation,** and is `strict` acceptable for WCP handshake messages sooner than for DACP generally?
4. **Are the packages unpublished because this is pre-release state, or is publishing blocked?** Determines whether BLOCK-D is "publish now" or "fix the docs."
5. **Should the origin allowlist be on by default in `sail-finance`,** or is `sail-finance` intended as a permissive reference app with enterprises wiring their own? Affects whether Security #2 is a bug or a documented deployment responsibility.
6. **Is the CI `branches: [main]`-only trigger intentional,** or an oversight leaving the integration branch under-gated?
7. **What is the `sail-one` shell's relationship to `sail-finance`?** The porting plan landed 2026-07-24; if `sail-one` supersedes `sail-finance`, several findings above should be retargeted before work starts.

---

*This review distinguishes technical potential from release readiness deliberately. The core is a serious, coherent, well-tested FDC3 Desktop Agent with a defensible architecture, and it improved materially over the last three weeks — the most severe finding of the previous review was closed by deleting the offending target rather than patching it, validation moved from dead code to the default path, and the public API contracted to something a maintainer could actually commit to. It is not yet a production-ready interoperability platform: iframe containment is absent, the conformance position is unmeasured, the packages are unpublished, and the README describes a validation mechanism that no longer exists. The documentation should stop claiming production readiness until those are closed.*
