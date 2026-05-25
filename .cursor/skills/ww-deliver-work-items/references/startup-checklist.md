# Delivery Startup Checklist

Run at the start of every `/ww-deliver` invocation.

Progress:

- [ ] Health check passed (`ww-work-items`)
- [ ] Subagent probe passed ([subagent-launch.md](subagent-launch.md))
  - [ ] `Task(subagent_type: "verifier-agent")` → `PONG`
  - [ ] Session flag recorded: `registered_subagents: yes|no`
  - [ ] Human told probe result
- [ ] Integration branch chosen and recorded on work items
- [ ] Queue built (slug filter or all `status: approved`)
- [ ] Queue validated:
  - [ ] Every `depends_on` slug exists
  - [ ] No circular dependencies
  - [ ] Overlapping `file_manifest` entries are sequenced, not parallel
- [ ] Human told queue order and count

If queue validation fails, stop and report the problem. Do not start
delivery until the queue is valid.

Integration branch prompt:

```text
1. current branch: [current-branch]
2. main
3. new branch: [enter name]
```

Recommend the current branch. Do not assume `main`. Do not push unless
the human explicitly asks.

