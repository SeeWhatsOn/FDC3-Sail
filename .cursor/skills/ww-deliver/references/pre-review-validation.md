# Pre-Review Validation Gate

**Orchestrator-owned.** The top-level delivery agent runs this gate after
Phase D `VERDICT: PASS` and **before** the staged-for-review procedure.
Do not skip it or delegate it to subagents.

Subagent reports are not sufficient — re-run commands locally and capture
fresh output before presenting to the human.

## When to run

- After Phase D review passes for a work item
- Before writing `## Staged for review`, staging files, or presenting the
  human review summary
- Again after a `changes [note]` loop-back once Phase D passes again

Do not present staged work to the human while any required check is failing.

## Resolve commands

1. Prefer explicit commands in `AGENTS.md` (Key commands section).
2. Otherwise follow
   [package-manager-detection.md](../../ww-work-items/references/package-manager-detection.md).
3. Read root `package.json` scripts when present.

Typical mapping for this repo:

| Check | Command |
|-------|---------|
| Format (check) | `npm run format` |
| Format (fix) | `npm run format:fix` (only when check fails) |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Full validate | `npm run validate` |

When a `validate` script exists, run it as the final gate. It subsumes
format, lint, typecheck, build, and tests for projects that define it that
way — still run the individual format/lint/typecheck steps first when they
fail fast and produce clearer errors.

## Required sequence

Run from the repository root (or the work item's documented package root):

1. **Format check** — `<pm> run format`
2. **Lint** — `<pm> run lint`
3. **Typecheck** — `<pm> run typecheck`
4. **Validate** — `<pm> run validate` when the script exists

If format check fails and `<pm> run format:fix` exists, run the fix script,
re-run format check, then continue the sequence.

Record exact commands and pass/fail summary in `## Staged for review`.

## On failure

Do **not** stage or ask the human to review broken code.

1. Capture stderr/stdout from the failing command.
2. Route to `implement-agent` with the failure output and affected paths.
3. Re-run Phase C and Phase D after implementation fixes.
4. Re-run this entire gate from step 1.

Treat lint, format, and typecheck failures the same as test failures.

## Focused vs full checks

During implementation loops (Phase B retry), subagents may run focused tests
only. This gate always runs the **project-wide** format, lint, typecheck, and
validate commands — not package-scoped shortcuts — unless `AGENTS.md`
documents a narrower pre-review command set.

## Human review summary

Include in the staged summary:

- Validation gate: PASS or FAIL (must be PASS before presenting)
- Commands run (exact strings)
- One-line result per command
