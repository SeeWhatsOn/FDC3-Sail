# Delivery Startup Checklist

Run at the start of every `/ww-deliver` invocation.

Progress:

- [ ] **Workflow config** loaded (`ww-workflow-config`); interview run if missing
- [ ] `/ww-reconcile` suggested or run when `pr_awaiting` items exist
- [ ] Health check passed (`ww-work-items`)
- [ ] Subagent probe passed ([subagent-launch.md](subagent-launch.md)) when config says so
  - [ ] `Task(subagent_type: "verifier-agent")` → `PONG`
  - [ ] Session flag recorded: `registered_subagents: yes|no`
  - [ ] Human told probe result
- [ ] Integration branch from config + work items
- [ ] Queue built (slug filter or all `status: approved`)
- [ ] Queue validated:
  - [ ] No `kind: epic` items in queue
  - [ ] Every `depends_on` slug is `done` (in `plans/completed-work-items/`) or absent
  - [ ] No circular dependencies
  - [ ] Overlapping `file_manifest` entries sequenced, not parallel
- [ ] Human told queue order, count, and active **automation tier**
- [ ] **Queue bookkeeping:** update each slug `status` on every transition;
  use extended lifecycle (`staged` → `waiting_on_user` → `committed` /
  `pr_awaiting` → `done` + archive to `plans/completed-work-items/`). After external
  merge, run `/ww-reconcile` or set `done` and archive per
  `ww-work-items/references/archive-on-done.md`.

If queue validation fails, stop and report the problem.

## Automation tier (from config)

| Tier | After review PASS |
|------|-------------------|
| `stage_only` | `waiting_on_user`; stage files; no commit |
| `commit_push` | wait for `approve` → commit + push → `committed` |
| `draft_pr` | wait for `approve` → commit + push + draft PR → `pr_awaiting` |

Do not commit or open PR before human `approve` unless the human delegated
that in the same message.
