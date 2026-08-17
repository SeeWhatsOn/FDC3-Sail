---
name: work-item-management
description: >
  How to read, write, and update local markdown work items produced
  from PRDs. Use when creating descriptive work items, updating
  delivery state, routing review verdicts, surfacing blocked decisions,
  staging for human review, extracting learnings, or moving work to
  dead-letter.
metadata:
  author: Chris Watson
---

# Work Item Management

> **Watson workflow:** Prefer `ww-work-items` as the canonical skill. It
> includes `kind: task | spike | epic`, draft validation by kind, and
> integration with `/ww-plan` and `/ww-deliver`. This skill remains for
> teams not using the full WW flow. Planning shape: `ww-planning-stack`.

Local markdown work items are the durable source of truth for this
workflow. They are not GitHub Issues or Jira tickets, so do not invent
tracker-style IDs. Use descriptive filenames and titles. External tracker
numbers only appear when the work item is actually backed by that
external tracker.

Every state change must be written to the work item immediately.
Never assume current state; read the file first.

## Directory Structure

```text
plans/
  prd-example-workload.md
  work-items/
    add-context-broadcast-handler.md
    resolve-order-race-condition.md
  completed-work-items/
    resolve-order-race-condition.md   # status: done — archived from work-items/
  dead-letter/
    add-context-broadcast-handler.md

AGENTS.md
```

## Local Persistence And Commit Policy

`plans/` is local workflow state for the agent and human while a PRD
workload is active. It should persist across work items, branches, and
the selected integration branch until the full workload is complete.

Do not add `plans/` to `.gitignore` automatically. Some repositories
may choose to version planning artifacts later, and changing ignore
policy is a project decision.

By default, do not stage or commit `plans/` artifacts. Implementation
commits should include only source files, tests, product docs intended
for the PR, and human-approved durable learning updates.

Durable learning belongs in `AGENTS.md` through the continual-learning
plugin. Work-item notes and loop history can remain in `plans/` as local
execution state until the workload is complete.

After all work items in the workload are `done`, ask the human whether
to delete or archive `plans/` artifacts. Do not remove them earlier
unless explicitly asked.

## Canonical Work Item Format

Use this section order for local work items:

```markdown
---
title: "Short imperative title"
slug: short-descriptive-slug
type: feature # feature | bug | chore
status: draft # human approval changes this to approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - src/path/to/file.ts
  - tests/path/to/file.test.ts
depends_on: []
integration_branch: ""
branch: feature/short-descriptive-slug
external_tracker: "" # empty unless backed by GitHub/Jira/etc.
---

## Goal

One sentence. What does this deliver and why does it matter?

## User or system context

Who benefits, what system behaviour changes, and what normal developer
needs to understand before starting.

## Reference docs

Links or paths to the PRD, parent epic when applicable, ADRs, README,
AGENTS.md sections, or source files relevant to this work item.

## Parent context

Short PRD or epic excerpt that explains how this work item fits the whole
system. Keep this concise so delivery agents do not need the full PRD.

## Behavior spec

Given [context]
When [action]
Then [observable outcome]

Repeat for every behavior change, including edge cases.

## Out of scope

- Item

## TypeScript interfaces

Relevant interfaces, or "none".

## Test guidance

High-level guidance for the RED phase. Do not prescribe exact test code
unless the PRD explicitly requires a particular test level.

Docs-only slices (markdown-only `file_manifest`, no runtime/API change):
start with `Docs-only: no executable RED phase.` — see
`ww-work-items/references/docs-only-work-items.md`. Never prescribe
Vitest/Cucumber or documentation contract tests for `.md` files.

## Blocked decisions

Questions raised by delivery agents and answered by the human.

## Loop history

Delivery retries after review failures.

## Staged for review

Evidence written when tests pass and changes are staged for human review.

## Escalation notes

Written when `loop_count >= loop_limit`.

## Learnings extracted

Patterns discovered during delivery and proposed for durable learning.
```

## Status Lifecycle

```text
draft
  -> approved       human approved this work item for delivery
       -> in-progress
            -> blocked     waiting for human decision
            -> staged      tests green, changes staged, human review needed
                 -> done   human approved and commit completed
                 -> in-progress  human requested changes
            -> escalated   loop_count >= loop_limit
```

The PRD breakdown workflow may create `draft` work items. Only human
approval changes them to `approved`. The delivery workflow only starts
items with `status: approved`.

Only the delivery orchestrator changes delivery status after approval.
The PRD breakdown orchestrator creates and revises draft work items.

Do not persist a transient `loop` status. Keep the work item
`in-progress` and record retries in `## Loop history`.

## Archive on done

When `status` becomes `done`, move the file to `plans/completed-work-items/`.
See `ww-work-items/references/archive-on-done.md` (canonical procedure).

## Project Health Check

Before PRD breakdown or delivery, check for:

```text
Required files:
  AGENTS.md
  package.json with test, typecheck, and lint scripts
  tsconfig.json
  prettier config
  eslint config

Required directories:
  plans/
  plans/work-items/
  plans/completed-work-items/   # create on first archive if missing
  plans/dead-letter/
```

If any are missing, stop and report exactly what is missing. Do not
create project infrastructure unless the human explicitly asks.

## Test Command Detection

Read `package.json` scripts. Required defaults:

- `npm test`
- `npm run typecheck`
- `npm run lint`

Prefer project-specific commands documented in `AGENTS.md`. If focused
test syntax is unclear, run the full test command rather than guessing.

## Blocked Decision Procedure

When any delivery subagent reports ambiguity:

1. Write the question under `## Blocked decisions`.
2. Set `status: blocked`.
3. Surface the question to the human.
4. Use the answer as temporary context for this work item.
5. Propose any durable convention to `AGENTS.md` through the
   continual-learning plugin; do not write directly unless the plugin
   or human explicitly approves.
6. Set `status: in-progress` and resume delivery.

## Staged For Review Procedure

When verification and review pass:

1. Confirm role isolation evidence exists for test, implementation,
   verification, and review phases.
2. Run the final project test command.
3. Write `## Staged for review` with RED evidence, commands run, files
   changed, phase audit, and diff summary.
4. Set `status: staged`.
5. Stage only implementation files from `file_manifest`, tests, product
   docs intended for the PR, and human-approved `AGENTS.md` updates.
   Do not stage `plans/` artifacts by default.
6. Present the staged summary to the human.
7. Wait for `approve`, `changes [note]`, or `skip`.

Do not commit before explicit human approval.

## Typed Verdict Routing

Reviewers must end with exactly one verdict:

```text
VERDICT: PASS
VERDICT: FAIL: test-gap
VERDICT: FAIL: implementation
```

- `PASS`: stage for human review.
- `FAIL: test-gap`: increment `loop_count`, append loop history, route
  to the test engineer.
- `FAIL: implementation`: increment `loop_count`, append loop history,
  route to the implementer.

Increment `loop_count` on reviewer FAIL verdicts. Do not increment for
implementation retries, first verifier failures, or human-requested changes.

Verification failures route back to the implementer without incrementing
`loop_count` once per distinct issue. If the same verification failure
repeats after an implementation retry, treat it as `FAIL: implementation`:
increment `loop_count`, append loop history, and route to the implementer.

## Escalation Procedure

When `loop_count >= loop_limit`:

1. Set `status: escalated`.
2. Run the project test command and capture the result.
3. Append escalation notes.
4. Move the work item to `plans/dead-letter/`.
5. Notify the human and continue with the next eligible work item.

## Learning Extraction

After human approval and commit:

1. Append work-item-specific notes to `## Learnings extracted`.
2. Use the continual-learning plugin to propose reusable project
   patterns as durable `AGENTS.md` updates.
3. Keep local work-item notes in `plans/` until the workload completes.
4. Do not write directly to `AGENTS.md` unless the continual-learning
   plugin or the human explicitly approves the change.
5. Do not bypass human review of standing rules.
