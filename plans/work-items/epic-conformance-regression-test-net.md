---
title: "Conformance regression test net (epic)"
slug: epic-conformance-regression-test-net
kind: epic
type: feature
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest: []
depends_on: []
integration_branch: v3-pre
branch: ""
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Close the measured gap between green headless CI and red FINOS toolbox v6 rows by adding Vitest regression nets for realistic WCP4 first-connect, open-with-context promise settlement, harness popup identity correlation, and session soak — without waiting on full Playwright toolbox port.

## User or system context

v6 improved close-context (26 → ~4) but **3 open-with-context scenarios still hit 20s Mocha timeout** (pending open never settles). Existing tests use idealized WCP4 payloads and one cleanup test asserts silent pending drop on source disconnect. Another developer should be able to deliver RT-01–07 in dependency order without re-reading the full triage thread.

## Reference docs

- `plans/prd-conformance-regression-test-net.md`
- `packages/sail-conformance-harness/results/conformance-report-v6.txt`
- `packages/sail-conformance-harness/results/conformance-test-failure-review.md`
- `website/docs/packages/desktop-agent/conformance.md` (WCP browser path partial)
- `AGENTS.md` (WCP4 adoption, `InMemoryTransport` / `vi.waitFor` conventions)

## Parent context

Sibling to `epic-toolbox-conformance-v5-follow-up` (TV5-01 teardown, TV5-02 channel delivery). Regression net **validates** harness/agent fixes and prevents reintroduction of 20s hang signature. Product fixes in RT-01 may be required before RT-02 tests go green.

## Child work items

| Slug | Kind | Status | Depends on | Notes |
|------|------|--------|------------|-------|
| `reject-pending-open-on-source-disconnect` | task | approved | — | RT-01 — product fix + test flip |
| `wcp-first-connect-open-with-context-integration` | task | approved | RT-01 | RT-02 — core integration net |
| `wcp-multi-pending-host-identifier-adoption` | task | approved | RT-02 | RT-03 — stale session adoption |
| `harness-open-with-context-regression-tests` | task | approved | RT-02 | RT-04 — harness spike |
| `harness-popup-remap-close-lifecycle-tests` | task | approved | — | RT-05 — parallel with RT-02 |
| `wcp-session-soak-stale-instance-regression` | task | approved | RT-03 | RT-06 — late-pack soak |
| `disable-harness-heartbeat-for-toolbox` | task | approved | — | RT-07 — config guard |

**Suggested order:** RT-01 → RT-02 → (RT-03 + RT-04 parallel) → RT-05 + RT-07 anytime → RT-06 → manual v7 toolbox.

**Optional (not filed yet):** `wcp-metadata-app-open-with-context-regression`, `cucumber-wcp-first-connect-step-variant`, Playwright `:3001` smoke.

## Out of scope

- findIntent oracle (`fix-findintent-raise-intent-oracle`)
- Metadata client `getResultMetadata` rows
- CI toolbox gate
- Playwright full toolbox port (RT-10 defer)

## TypeScript interfaces

none (test + small handler changes only)

## Test guidance

Per-child `## Test guidance`. Epic acceptance: all child tasks `done`; manual v7 export saved as `conformance-report-v7.txt`; open-with-context rows not 20s hang.

## Blocked decisions

_(empty)_

## Loop history

- 2026-06-22: approved by human (batch approve all RT-00–07)

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
