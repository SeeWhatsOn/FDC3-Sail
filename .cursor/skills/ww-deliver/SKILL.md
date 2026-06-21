---
name: ww-deliver-work-items
description: >
  Watson workflow delivery phase: deliver approved local markdown work
  items using isolated specialist subagents for RED tests, GREEN
  implementation, verification, and review. Use when delivering approved
  work items, running TDD delivery, or processing staged items.
  Keywords: ww, watson workflow, ww-deliver, approved work item, RED,
  GREEN, TDD, staged for review.
disable-model-invocation: true
metadata:
  author: watson
  workflow: ww
  phase: delivery
---

# WW Deliver Work Items

Delivery workflow for the Watson workflow. Invoked by `/ww-deliver`.

Run this workflow in the top-level agent. Do not launch an orchestrator
subagent. The top-level agent owns orchestration, state updates, human
gates, staging, commits, and learning extraction.

Use this command for delivery:

```text
/ww-deliver              # process all eligible approved work items
/ww-deliver <slug>       # process one approved work item
/ww-deliver --auto-until-review
/ww-deliver <slug> --auto-until-review
```

There is intentionally no separate singular command. The optional slug
handles the one-item case without adding another command name.

## Auto Until Review

`--auto-until-review` may run Phase A RED, Phase B GREEN, Phase C
verification, Phase D review, and optional Phase D.5 security without
pausing between phases.

It must still stop at the human review gate. It must not commit, squash,
merge, push, or modify `AGENTS.md` without explicit human `approve`.

## Orchestrator Skills

Load only these in the top-level agent:

- `ww-work-items`
- `context-engineering`
- `git-workflow-and-versioning`

After human `approve` only: `continual-learning`.

Do **not** load TDD, review, implement, or domain skills here — those
go in subagent briefs. See
[references/agent-skill-map.md](references/agent-skill-map.md) and
`ww-work-items` → Context Budget.

Discipline and domain skills load inside subagent contexts only (max 2
per phase). The conditional lists in older docs are routing menus, not
bundles.

## Delivery Startup Progress

Read and follow
[references/startup-checklist.md](references/startup-checklist.md).

Build the queue:

- with a slug: only that work item
- without a slug: all `plans/work-items/*.md` with `status: approved` and
  `kind` not `epic` (default `task` if `kind` omitted)

Order by dependencies and filename.

**Never deliver** `kind: epic`. If asked, deliver an approved child slug
instead.

Default to one human review gate per work item. `--auto-until-review`
may run unattended between delivery phases, but never past the human
review gate.

Follow `ww-work-items` → Local Persistence And Commit Policy for
`plans/` handling and post-workload cleanup.

## Subagent Launch

Personas live in `~/.cursor/agents/` (user scope). Read and follow
[references/subagent-launch.md](references/subagent-launch.md).

At delivery startup, probe whether this session accepts registered
custom subagents (`verifier-agent` → `PONG`). Record
`registered_subagents: yes|no` for the session.

## Required Phase Isolation

For each work item, launch separate specialist subagents:

- `test-engineer`: RED executable tests (generic — brief includes skill loads)
- `implement-agent`: minimum implementation; does not edit tests
- `verifier-agent`: read-only verification of checks, scope, and diff
- `code-reviewer`: typed review verdict (generic — brief includes skill loads)
- `security-auditor`: optional advisory audit when `tags` include `security`

Use the launch procedure in `subagent-launch.md`:

1. **Preferred:** `Task(subagent_type: "<specialist>", …)` when probe
   succeeded.
2. **If probe failed:** stop and report a blocker; ask the human to
   retry in a new session or add explicit `/name` delegation. Do not
   continue in the top-level context.
3. **Last resort:** only if the human explicitly approves — `generalPurpose`
   with the **full** agent file body from `~/.cursor/agents/` plus the
   phase prompt. Never use a one-line persona simulation.

Read [references/agent-skill-map.md](references/agent-skill-map.md) before
each launch. Compute UI surface per
[references/frontend-surface-detection.md](references/frontend-surface-detection.md)
before Phase B and D. Phase prompts live in
[references/phase-prompts.md](references/phase-prompts.md). Send the
matching block with fields filled in.

Record on every phase audit row: `Registered subagent: yes|no` and
`ui_surface: yes|no` (for phases B and D).

## Work Item Progress

For each eligible work item, track:

- [ ] Read work item; confirm `status: approved`
- [ ] Dependencies are `done`; otherwise defer
- [ ] Set `status: in-progress` and `last_agent: top-level-delivery-workflow`
- [ ] `integration_branch` and `branch` set
- [ ] Branch checked out or created from `integration_branch`
- [ ] Focused context loaded (`AGENTS.md`, reference docs, `file_manifest`)
- [ ] Docs-only check: if Test guidance starts with `Docs-only: no executable
  RED phase.`, skip Phase A per
  `ww-work-items/references/docs-only-work-items.md`
- [ ] Phase A: `test-engineer` launched → RED evidence + learnings captured
  (skip when docs-only)
- [ ] Phase B: `implement-agent` launched → tests green + learnings captured
- [ ] Phase C: `verifier-agent` launched → `VERIFICATION: PASS` + learnings captured
- [ ] Phase D: `code-reviewer` launched → `VERDICT: PASS` + learnings captured
- [ ] Phase D.5: `security-auditor` launched when `security` tag present
- [ ] **Pre-review validation gate** run by orchestrator (format, lint,
  typecheck, validate) — see
  [references/pre-review-validation.md](references/pre-review-validation.md)
- [ ] Staged-for-review procedure run (`ww-work-items`)
- [ ] Human responded: `approve` | `changes [note]` | `skip`
- [ ] On `approve`: learning extraction and commit completed

## Verdict Routing

Follow `ww-work-items` → Typed Verdict Routing and Escalation Procedure.
If Phase C verification fails, route the report back to `implement-agent`
before Phase D and do not increment `loop_count` once per distinct issue. If
the same Phase C failure repeats after an implementation retry, treat it as
`FAIL: implementation` and apply the loop limit. If Phase D returns
`FAIL: test-gap`, route back to Phase A. If Phase D returns
`FAIL: implementation`, route back to Phase B. Stop when `loop_count` reaches
`loop_limit`.

## Human Review Responses

When staged, present a concise summary with:

- work item title and slug
- test result
- **validation gate result** (format, lint, typecheck, validate — all PASS)
- RED evidence
- phase audit proving isolated subagents ran
- staged files
- learnings proposed (aggregated from subagent reports)

## Pre-Review Validation Gate

After Phase D passes and before staging, the **orchestrator** (not
subagents) must run the checks in
[references/pre-review-validation.md](references/pre-review-validation.md).

Required: format check, lint, typecheck, and full `validate` when the
project defines it. Re-run commands locally even if subagents reported
success. On any failure, route to `implement-agent` and do not present
the work item for human review until the gate passes.

Accept exactly:

- `approve`: run learning extraction from `ww-work-items`, include only
  human-approved `AGENTS.md` updates, then follow
  [references/post-approve-git.md](references/post-approve-git.md) according to
  the resolved **automation tier** (`ww-workflow-config`):
  - `stage_only`: do not commit; human merges manually; use `/ww-reconcile` or
    set `done` after merge
  - `commit_push`: commit, push, `status: committed`
  - `draft_pr`: commit, push, draft PR, `status: pr_awaiting` + `pr_url`
  Include `plans/` when `repo.plans.version_in_git` is true. Squash only if
  config `squash_to_integration` is true.
- `changes [note]`: unstage only this work item's files, set
  `status: in-progress`, route the note to `implement-agent`.
- `skip`: leave staged, keep `status: staged`, continue only if there
  is another eligible non-overlapping work item.

Do not commit before `approve`.

## Learning Extraction

Follow `ww-work-items` → Learnings Collection and Learning Extraction.
Subagents propose; orchestrator collects; human approves before
`AGENTS.md` changes commit.

## Post-Approve Git

After human `approve`, follow
[references/post-approve-git.md](references/post-approve-git.md). Do not
push unless the human explicitly asks.

## Completion Report

After processing the queue, report:

- done work items
- staged work items awaiting approval
- escalated work items in `plans/dead-letter/`
- total loops
- learnings proposed
- `AGENTS.md` updates proposed through continual learning
- whether local `plans/` artifacts should be deleted or archived

## What You Must Never Do

- Write tests yourself
- Write implementation yourself
- Perform verifier judgment yourself
- Author reviewer verdicts yourself
- Commit without explicit human approval
- Modify files outside `file_manifest` without stopping
- Change behavior specs during delivery
- Create fake tracker identifiers
- Write to `AGENTS.md` directly
- Continue past a failed health check
- Present staged work for human review before the pre-review validation
  gate passes (format, lint, typecheck, validate)

