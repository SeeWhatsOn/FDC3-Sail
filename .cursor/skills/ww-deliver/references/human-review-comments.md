# Human Review Comments

Require during Phase B (`implement-agent`) and check in Phase D
(`code-reviewer`) for any non-trivial change, especially integration /
wiring code.

## Source rules (pass to implement-agent)

From project `AGENTS.md` → TypeScript And Code Style:

- Add comments where they explain **intent**, **constraints**, **edge
  cases**, or **Bloomberg/FDC3 domain assumptions**
- Do **not** comment obvious mechanics
- Optimize for **human review**

From `implement-agent` → Human-readable comments:

- JSDoc on exported APIs when purpose is not obvious from the signature
- Inline/block comments before non-obvious business rules, branching,
  state transitions, **integration boundaries**, retries, timing
  assumptions
- Explain **why**, not what

## Minimum bar for delivery

For each **new or substantially changed** file in `file_manifest`:

| File kind | Minimum comments |
|-----------|------------------|
| Integration / wiring (`demo/`, `main.tsx`, adapters) | Section headers or block comments at each layer boundary (FDC3 → mapping → connector → diagnostics) |
| UI components with non-obvious state | Comment on subscription/lifecycle and why state is shaped this way |
| Pure helpers / one-liners | Only if non-obvious; skip noise |

## Implement-agent report footer

Add to every Phase B report:

```text
### Comment coverage
- [file]: [what a human learns at a glance from comments — or "needs comments"]
```

## Code-reviewer gate

When reviewing integration or UI wiring files, **Important** if:

- A reader cannot tell layer flow or async timing without reading every line
- Effect/subscription/lifecycle code has no comment on cleanup or why

Missing comments alone does not block PASS for trivial diffs; block PASS
when missing comments hide non-obvious integration or lifecycle behaviour.

