# Post-Approve Git Flow

Run only after the human replies `approve` at the review gate (`waiting_on_user`
or legacy `staged`).

Read resolved automation tier from `ww-workflow-config`.

## Tier: `stage_only`

1. Do **not** commit, push, or open PR.
2. Leave implementation staged or unstaged per human preference; report `git status`.
3. Set `status: waiting_on_user` (or keep `staged`) — **not** `done`.
4. Tell human to merge/commit manually; suggest `/ww-reconcile` after merge.

## Tier: `commit_push`

1. Collect learnings; commit approved files on work item branch.
2. Include `plans/work-items/<slug>.md` when `repo.plans.version_in_git`.
3. Push to origin.
4. Set `status: committed`.
5. If `squash_to_integration`: checkout integration branch, squash merge, run checks.
6. Do **not** set `done` until merge is confirmed (`/ww-reconcile` or human).

## Tier: `draft_pr`

1. Same as `commit_push` (commit + push + plans if configured).
2. Create or update **draft** PR (`base` = `repo.delivery.pr_base_branch`).
3. Set `pr_url` in work item frontmatter; `status: pr_awaiting`.
4. `/ww-reconcile` sets `done` when PR is **MERGED**.

## All tiers

- Do not commit before human `approve`.
- Do not push unless tier requires it or human asked.
- Run final project checks before commit when tier commits.
- On failure after push, stop and report; do not set `done`.
