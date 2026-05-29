# Workflow config — first-run interview

Ask **one cluster at a time**; skip any field already in a partial config.

## 1. Repo file

Confirm writing `plans/workflow-config.yaml` to the repository (team defaults).

## 2. Integration branch

**GUESS:** `v3-pre` (or current branch from git).

## 3. Version plans in git?

When delivery commits code, should `plans/work-items/` and PRD files be committed too?

- **Yes** — queue state visible in PRs (recommended for this monorepo)
- **No** — plans stay local only

## 4. Default delivery automation

Pick default for **new deliveries** (workloads can override):

| Option | ID | Summary |
|--------|-----|---------|
| A | `stage_only` | Stage + update work items; **you** commit/PR |
| B | `commit_push` | On your `approve`, agent commits and pushes branch |
| C | `draft_pr` | On your `approve`, agent commits, pushes, opens **draft PR** |

## 5. Squash to integration branch?

After approve, squash-merge feature branch into `integration_branch`?

- **No** (default) — keep feature branch; you merge in GitHub
- **Yes** — agent squash-merges locally after checks

## 6. Branch name template

**GUESS:** `cursor/<descriptive-slug>-8a9f` for cloud agents.

## 7. Subagent probe at delivery?

Run verifier `PONG` probe before Phase A? **GUESS:** yes.

---

After answers, write `plans/workflow-config.yaml` per `plans/workflow-config.example.yaml`.

Optional: ask whether to create `plans/local/user-overrides.yaml` (explain gitignored personal overrides).
