---
title: "Audit conformance BDD blind spots"
slug: conformance-bdd-blind-spot-audit
kind: task
type: chore
status: done
loop_count: 0
loop_limit: 3
last_agent: "GPT-5.5"
file_manifest:
  - conformance-test-failure-review.md
  - packages/sail-desktop-agent/docs/conformance-traceability.md
  - plans/prd-toolbox-conformance-burn-down.md
  - plans/work-items/toolbox-conformance-burn-down.md
depends_on: []
integration_branch: v3-pre
branch: cursor/conformance-bdd-blind-spot-audit
pr_url: https://github.com/SeeWhatsOn/FDC3-Sail/pull/60
merged_pr: "https://github.com/SeeWhatsOn/FDC3-Sail/pull/60"
external_tracker: ""
tags: [fdc3]
---

## Goal

Create the missing control that explains why toolbox failures escaped the BDD suite and prevents the burn-down epic from closing until each failure category has the right regression owner.

## User or system context

The current queue contains product fixes and several BDD additions, but the blind-spot analysis is spread across PRD prose, individual work items, and traceability notes. The BDD scenarios were intended to be lifted from conformance testing, so the audit must distinguish "same API area" from "same toolbox oracle" and call out where MockTransport coverage cannot prove browser/WCP behavior.

## Reference docs

- `plans/prd-toolbox-conformance-burn-down.md`
- `conformance-test-failure-review.md`
- `conformance-report-v3.txt`
- `packages/sail-desktop-agent/docs/conformance-traceability.md`
- `plans/work-items/toolbox-bdd-metadata-assertions.md`
- `plans/work-items/context-metadata-conformance-bdd.md`
- `plans/work-items/bdd-wcp-integration-scenario.md`
- `plans/work-items/harness-toolbox-rerun-baseline.md`

## Parent context

From `plans/prd-toolbox-conformance-burn-down.md`: Cucumber `@conformance2.2` scenarios are largely green on MockTransport, while the FINOS toolbox still exposes metadata shape, error mapping, and browser/WCP launch failures. This item must be delivered before more burn-down work is treated as complete, so later fixes have an explicit regression target.

## Behavior spec

Given each failure category from the v3 toolbox report and failure review
When the audit is complete
Then `conformance-test-failure-review.md` contains a matrix classifying each category as product bug, BDD assertion blind spot, MockTransport-vs-WCP integration blind spot, platform/web gap, harness/toolbox issue, or accepted deferral

Given a failure category is non-deferred
When the matrix is updated
Then it names the owning work item and the required regression net: Cucumber BDD, Vitest handler test, WCP/browser integration test, harness re-run, or platform/web follow-up

Given a non-deferred failure category has no existing owner
When the audit is complete
Then the audit creates a draft follow-up work item, or updates an existing approved item, with the exact gap, expected assertion/path, and validation command needed to close it

Given `packages/sail-desktop-agent/docs/conformance-traceability.md` marks a row as covered
When the row depends on exact toolbox-checked fields or browser/WCP behavior
Then the audit either confirms the row asserts the same oracle/path or downgrades it to partial with an owner slug

Given an existing work item already owns an individual fix
When this audit references that failure
Then the audit does not duplicate the fix scope; it only records classification, owner, and regression-net expectations

## Overlap and boundaries

- `toolbox-bdd-metadata-assertions` owns BDD assertions for `desktopAgent` and directory intent `displayName`; this audit only verifies those failures are classified and linked.
- `context-metadata-conformance-bdd` owns MockTransport ContextMetadata scenarios; this audit decides whether those rows remain partial until WCP/harness evidence exists.
- `bdd-wcp-integration-scenario` owns the real WCPConnector regression path; this audit identifies which toolbox categories require that kind of test instead of MockTransport BDD.
- `fdc3-error-enum-boundary-tests` owns representative enum tests; this audit checks whether client-visible toolbox rejection paths need additional coverage.
- `harness-toolbox-rerun-baseline` owns the manual v4 run; this audit defines the matrix that the rerun must update.

## Out of scope

- Implementing product fixes.
- Implementing the individual BDD, Vitest, or WCP tests named by the matrix.
- Running the full FINOS toolbox.
- Creating a CI gate for the toolbox.

## TypeScript interfaces

none

## Test guidance

No executable tests are expected. Validate by reviewing the v3 report, the existing traceability map, and active work items. The deliverable should make it obvious which rows are covered by exact BDD assertions, which are only area-aligned, and which require browser/WCP or platform/web follow-up. Any uncovered non-deferred row must leave behind either an updated owner work item or a new draft follow-up work item.

## Blocked decisions

_(empty)_

## Loop history

- 2026-06-01: approved by human as the first burn-down item after identifying that conformance-lifted BDD covered API areas but not always toolbox oracles.
- 2026-06-01: delivery started; auditing toolbox failure categories against BDD traceability and work-item ownership.
- 2026-06-01: human approved staged delivery; committed and archived.

## Staged for review

### 2026-06-01

RED evidence:
- Source evidence reviewed: `conformance-report-v3.txt` (15 pass / 45 fail), `conformance-test-failure-review.md`, `packages/sail-desktop-agent/docs/conformance-traceability.md`, and active owner work items.
- Failure categories found: metadata field gaps, intent discovery shape/count gaps, resolve error-code gaps, open/findInstances/channel/raiseIntent WCP routing gaps, ContextMetadata assertion gaps, `GetInfo2` browser bootstrap timeout, platform/web resolver deferrals, and cross-origin correlation risk.
- No new work item needed: every non-deferred category maps to an existing owner.

Commands run:
- `git diff --check -- "conformance-test-failure-review.md" "packages/sail-desktop-agent/docs/conformance-traceability.md" "plans/work-items/bdd-wcp-integration-scenario.md" "plans/work-items/conformance-bdd-blind-spot-audit.md"` — passed
- `ReadLints` on edited markdown files — no linter errors

Files changed:
- `conformance-test-failure-review.md` — added v3 blind-spot matrix with classification, owner, and regression net per failure category.
- `packages/sail-desktop-agent/docs/conformance-traceability.md` — downgraded toolbox-sensitive rows from `covered` to `partial` with owner slugs where MockTransport coverage is not toolbox-equivalent.
- `plans/work-items/bdd-wcp-integration-scenario.md` — tightened scope to exact WCP/browser blind spots and updated dependency/validation guidance.
- `plans/work-items/conformance-bdd-blind-spot-audit.md` — recorded delivery status and staged evidence.

Phase audit:
- Test phase — Registered subagent: no; docs-only audit, no executable RED expected by item guidance.
- Implementation phase — Registered subagent: no; matrix/doc updates applied directly.
- Verification phase — Registered subagent: no; reviewed source evidence, `ReadLints`, and `git diff --check`.
- Review phase — Registered subagent: no; self-review confirmed all non-deferred categories have owner slugs and regression-net expectations.

Learnings proposed:
- _(none)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
