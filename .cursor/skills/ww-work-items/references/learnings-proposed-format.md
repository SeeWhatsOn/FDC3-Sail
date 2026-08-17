# Learnings Proposed Format

Subagents surface learnings; the orchestrator collects and persists them.
Subagents do not write `AGENTS.md` or work item files.

## Subagent report footer

Every delivery subagent should end with:

```text
## Learnings proposed
- [AGENTS.md candidate] <reusable pattern> — <why it generalizes>
```

Use `none` when nothing reusable was discovered.

Examples:

```text
## Learnings proposed
- [AGENTS.md candidate] Use happy-dom for RTL component tests in this repo — jsdom breaks Vitest workers on Node 22
```

```text
## Learnings proposed
- none
```

Phases most likely to propose learnings: `implement-agent`, then
`code-reviewer`, then `test-engineer`.

## Orchestrator collection

After each subagent returns:

1. Copy any `[AGENTS.md candidate]` lines into orchestrator notes for
   this work item.
2. When staging for review, include aggregated learnings in the human
   summary under **Learnings proposed**.
3. On human `approve`:
   - Append all collected lines to work item `## Learnings extracted`
   - Load `continual-learning` and pass collected candidates to
     `agents-memory-updater` for durable `AGENTS.md` proposals
   - Present proposed `AGENTS.md` changes to the human before commit
     includes them

Blocked decisions answered by the human may also become learnings —
orchestrator adds those when resuming delivery.

