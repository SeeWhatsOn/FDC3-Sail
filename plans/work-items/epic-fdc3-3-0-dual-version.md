---
title: "FDC3 3.0 dual-version support (epic)"
slug: epic-fdc3-3-0-dual-version
kind: epic
type: feature
status: draft
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

Land incremental FDC3 3.0 on Sail's single DACP handler tree while keeping 2.2 conformance green and documenting when integrators should advertise `"2.2"` vs `"3.0"`.

## User or system context

Sail reports `fdc3Version: "2.2"` today. `closeRequest` / `@conformance3.0` close BDD exists. Remaining 3.0 work is wire-forward metadata, channel metadata APIs, types strategy, BDD expansion, and docs — not a second codebase. **2.2 toolbox burn-down** (`epic-toolbox-conformance-v5-follow-up`) must not regress while this epic lands.

## Reference docs

- `plans/prd-fdc3-3-0-dual-version-support.md`
- `AGENTS.md` (dual-version policy, `@conformance2.2` / `@conformance3.0`)
- `packages/sail-desktop-agent/src/core/sail-default-config.ts`
- `conformance-test-failure-review.md`

## Parent context

PRD F30-00. One agent supports both 2.2 and 3.0 via wire-forward handlers + configurable advertised version. npm `3.0.0-pre.x` ≠ FDC3 spec level. Do not split `handlers/v2` vs `v3`. GetInfo2 / open-with-context failures stay on the v5 2.2 track until teardown lands.

## Child work items

| Slug | Kind | MoSCoW | Depends on | Status |
|------|------|--------|------------|--------|
| `audit-fdc3-3-0-handler-delta` | spike | Must | — | draft |
| `add-fdc3-3-0-local-types-and-dep-upgrade` | task | Must | audit | draft |
| `wire-open-request-context-metadata` | task | Must | audit, types | draft |
| `wire-broadcast-intent-metadata-3-0` | task | Must | audit, types | draft |
| `add-fdc3-3-0-channel-metadata-apis` | task | Should | audit, types | draft |
| `expand-conformance3-0-bdd-coverage` | task | Should | wire-* , channel APIs | draft |
| `configurable-fdc3-version-advertisement` | task | Must | audit | draft |
| `document-fdc3-2-2-3-0-dual-version` | task | Should | audit | draft |
| `record-fdc3-3-0-toolbox-baseline` | task | Could | expand BDD, FINOS 3.x client | draft |

**Parallel track (no duplicate items):** `epic-toolbox-conformance-v5-follow-up` — finish TV5-01 teardown before attributing open-with-context to 3.0.

**Suggested order:** audit → types → open/broadcast wire (parallel) → channel APIs → BDD expansion → version config + docs → 3.0 toolbox baseline when `@finos/fdc3` 3.x ships.

## Out of scope

- Per-app FDC3 version negotiation
- Removing 2.2 support or `@conformance2.2` BDD
- `@experimental` security enforcement (first wave)
- sail-web (:3000) 3.0 before harness (:3001) proof

## TypeScript interfaces

none

## Test guidance

Targeted Vitest/Cucumber per child; manual 2.2 toolbox at :3001 must stay ≥ v5 pass rate while Must-have children land.

## Blocked decisions

_(empty)_

## Loop history

_(empty)_

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
