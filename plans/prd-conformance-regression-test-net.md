# PRD: Conformance regression test net (v6 gap closure)

## Persona / user

- **Conformance engineer** closing the gap between green CI (idealized `DacpTestAppConnection` / injected WCP4) and red FINOS toolbox rows on `:3001`.
- **Desktop-agent maintainer** picking up agent-side regressions without re-triaging v6 from scratch.

## Goal / outcome

Add headless Vitest regression coverage for toolbox failure signatures that existing Cucumber and WCP integration tests miss — especially **open-with-context 20s Mocha hangs**, **WCP4 first-connect identity**, **silent pending cleanup on source disconnect**, and **harness popup/registry correlation**. Success is new tests green on `v3-pre`, manual v7 toolbox shows open-with-context rows settle at ~15s `AppTimeout` or pass (not 20s hang), and close-context cluster stays down after harness fixes land.

## Relationship to other plans

| Prior plan | Status | This PRD |
|------------|--------|----------|
| `plans/prd-toolbox-conformance-v5-follow-up.md` (TV5-01–05) | active | Complements TV5-01 teardown + TV5-02 channel delivery; does **not** replace blocked findIntent oracle |
| v6 export `conformance-report-v6.txt` | baseline | Target attribution for new tests |
| `fix-harness-finOs-session-teardown` | waiting_on_user | Harness close-context + adoption fixes may land in parallel; regression net validates they stay fixed |

## Evidence summary (v6 vs v5)

| Metric | v5 | v6 |
|--------|----|----|
| Pass / fail | 53 / 49 | 53 / **26** |
| Close-context | 26 | **~4** |
| Open-with-context 20s hang | 3 | **3** (still failing) |
| `findInstances` id mismatch | — | 1 |
| `findIntent` apps.length 2 vs 1 | inflated | 1 (may be stale session) |

**Root cause class (tests miss today):** Cucumber `sends validate` always supplies `instanceId` + `instanceUuid` + `wcpSourceWindow`; `wcp-desktop-agent.integration.test.ts` uses the same idealized WCP4; harness spike covers open **without** context only; `cleanup.test.ts` asserts **no** `openResponse` error when source disconnects during pending open (codifies silent hang).

## In scope

| ID | Summary | Kind | Work item slug | Depends on |
|----|---------|------|----------------|------------|
| RT-00 | Epic coordinating regression net | epic | `epic-conformance-regression-test-net` | — |
| RT-01 | Reject pending open-with-context when source disconnects | task | `reject-pending-open-on-source-disconnect` | — |
| RT-02 | WCP integration: first-connect open-with-context (realistic WCP4) | task | `wcp-first-connect-open-with-context-integration` | RT-01 |
| RT-03 | Multi-pending + `hostIdentifier` adoption regression | task | `wcp-multi-pending-host-identifier-adoption` | RT-02 |
| RT-04 | Harness headless open-with-context regression spike | task | `harness-open-with-context-regression-tests` | RT-02 |
| RT-05 | Harness popup re-key + close lifecycle tests | task | `harness-popup-remap-close-lifecycle-tests` | — |
| RT-06 | Session soak: stale CONNECTED instance + second open | task | `wcp-session-soak-stale-instance-regression` | RT-03 |
| RT-07 | Disable harness heartbeat (match Cucumber default) | task | `disable-harness-heartbeat-for-toolbox` | — |

## Optional (lower priority — create work items when RT-01–05 are green)

| ID | Summary | Slug |
|----|---------|------|
| RT-08 | MetadataApp / GetInfo2-shaped open-with-context integration | `wcp-metadata-app-open-with-context-regression` |
| RT-09 | Cucumber `@wcp-first-connect` step variant | `cucumber-wcp-first-connect-step-variant` |
| RT-10 | Playwright smoke against `:3001` | defer — heavy flake; only if headless net still misses toolbox |

## Out of scope

- `getResultMetadata` empty client path (4 v6 rows) — separate agent/client work
- `desktopAgent` on AppMetadata (2 rows)
- findIntent `apps.length` oracle (`fix-findintent-raise-intent-oracle`) — blocked FINOS policy
- 61s intent result Mocha timeouts — timeout budget tuning
- sail-web full-stack (:3000)

## Success criteria

- RT-01–05: targeted Vitest green; `npm test -w @finos/sail-desktop-agent` and `npm test -w @finos/sail-conformance-harness` pass.
- Manual toolbox v7: 3× `AOpensBWithContext*` pass or fail with agent `AppTimeout` (~15s), not 20s Mocha hang.
- RT-06: soak test documents expected behavior when stale instances remain CONNECTED.
- Traceability: one row added to `website/docs/packages/desktop-agent/conformance.md` when RT-02 lands (optional docs slice in RT-02 delivery).

## Suggested delivery order

```text
RT-01 → RT-02 → RT-03 ─┐
         └→ RT-04       ├→ RT-06
RT-05 (parallel)         │
RT-07 (parallel)         └→ manual v7 toolbox
```

## Commands

```bash
nvm use 24
npx vp test run -w @finos/sail-desktop-agent -- src/handlers/__tests__/cleanup.test.ts src/app-connection/__tests__/wcp-desktop-agent.integration.test.ts
npm test -w @finos/sail-conformance-harness
npm run dev -w @finos/sail-conformance-harness   # :3001 manual toolbox
```

## Work item retention

Delivered work item `.md` files are **deleted** after human approve; record slugs here.

_(empty — planning 2026-06-22)_
