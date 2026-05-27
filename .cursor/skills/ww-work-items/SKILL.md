---
name: ww-work-items
description: >
  Watson workflow library for local markdown work items produced from
  PRDs. Use when creating descriptive work items, validating drafts
  before approval, updating delivery state, routing review verdicts,
  surfacing blocked decisions, staging for human review, extracting
  learnings, or moving work to dead-letter. For planning shape (PRD vs
  optional epic vs work item), load ww-planning-stack. Keywords: ww, watson workflow,
  work item, plans/work-items, BDD, Given/When/Then, status lifecycle.
metadata:
  author: watson
  workflow: ww
  phase: library
---

# WW Work Items

Local markdown work items are the durable source of truth for the Watson
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

Shared repositories may opt into committing PRD or work-item artifacts,
but that must be an explicit human decision for the repo or workload.

Durable learning belongs in `AGENTS.md` through the continual-learning
plugin. Work-item notes and loop history can remain in `plans/` as local
execution state until the workload is complete.

After all work items in the workload are `done`, ask the human whether
to delete or archive `plans/` artifacts. Do not remove them earlier
unless explicitly asked.

## Context Budget

Orchestrator and subagent load limits are in
[references/context-budget.md](references/context-budget.md).

## Work Item Kinds

`kind: task | spike | epic` controls deliverability. See
[references/work-item-kinds.md](references/work-item-kinds.md).

- **task** — default; `/ww-deliver` when `status: approved`
- **spike** — investigate first; deliver only when fix phase is spec'd
- **epic** — parent only; never `/ww-deliver`; children are separate files

## Canonical Work Item Format

Use the section order in
[references/work-item-template.md](references/work-item-template.md).

Optional `tags` route domain skills during delivery. See
[references/work-item-tags.md](references/work-item-tags.md).

RED evidence format for delivery Phase A is in
[references/red-evidence-format.md](references/red-evidence-format.md).

## Work Item Tags

Optional frontmatter `tags` route domain skills and optional security
audit during delivery. See
[references/work-item-tags.md](references/work-item-tags.md).

## Draft Validation Before Approval

Before presenting a draft work item for human `approve`, read and run
[references/validation-before-approve.md](references/validation-before-approve.md).

If any checklist item fails, fix the draft and re-run validation. Do not
present the human gate until all boxes pass.

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

The planning workflow (`/ww-plan`) may create `draft` work items. Only
human approval changes them to `approved`. The delivery workflow
(`/ww-deliver`) only starts items with `status: approved`.

Only the delivery orchestrator changes delivery status after approval.
The planning orchestrator creates and revises draft work items.

Do not persist a transient `loop` status. Keep the work item
`in-progress` and record retries in `## Loop history`.

## Project Health Check

Before `/ww-plan` or `/ww-deliver`, check for:

```text
Hard requirements:
  AGENTS.md
  package.json with a test script or AGENTS.md command override

Hard directories:
  plans/
  plans/work-items/
  plans/dead-letter/

TypeScript project requirements, when applicable:
  tsconfig.json
  prettier config
  eslint config
  typecheck and lint scripts or AGENTS.md command overrides
```

If any are missing, stop and report exactly what is missing. Do not
create project infrastructure unless the human explicitly asks. For
non-TypeScript repos, use `AGENTS.md` to define equivalent checks.

## Test Command Detection

Read and follow
[references/package-manager-detection.md](references/package-manager-detection.md).

Prefer project-specific commands documented in `AGENTS.md`. If focused
test syntax is unclear, run the full test command rather than guessing.

## Blocked Decision Procedure

When an implementation agent reports ambiguity:

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
   changed, phase audit (including `Registered subagent: yes|no` per
   phase — see `ww-deliver-work-items` → `subagent-launch.md`), diff
   summary, and **Learnings proposed**
   (aggregated from subagent reports — see Learnings Collection).
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

Increment `loop_count` only on reviewer FAIL verdicts. Do not increment
for implementation retries, verifier failures, or human-requested
changes.

Verification failures route back to the implementer without incrementing
`loop_count`. Test command failures during implementation stay with the
implementer unless the reviewer later classifies the failure as
`FAIL: test-gap`.

When `loop_count >= loop_limit`, run the escalation procedure below.

Do not persist a `loop` status. Keep the work item `in-progress` and
record retries in `## Loop history`.

## Escalation Procedure

When `loop_count >= loop_limit`:

1. Set `status: escalated`.
2. Run the project test command and capture the result.
3. Append escalation notes.
4. Move the work item to `plans/dead-letter/`.
5. Notify the human and continue with the next eligible work item.

## Learnings Collection

Subagents surface learnings in their report footer. The orchestrator
collects them — subagents do not write `AGENTS.md` or work items.

Format and flow: [references/learnings-proposed-format.md](references/learnings-proposed-format.md).

After each subagent returns, copy any `[AGENTS.md candidate]` lines into
orchestrator notes for the current work item.

## Learning Extraction

After human `approve` and before the final work-item commit:

1. Append all collected `[AGENTS.md candidate]` lines to
   `## Learnings extracted` on the work item.
2. Load `continual-learning` and delegate collected candidates to
   `agents-memory-updater` for durable `AGENTS.md` proposals.
3. Present proposed `AGENTS.md` changes to the human before they are
   committed.
4. Keep local work-item notes in `plans/` until the workload completes.
5. Do not write directly to `AGENTS.md` unless continual-learning or the
   human explicitly approves.

