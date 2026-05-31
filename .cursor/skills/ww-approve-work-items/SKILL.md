---
name: ww-approve-work-items
description: >
  Watson workflow approval phase: review draft work items, run validation,
  present human gates, and set status approved (or done/skip). Use when
  planning finished but /ww-deliver has an empty queue, when resuming after
  a break, or to batch-review plans/work-items before delivery. Keywords:
  ww, watson workflow, ww-approve, draft, approved, human gate.
disable-model-invocation: true
metadata:
  author: watson
  workflow: ww
  phase: approval
---

# WW Approve Work Items

Approval workflow for the Watson workflow. Invoked by `/ww-approve`.

This phase sits **between** `/ww-plan` and `/ww-deliver`:

```text
/ww-plan  →  draft work items
/ww-approve  →  approved work items   ← this skill
/ww-deliver  →  implementation
```

Run in the **top-level agent**. Do not write production code or executable
tests. Do not run RED/GREEN delivery subagents.

## Orchestrator skills

Load in order:

1. `ww-work-items`
2. `ww-approve-work-items` (this file)

Optional: `ww-planning-stack` when filtering by PRD or explaining order.

## What this phase does

- Builds an **approval queue** from `plans/work-items/*.md`
- Runs **draft validation** (`ww-work-items` → `validation-before-approve.md`)
- Presents each item using `ww-prd-breakdown` → `human-gate-template.md`
- On human **`approve`**, writes `status: approved` immediately
- On **`done`** (shipped elsewhere), writes `status: done`
- On **`skip`**, leaves `draft` and continues
- On **`revise [note]`**, updates draft and re-presents

## What this phase does not do

- Implement code or write executable tests
- Commit implementation (delivery staged gate only)
- Set `approved` without an explicit human reply per item
- Auto-approve entire queue unless human says **`approve all`** (see below)

## Startup

1. Health check (`ww-work-items` → Project Health Check).
2. Parse arguments — see [references/approval-queue.md](references/approval-queue.md).
3. Print **approval catalog** (summary table) before the first gate unless
   user passed `--catalog-only` (then stop after catalog).
4. Walk the queue in **dependency order** (topological sort; tie-break by slug).

## Approval catalog (always show first)

Before the first gate, print a table:

| # | Slug | Kind | Status | Depends on | Deliver? | PRD / track |
|---|------|------|--------|------------|----------|-------------|

- **Deliver?** — `yes` for `task`/`spike` (if spike is deliverable per item body);
  `no` for `epic`; `n/a` for `done`
- **PRD / track** — infer from `## Reference docs` or filename patterns
  (conformance P1, release P2, transport)

Include counts: `draft`, `approved`, `done`, `in-progress`, `staged`, etc.

Tell the human:

```text
Reply with:
  approve              — approve current item
  approve all          — approve every draft in this queue that passed validation
  approve <slug>       — jump to and approve that slug (after validation)
  done <slug>          — mark shipped (e.g. already merged)
  skip                 — leave draft, next item
  revise [note]        — fix draft, re-validate, re-present
  stop                 — end session (progress is saved in work item files)
```

## Per-item procedure

For each queued item:

1. Read the file; skip if not `status: draft` (unless `approve <slug>` targets it).
2. Run validation checklist; if fail, report failures and offer `revise` or `skip`.
3. Present human gate (full template for first item; compact summary optional
   for subsequent items if human said `approve all` is not in effect).
4. Wait for human reply (do not batch-approve without `approve all`).
5. Update frontmatter `status` and append a one-line note under
   `## Loop history` only if `revise` occurred: `- YYYY-MM-DD: approved by human`

Special case — **already shipped**:

If the human says `done <slug>` or item is clearly merged (e.g. P0 cleanup),
set `status: done` without `/ww-deliver`, then archive per
`ww-work-items/references/archive-on-done.md`.

## Handoff

When the human says `stop` or the queue is exhausted:

```text
Approved: [slugs]
Done (skipped delivery): [slugs]
Still draft: [slugs]
Skipped: [slugs]

Next: /ww-deliver
      /ww-deliver <slug>
```

## Integration with other commands

| Situation | Command |
|-----------|---------|
| Empty `/ww-deliver` queue | Run `/ww-approve` first |
| New PRD, no work items | `/ww-plan` (includes approval gates) |
| Resume mid-backlog | `/ww-approve` then `/ww-deliver` |
| One item only | `/ww-approve <slug>` |

Update cross-links when editing: `ww-planning-stack`, `ww-prd-breakdown` handoff,
`ww-deliver-work-items` startup (suggest `/ww-approve` when queue empty).

## Progress checklist

- [ ] Catalog printed
- [ ] Queue validated (deps exist, no epic in deliver queue)
- [ ] Each presented item passed validation
- [ ] Only explicit human replies changed status
- [ ] Handoff report with `/ww-deliver` pointer
