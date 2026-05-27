# Phase Subagent Prompts

When launching each subagent, read
[agent-skill-map.md](agent-skill-map.md) and send the matching block.
Pass a **work item slice** plus concise parent context. Include Goal,
Parent context, Behavior spec, Test guidance, tags, and file_manifest; do
not pass the full PRD unless a subagent reports ambiguity that cannot be
resolved from the slice.

Every subagent report must end with `## Learnings proposed` per
[learnings-proposed-format.md](../../ww-work-items/references/learnings-proposed-format.md).

## Phase A: RED Tests (`test-engineer`)

```text
SKILLS TO LOAD:
- test-driven-development

WORK ITEM (Goal, Parent context, Behavior spec, Test guidance, tags only):
[paste slice]

TASK: Turn the behavior spec into failing executable tests. Do not
inspect implementation internals. You may read public exports, types,
documented entrypoints, and existing test patterns. No production code.

Return RED evidence:
- Test files changed: [paths]
- Command run: [exact command]
- Failure summary: [one paragraph]
- Expected reason: [why failure is correct]
- Unrelated tests: [healthy | issues noted]

## Learnings proposed
- [AGENTS.md candidate] ... — or "none"
```

Record RED evidence in the work item before Phase B.

## Phase B: GREEN Implementation (`implement-agent`)

Before launching, compute `ui_surface` per
[frontend-surface-detection.md](frontend-surface-detection.md).

**When `ui_surface: yes`:**

```text
SKILLS TO LOAD:
- incremental-implementation
- frontend-ui-engineering
```

**When `ui_surface: no`:** pick max one domain skill from tags
([work-item-tags.md](../../ww-work-items/references/work-item-tags.md)).

```text
SKILLS TO LOAD:
- incremental-implementation
[optional: one domain skill from tags]
```

```text
UI SURFACE: [yes|no] — [matching files if yes]
RED TESTS: [test files and names]
WORK ITEM (Goal, Parent context, Behavior spec, Test guidance, tags only): [paste slice]
FILE MANIFEST: [from frontmatter]
PROJECT CONTEXT: [relevant AGENTS.md sections only — MUST include
TypeScript And Code Style comment rules and human-review guidance]
COMMENT REQUIREMENTS: [paste human-review-comments.md minimum bar]
REFERENCE DOCS: [from work item]
PREVIOUS REVIEW FEEDBACK: [if loop-back]

TASK: Make RED tests pass with minimum code. Do not modify tests. Only
touch file_manifest. Surface blocked decisions if AGENTS.md is silent.

When UI SURFACE is yes: use ref (not useState) for long-lived instances;
return effect cleanups for subscriptions; follow frontend-ui-engineering.

Add human-review comments per COMMENT REQUIREMENTS and implement-agent
Human-readable comments section. Include ### Comment coverage in report.

Return full test, typecheck, and lint output.

## Learnings proposed
- [AGENTS.md candidate] ... — or "none"
```

## Phase C: Verification (`verifier-agent`)

```text
DO NOT LOAD SKILLS. Use this checklist only.

WORK ITEM (Goal, Parent context, Behavior spec, file_manifest only): [paste slice]
FILE MANIFEST: [from frontmatter]
IMPLEMENTATION REPORT: [from implement-agent]

CHECKLIST:
1. Diff files ⊆ file_manifest
2. Tests not weakened or skipped
3. Run checks from verification-checklist.md / package-manager-detection.md
4. Report matches actual output

End with exactly one line: VERIFICATION: PASS or VERIFICATION: FAIL

## Learnings proposed
- [AGENTS.md candidate] ... — or "none"
```

## Phase D: Review (`code-reviewer`)

Before launching, compute `ui_surface` per
[frontend-surface-detection.md](frontend-surface-detection.md).

**When `ui_surface: yes`:**

```text
SKILLS TO LOAD:
- code-review-and-quality
- frontend-ui-engineering

UI SURFACE FILES: [list]
FRONTEND REVIEW CHECKLIST (apply all matching sections):
[paste frontend-review-checklist.md]
```

**When `ui_surface: no`:**

```text
SKILLS TO LOAD:
- code-review-and-quality
```

```text
WORK ITEM (Goal, Parent context, Behavior spec only): [paste slice]
DIFF SUMMARY: [files + one-line purpose]
VERIFICATION: [PASS line from verifier]
UI SURFACE: [yes|no]

TASK: Review against behavior spec. Read only. When UI SURFACE is yes,
run the frontend checklist — hook/effect leaks block PASS.

Apply [human-review-comments.md](human-review-comments.md) for integration,
wiring, and lifecycle code. Flag missing intent comments as Important
when they hide non-obvious flow.

Final line must be:
VERDICT: PASS | VERDICT: FAIL: test-gap | VERDICT: FAIL: implementation

## Learnings proposed
- [AGENTS.md candidate] ... — or "none"
```

## Phase D.5: Security (optional, `security-auditor`)

Only when `tags` include `security`.

```text
SKILLS TO LOAD:
- security-and-hardening

WORK ITEM (Goal, tags only): [paste slice]
DIFF SUMMARY: [files changed]

TASK: Read-only security audit. No VERDICT. Report Critical / Important /
Suggestion findings.

## Learnings proposed
- [AGENTS.md candidate] ... — or "none"
```

