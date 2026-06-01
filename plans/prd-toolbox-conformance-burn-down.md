# PRD: FDC3 toolbox conformance burn-down (harness + agent)

## Persona / user

- **Lead maintainer** closing gaps between in-repo `@conformance2.2` BDD (MockTransport) and the FINOS FDC3 conformance toolbox (`conformance-report-v2.txt`, `conformance-report-v3.txt`).
- **Conformance engineer** using `@finos/sail-conformance-harness` (port 3001) as a clean room vs full Sail stack (`sail-web` on port 3000).

## Goal / outcome

Reduce toolbox failures attributable to **real `@finos/sail-desktop-agent` bugs** and **WCP/instance-identity integration gaps**, with BDD coverage that catches regressions before manual toolbox runs. Success is measured by a harness re-run (`conformance-report-v4.txt` or staged summary) showing cleared agent-metadata/intent-discovery blocks and materially fewer `AppTimeout` / `IntentDeliveryFailed` clusters, plus a failure-category audit proving each cleared or deferred toolbox row has the right regression owner.

## Relationship to other plans

| Existing plan / work item | Status on `v3-pre` | This PRD |
|---------------------------|-------------------|----------|
| `plans/prd-desktop-agent-conformance-gaps.md` | Active P1 hardening | **Extends** — items 7–9 (error enums, WCP BDD) remain relevant; do not re-plan completed cleanup/history items |
| `conformance-test-failure-review.md` | v2 attribution doc | **Update** after harness baseline re-run |
| `plans/work-items/conformance-harness-host.md` | `pr_awaiting` (#45) | **No duplicate** — harness exists; this PRD burns down failures it exposes |
| `plans/work-items/fdc3-error-enum-boundary-tests.md` | `pr_awaiting` (#44) | **No duplicate** — covers TB-03 resolve error matrix; deliver/merge before or in parallel with toolbox re-run |
| `plans/work-items/bdd-wcp-integration-scenario.md` | `approved` | **Depends on TB-04** — deliver after host↔WCP instance-id contract is clear |
| `plans/work-items/extend-cleanup-source-and-open-with-context.md` | `done` | **No duplicate** |
| `plans/work-items/align-wcp-instance-id-in-tests.md` | `pr_awaiting` (#41) | **Related** — test hygiene; TB-05 extends to launch-via-raiseIntent `uuid-0` path |
| `plans/work-items/conformance-traceability-map.md` | `done` | **Extend** via TB-06 (ContextMetadata row → partial/missing) |

## Evidence summary (v2 → v3)

| Source | Pass / fail | Notes |
|--------|-------------|-------|
| `conformance-report-v2.txt` (full Sail stack) | 18 / 56 | sail-web integration noise (`UserCancelledResolution`, launch context) |
| `conformance-report-v3.txt` (`sail-conformance-harness`) | 15 / 45 | Resolver modal removed; **open regressions** (AOpensB3/AOpensB4); persistent agent bugs |
| Cucumber `@conformance2.2` raise-intent | 3 failed / 17 passed (20-scenario slice) | `"uuid-0" sends validate` → instance not registered — same class as toolbox `AppTimeout` |

**Attribution after discounting harness UI** (intent modal, channel selector, sail-web `void context`):

- **Agent library (~15–20 scenarios):** `getAppMetadata` missing `desktopAgent`; `findIntent` / `findIntentsByContext` shape; resolve error codes; `findInstances` completeness.
- **WCP / host integration (~25+ scenarios):** `AppTimeout`, open-with-context, multi-app channels, `IntentDeliveryFailed` on raise — launcher `instanceId` ≠ WCP5 canonical id; cross-origin `window.name` unavailable (`wcp1-3-handshake.ts`).

## In scope

| ID | Summary | Classification |
|----|---------|----------------|
| TB-00 | Audit why conformance-lifted BDD missed toolbox failures; classify every failure category and required regression net | task |
| TB-01 | Always include `desktopAgent` on `AppMetadata` from `getAppMetadata` (directory and instance paths) | task |
| TB-02 | Map intent `displayName` from app directory; dedupe `findIntentsByContext` results | task |
| TB-03 | Align resolve error codes with toolbox matrix (`NoAppsFound` vs `TargetInstanceUnavailable` vs `IntentDeliveryFailed`) | task — **existing** `fdc3-error-enum-boundary-tests` |
| TB-04 | Host-assigned launcher `instanceId` becomes WCP5 canonical id (harness + agent contract) | spike → task |
| TB-05 | Fix Cucumber launch-via-raiseIntent `uuid-0` correlation (3 failing `@conformance2.2` scenarios) | task |
| TB-06 | BDD assertions for toolbox-checked metadata fields (`desktopAgent`, directory `displayName`) | task |
| TB-07 | ContextMetadata on broadcast and intent — BDD coverage for toolbox `fdc3.contextMetadata` / `fdc3.intentContextMetadata` | task |
| TB-08 | Harness toolbox re-run + update `conformance-test-failure-review.md` | task |
| TB-09 | Vitest WCP integration path (`bdd-wcp-integration-scenario`) | task — **existing** slug |

## Out of scope

- sail-web / `@finos/sail-platform-api` product shell fixes (separate workload; compare harness pass / web fail for attribution).
- Same-origin proxy of `fdc3.finos.org` conformance apps (optional future spike unless TB-04 investigation requires it).
- CI gate running full FINOS toolbox against harness.
- Repo-wide ESLint/Prettier.
- Re-opening completed P1 cleanup (`extend-cleanup-source-and-open-with-context`, etc.) unless regression found.

## Success criteria

- TB-00: `conformance-test-failure-review.md` has a matrix mapping v3/v4 toolbox failure categories to classification, owner work item, and required regression net (BDD, Vitest, WCP/browser integration, harness re-run, platform/web follow-up, or explicit deferral).
- TB-01 + TB-02 fixes green with new/extended BDD or Vitest without weakening assertions.
- TB-05: `npm test -w @finos/sail-desktop-agent` Cucumber raise-intent `@conformance2.2` scenarios green (including launch + validate paths).
- Harness toolbox re-run (TB-08): `getAppMetadata`, all `findIntent` deep-equal, and `findIntentsByContext` count scenarios pass; `AppTimeout` count reduced vs v3 baseline.
- Traceability map updated for ContextMetadata rows (TB-06/07).
- TB-09 delivered or explicitly deferred with sign-off note in this PRD.

## Architecture / implementation direction

0. **Blind-spot audit first** (TB-00) — before treating additional burn-down work as complete, classify each toolbox failure category as product bug, BDD assertion blind spot, MockTransport-vs-WCP integration blind spot, platform/web gap, harness/toolbox issue, or accepted deferral.
1. **Agent-only fixes first** (TB-01, TB-02) — high signal, no web changes; cite `app-handlers.ts` `convertDirectoryAppToAppMetadata`, `intent-helpers.ts` `createAppIntents` / `findIntentsByContext`.
2. **Instance-id contract** (TB-04) — `AppLauncher.launch()` returns `instanceId`; iframe `name` must match; WCP4 `createAppInstance` must not mint a unrelated UUID on first connect unless reconnect reuse succeeds. Harness already sets `name={instanceId}` (`packages/sail-conformance-harness/src/App.tsx`). Fix likely in `wcp-handlers.ts` + host pre-registration or WCP4 payload correlation — investigate before coding.
3. **BDD gap closure** (TB-05–07) — use `conformance-appd.json` fixture slices where toolbox asserts directory-specific `displayName` (e.g. `"A Testing Intent"`); MockTransport steps must use same instance id as launcher/open response.
4. **Acceptance** — manual toolbox inside Conformance1 at `http://localhost:3001`; compare to v3 report.

## BDD scenarios (product-level)

```text
# TB-01
Given chartApp is in the app directory but not running
When a connected app calls fdc3.getAppMetadata({ appId: "chartApp" })
Then the returned AppMetadata includes desktopAgent equal to implementationMetadata.provider

# TB-02
Given intent-a declares listensFor.aTestingIntent.displayName "A Testing Intent"
When a connected app calls fdc3.findIntent({ name: "aTestingIntent", ... })
Then appIntent.intent.displayName is "A Testing Intent" (not the intent name slug)

# TB-04 / TB-05
Given App1 raises an intent that launches portfolioApp via AppLauncher
When the launcher returns instanceId uuid-0 and the new iframe connects via WCP
Then WCP5 canonical instanceId is uuid-0 and the app can addIntentListener before intent delivery

# TB-07
Given App2 listens on a user channel
When App1 broadcasts context on that channel
Then App2 receives context with metadata including source and timestamp (ContextMetadata)
```

## Risks / unknowns

- TB-04 may require cross-origin workaround if conformance apps cannot send launcher id in WCP4 payload — severity TBD in spike.
- TB-03 overlap with in-flight PR #44 — merge order affects toolbox error-code failures.
- Toolbox run count varies (v3 ran ~60 vs v2 ~74 scenarios) — record exact export when baselining.

## Commands

```bash
nvm use 24
npm install
npm test -w @finos/sail-desktop-agent
npm run dev -w @finos/sail-conformance-harness   # port 3001
```

## Parent context summary

FINOS toolbox failures split into **agent library bugs** (metadata, intent discovery, error enums) and **real-browser WCP integration** (instance id lifecycle, multi-iframe delivery). The conformance harness removes sail-web UI variables; remaining failures are not harness chrome. Cucumber is largely green on MockTransport but **does not assert** toolbox-checked fields and **fails** on launch+validate instance correlation — fix that path before trusting BDD alone.

## Suggested vertical slices

| ID | Kind | Work item slug |
|----|------|----------------|
| TB-00 | task | `conformance-bdd-blind-spot-audit` |
| TB-01 | task | `fix-app-metadata-desktop-agent-field` |
| TB-02 | task | `fix-intent-discovery-displayname-dedupe` |
| TB-03 | task | `fdc3-error-enum-boundary-tests` (existing) |
| TB-04 | spike | `investigate-launcher-wcp-instance-id` |
| TB-04b | task | `bind-host-instance-id-at-wcp4` (after spike) |
| TB-05 | task | `fix-cucumber-raise-intent-launch-correlation` |
| TB-06 | task | `toolbox-bdd-metadata-assertions` |
| TB-07 | task | `context-metadata-conformance-bdd` |
| TB-08 | task | `harness-toolbox-rerun-baseline` |
| TB-09 | task | `bdd-wcp-integration-scenario` (existing) |

## PRD accuracy gate (2026-05-31 / v3-pre)

| ID | Classification | Evidence | Work item slug |
|----|----------------|----------|----------------|
| TB-00 | task | verified-gap: BDD scenarios were conformance-area aligned but not always toolbox-oracle equivalent; no per-category owner/regression-net matrix exists | conformance-bdd-blind-spot-audit |
| TB-01 | task | verified-gap: `app-handlers.ts:232` `desktopAgent: instanceId ? provider : undefined` | fix-app-metadata-desktop-agent-field |
| TB-02 | task | verified-gap: `intent-helpers.ts:243,331` `displayName: intentName`; v2/v3 findIntent deep-equal failures | fix-intent-discovery-displayname-dedupe |
| TB-03 | task | verified-gap: v3 raiseIntent throws — `NoAppsFound` vs `IntentDeliveryFailed`; PR #44 in flight | fdc3-error-enum-boundary-tests |
| TB-04 | spike | verified-red: Cucumber `uuid-0` validate; v3 AppTimeout cluster; cross-origin `window.name` in `wcp1-3-handshake.ts` | investigate-launcher-wcp-instance-id |
| TB-04b | task | depends on TB-04 spike outcome | bind-host-instance-id-at-wcp4 |
| TB-05 | task | verified-red: raise-intent.feature 3 failures / `Did not find app instance uuid-0` | fix-cucumber-raise-intent-launch-correlation |
| TB-06 | task | verified-gap: `apps.feature` / `find-intent.feature` omit `desktopAgent` and conformance displayName | toolbox-bdd-metadata-assertions |
| TB-07 | task | verified-gap: traceability map — no ContextMetadata scenario | context-metadata-conformance-bdd |
| TB-08 | task | verified-gap: v3 report exists; harness README documents attribution | harness-toolbox-rerun-baseline |
| TB-09 | task | verified-gap: traceability map WCP row partial; item approved not delivered | bdd-wcp-integration-scenario |

## Workflow

- Profile: repo default (`stage_only`, `plans.version_in_git: true`, `integration_branch: v3-pre`).
- Epic parent: `toolbox-conformance-burn-down` coordinates TB-01–TB-09 delivery order.
