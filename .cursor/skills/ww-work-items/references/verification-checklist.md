# Verification Checklist

Inline checklist for Phase C briefs. Do not load `ww-deliver-work-items`
or `ww-work-items` in the verifier context.

1. Read work item Goal and Behavior spec.
2. Inspect git diff.
3. Confirm all modified files are in `file_manifest`.
4. Confirm tests were not weakened, skipped, or rewritten to fit code.
5. Run project checks from `AGENTS.md` or
   [package-manager-detection.md](package-manager-detection.md).

6. Confirm implementation report matches actual command output.

End with exactly one line:

```text
VERIFICATION: PASS
```

or

```text
VERIFICATION: FAIL
Reason: [specific reason]
Route to: [implement-agent | top-level-delivery-workflow]
```

Optional — if you notice a reusable project pattern:

```text
## Learnings proposed
- [AGENTS.md candidate] [one line] — or "none"
```

Do not write to `AGENTS.md` or work item files.

