# Local workflow overrides (optional)

Create `user-overrides.yaml` here to override **personal** preferences without
committing them. This directory is gitignored.

```yaml
version: 1
repo:
  delivery:
    default_automation: commit_push
```

Repo defaults live in `plans/workflow-config.yaml`. Per-workload overrides
belong in the `workloads:` section of either file.
