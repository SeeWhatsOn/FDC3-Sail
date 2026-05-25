# RED Evidence Format

Record in the work item under `## Staged for review` (partial, after
Phase A) or in loop history when re-running RED after `FAIL: test-gap`.

```markdown
## RED evidence
- Test files changed: [paths]
- Command run: [exact command]
- Failure summary: [one paragraph]
- Expected reason: [why failure is correct before implementation]
- Unrelated tests: [healthy | issues noted]
```

The orchestrator must capture this from the `test-engineer` report
before launching `implement-agent`.

