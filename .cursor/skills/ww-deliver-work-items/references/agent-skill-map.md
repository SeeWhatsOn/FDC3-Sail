# Agent And Skill Map

The top-level delivery orchestrator owns Watson workflow state. Generic
subagents stay unmodified — pass the skill-load line and WW context in
each task brief.

Personas are user-scoped in `~/.cursor/agents/`. Before Phase A, run
the session probe and launch procedure in
[subagent-launch.md](subagent-launch.md).

Follow [context-budget.md](../../ww-work-items/references/context-budget.md).

Read [work-item-tags.md](../../ww-work-items/references/work-item-tags.md)
to resolve optional domain skills from work item `tags`.

Before Phase B and Phase D, compute UI surface per
[frontend-surface-detection.md](frontend-surface-detection.md). Pass
[human-review-comments.md](human-review-comments.md) in Phase B and D briefs.

Collect learnings per
[learnings-proposed-format.md](../../ww-work-items/references/learnings-proposed-format.md).

## Generic subagents (do not modify)

| Phase | Subagent | Tell subagent to load | Orchestrator passes |
|-------|----------|----------------------|---------------------|
| A RED | `test-engineer` | `test-driven-development` (max 1) | Work item slice, RED + learnings footer |
| D Review | `code-reviewer` | See **Phase D skills** below | Work item slice, diff summary, verdict contract, learnings footer, UI checklist when applicable |
| D.5 Security | `security-auditor` | `security-and-hardening` (max 1) | Work item slice, diff summary; only when `security` tag |

### Phase D skills

| Condition | Skills (max 2) | Extra brief content |
|-----------|----------------|---------------------|
| `ui_surface: yes` | `code-review-and-quality`, `frontend-ui-engineering` | Paste [frontend-review-checklist.md](frontend-review-checklist.md) |
| `ui_surface: no` | `code-review-and-quality` | — |

## WW-owned subagents (brief only)

| Phase | Subagent | Tell subagent to load | Orchestrator passes |
|-------|----------|----------------------|---------------------|
| B GREEN | `implement-agent` | See **Phase B skills** below | Work item slice, RED tests, manifest, learnings footer |
| C Verify | `verifier-agent` | **None — do not load skills** | Inline [verification-checklist.md](../../ww-work-items/references/verification-checklist.md), learnings footer |

### Phase B skills

| Condition | Skills (max 2) |
|-----------|----------------|
| `ui_surface: yes` | `incremental-implementation`, `frontend-ui-engineering` |
| `ui_surface: no` | `incremental-implementation` + max one domain skill from tags (table below) |

Domain skill for `implement-agent` when `ui_surface: no` (pick at most one from tags):

| Tag | Skill |
|-----|-------|
| `ui` | `frontend-ui-engineering` |
| `api` | `api-and-interface-design` |
| `fdc3` | `fdc3-expert` |
| `security` | `security-and-hardening` |
| `perf` | `performance-optimization` |
| `migration` | `deprecation-and-migration` |

Add `source-driven-development` only for an unfamiliar library. Add
`debugging-and-error-recovery` only on loop-back.

## Orchestrator-only skills

- `ww-work-items`
- `ww-deliver-work-items`
- `context-engineering`
- `git-workflow-and-versioning`
- `doubt-driven-development` (blocked decisions / escalation only)
- `continual-learning` (after human `approve` only)

