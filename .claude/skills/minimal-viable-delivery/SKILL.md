---
name: minimal-viable-delivery
description: Runs lightweight end-to-end delivery from intent refinement through plan, implementation, risk-based testing, verification, and review. Use when building a minimal viable feature or fix, breaking vague work into deliverable slices, avoiding over-engineering, or looping on review until the result is simple, correct, and good enough to continue from.
---

# Minimal Viable Delivery

## Purpose

Deliver the smallest useful version of the requested work that is correct enough to trust, simple enough to understand, and reviewed against the plan. Clarify intent only as much as needed, plan meaningful slices, implement one slice at a time, test by risk, review, then either fix, stop, or plan the next slice.

This is a lightweight alternative to full spec, PRD, or epic workflows. Use the bigger workflows only when the work needs durable product documentation, multiple stakeholders, formal approval gates, coordinated epics, or production hardening as the primary goal.

## When To Use

Use this skill when:

- The user wants to take an idea from vague ask to working code.
- The request is vague enough that intent, success, or constraints need refinement.
- A feature or fix should be broken into small but meaningful implementation slices.
- The agent may be tempted to over-engineer architecture, folder structure, abstractions, or tests.
- The goal is workable minimal viable code, then review and iterate.
- The user wants enough testing and review to avoid obvious bugs, not 100% coverage or final-form architecture.

Do not use it for obvious one-line fixes, mechanical edits, formatting, or pure information requests.

Non-trivial means multi-file work, cross-boundary behavior, risky logic, persistence, security, concurrency, UI flows that need runtime verification, or work likely to resume later.

Example user prompts:

- "Use minimal viable delivery to build this feature."
- "Take this vague idea through MVP delivery."
- "Resume `.cursor/plans/add-import-flow.md` and continue the next slice."

## Delivery Loop

```text
Clarify intent
  -> define minimal viable outcome
  -> plan useful slices
  -> choose risk-based tests
  -> implement one slice
  -> verify
  -> review against the plan
  -> fix or adjust
  -> continue, stop, or ask the user
```

Keep the loop small. If review/fix fails three times, stop and ask the user whether to reduce scope, change the plan, accept a known limitation, or switch to a fuller workflow.

### 1. Clarify Intent Lightly

If user, outcome, success, constraint, or out-of-scope boundaries are unclear, use the `interview-me` pattern:

```text
HYPOTHESIS: <one sentence describing what the user probably wants>
CONFIDENCE: ~<number>%

Q: <one focused question>
GUESS: <your best guess and why>
```

Ask one question at a time. Stop when you can restate the intent clearly enough that the user can confirm or correct it.

Use this restate:

```markdown
Here's what I think we are building:

- Outcome: <smallest useful result>
- User: <who benefits>
- Success: <how we know it worked>
- Constraint: <binding limit: time, risk, codebase shape, dependency, UX, etc.>
- Out of scope: <what we are not doing yet>

Yes / no / refine?
```

Do not proceed from ambiguous intent to a detailed plan.

### 2. Define The Minimal Viable Outcome

Before listing tasks, answer:

- What already exists that we can reuse?
- What is the simplest thing that could work?
- What can wait until after review?
- What would be harmful to omit because it could cause bugs, data loss, race conditions, security issues, or confusing UX?

Prefer deletion, reuse, standard library, native platform features, and installed dependencies before writing new code. Add no new dependency unless it clearly beats a small local solution.

### 3. Choose Simple Architecture And Code Shape

Default to code that is easy to follow in one pass:

- Prefer functions and small modules over classes.
- Use a class only when a top-level consumer API benefits from one.
- Keep class methods thin; push behavior into testable functions where useful.
- Avoid abstractions until duplication or complexity is real.
- Keep folder structure boring and flow-oriented.
- Name files, functions, and types so a new reader can skim the system quickly.
- Add comments only for intent, tradeoffs, or non-obvious constraints; do not comment what the code already says.

If complexity is necessary, make it visible in the plan. For larger or brittle flows, include a short README note or Mermaid diagram only when it would materially improve onboarding or review.

### 4. Split Into Deliverable Slices

Create a small number of tasks, not tiny chores. Each task should be deliverable in one focused session and leave the system working.

Prefer vertical slices when possible:

```text
Good: User can create one useful item end-to-end.
Avoid: Build all models, then all APIs, then all UI.
```

Break a task down further only when:

- It has multiple independent outcomes.
- It touches unrelated subsystems.
- It cannot be verified with one clear check.
- It feels brittle, risky, security-sensitive, data-sensitive, or likely to hide a race condition.
- The task title needs "and" to describe it.

### 5. Plan Tests By Risk

Do not chase 100% coverage. Test enough to make the change trustworthy.

Use this decision guide:

- Pure logic, branching, parsing, validation, transforms, calculations: add focused unit tests.
- Bug fix: add a reproduction test that fails before the fix when practical.
- Composite behavior crossing modules, storage, APIs, filesystem, browser runtime, concurrency, or external boundaries: add one integration test for the important path.
- Critical browser/user flow: add runtime verification or an E2E test only when unit/integration tests would not prove the behavior.
- Trivial glue, display-only markup, config, or code already covered by a higher-level test: no new test required.

Prefer state/output assertions over implementation-detail mocks. Use real implementations or fakes before mocks unless the real dependency is slow, flaky, expensive, or side-effectful.

### 6. Produce The MVP Delivery Plan

Use this format:

```markdown
# Minimal Viable Delivery Plan: <name>

Status: planning | implementing | verifying | reviewing | blocked | done
Current slice: <number or title>
Review/fix loops: <0-3>

## Intent

- Outcome:
- User:
- Success:
- Constraint:
- Out of scope:

## Simplicity Bias

- Reuse:
- Avoid:
- Architecture:

## Slices

1. <slice title>
   - Goal:
   - Acceptance:
   - Verify:
   - Likely files:

2. <slice title>
   - Goal:
   - Acceptance:
   - Verify:
   - Likely files:

## Test Plan

- Unit:
- Integration:
- Manual/runtime:
- Not testing:

## Review Plan

- Main-agent checks:
- Fresh-context review:
- Loop limit:

## Risks

- <risk or "None obvious">:
```

Keep the plan short. If it grows large, split the work or switch to a fuller planning/spec workflow.

### 7. Persist The Plan Only When Useful

For tiny changes, keep the plan in chat. For non-trivial MVP deliveries, handoffs across sessions, multi-slice work, or review loops, save one lightweight plan/checkpoint file in the current project's `.cursor/plans/` folder. Create the folder if it does not exist:

```text
.cursor/plans/<short-slug>.md
```

Use one file per MVP delivery. If a relevant plan file already exists, read and update it instead of creating a new one or restarting from chat memory. Update the file with slice status, verification notes, review findings, parked follow-ups, and known limitations. Do not create many work-item files unless the user asks to switch to a heavier workflow.

If implementation shows the plan is stale or wrong, update the plan before continuing. Do not let code drift away from the written intent and then document the drift afterward.

Persisted plan files should use the same plan format above plus lightweight checkpoint sections:

```markdown
## Slice Checkpoints

- [ ] <slice>: working | verified | reviewed | blocked

## Verification Notes

- <command/manual check>: <result>

## Review Notes

- Required:
- Follow-up:
- Ignore for MVP:

## Parked Follow-ups

- <deferred improvement and why>

## Known Limitations

- <accepted limitation or "None">
```

### 8. Implement One Slice

When the user approves the plan:

1. Implement one slice at a time.
2. Keep each change focused and reversible.
3. Write or update only the tests justified by the risk plan.
4. Run the smallest meaningful verification after each slice.
5. Stop and simplify if the code starts needing speculative abstractions.
6. Note useful follow-up improvements without building them unless the user asks.

Keep implementation in the main agent by default. The main agent owns user intent, the plan, code edits, ordinary test runs, and obvious fixes.

Each slice is done only when it is working, verified, reviewed, and its follow-ups or known limitations are parked in the plan or summary.

If the implementation starts adding polish, abstractions, dependencies, broad tests, or extra files, pause and ask: "Is this required for MVP, or should it be a follow-up?"

### 9. Verify And Review

After each non-trivial slice, review the result against the approved plan:

- Does it satisfy the stated outcome and success criteria?
- Did it stay inside out-of-scope boundaries?
- Does the diff contain only the intended slice plus justified tests/docs?
- Is the implementation simpler than the obvious alternatives?
- Are abstractions, classes, folders, dependencies, and tests justified by current risk?
- Are there missing tests only where bugs, boundaries, or brittle logic make them useful?
- Are follow-up improvements better left as follow-up instead of included now?

Use `code-review-and-quality` or a `code-reviewer` subagent for non-trivial changes. Review must be plan-bound: do not request production hardening, broad refactors, extra abstraction, or coverage increases unless they are required to meet the plan or prevent a real bug.

Categorize review findings as:

- Required: blocks the slice because it misses the plan, introduces real bug risk, weakens safety, or makes the code hard to reason about.
- Follow-up: useful improvement, polish, hardening, or refactor that should not block the MVP slice.
- Ignore for MVP: valid preference or optional idea that would expand scope without improving this delivery.

Suggested review prompt:

```text
Review this change against the Minimal Viable Delivery Plan.
Prioritize correctness, simplicity, YAGNI, readable flow, and risk-based testing.
Return findings only in these categories: Required, Follow-up, Ignore for MVP.
Flag Required only for issues that prevent the slice from meeting the plan,
create real bug risk, weaken safety, or make the code unnecessarily hard to
understand. Treat production hardening, extra abstraction, and broad refactors
as Follow-up unless required now.
```

### 10. Use Subagents Selectively

Default to the main agent. Spawn a fresh-context subagent when independence is worth the overhead:

- Review subagent: recommended for non-trivial changes, cross-boundary behavior, concurrency, data loss risk, security-sensitive code, or after a failed review/fix loop.
- Testing/verifier subagent: useful for non-trivial test design, flaky failures, integration-heavy checks, browser/runtime verification, or when the test should be designed without implementation bias.
- Security reviewer: use for auth, permissions, secrets, user input, external data, payments, destructive actions, or sensitive storage.

Do not spawn subagents for tiny, obvious slices. When using a subagent, pass the approved plan, changed files, verification already run, and the exact review focus.

### 11. Loop Or Stop

Use this loop:

```text
Implement -> verify -> review -> fix -> verify -> review
```

Repeat up to three times. If the same slice still fails review or verification, stop and ask the user whether to:

- reduce scope,
- change the plan,
- accept a known limitation,
- split the slice,
- or switch to a fuller planning/debugging workflow.

Stop on success when the MVP outcome is met. Do not continue into hardening, polish, extra slices, or architecture cleanup unless the user asks.

After a clean slice, check the diff for unrelated changes, give the user a concise checkpoint summary, and park follow-ups instead of silently folding them into scope. If the user asked for commits, create an atomic commit only after the slice verifies cleanly.

## Simplicity Rules

1. Build the smallest useful thing, not the imagined final system.
2. Prefer functions, plain data, and local flow over classes and frameworks.
3. Use a class only when it makes the top-level consumer API clearer.
4. Add no dependency unless reuse, standard library, native platform, or installed packages are worse.
5. Write tests because risk justifies them, not because coverage anxiety does.
6. Keep follow-up hardening out of the current slice unless correctness, safety, or data integrity requires it now.

## MVP Quality Floor

Minimal viable does not permit known data loss, security holes, race conditions, broken error handling at trust boundaries, inaccessible critical user paths, or behavior that contradicts the approved plan. If one of these appears, fix it in the current slice or return to the user with the tradeoff.

## Human Gates

Keep human gates lightweight:

- Confirm intent and plan before non-trivial implementation.
- Check in after each clean slice when scope, risk, or review findings changed.
- Ask before expanding scope, adding dependencies, changing architecture, or accepting known limitations.
- Stop after repeated failed loops rather than grinding indefinitely.

## Context Refresh

For long-running work, after context compaction, after a session resume, or after two completed slices, re-read this skill and the current `.cursor/plans/<slug>.md` before continuing. Use the plan as the source of truth; update it if reality changed.

## Handoff Summary

When finishing or pausing, report:

```markdown
## Delivery Summary

- Completed:
- Verified:
- Review result:
- Follow-ups parked:
- Known limitations:
- Next recommended slice:
```

## Red Flags

- Planning work the user did not ask for yet.
- Building generalized architecture before the first concrete use case works.
- Adding a folder hierarchy that is harder to follow than the feature flow.
- Writing tests because of coverage anxiety rather than risk.
- Skipping tests for brittle logic, concurrency, storage, security, or cross-boundary behavior.
- Treating reviewer suggestions as mandatory when they are production polish outside the MVP plan.
- Continuing into hardening after the MVP success criteria are already met.
- Leaving unrelated diff noise in the slice.
- Creating an epic, PRD, ADR, or diagram when a short plan would be enough.
- Accepting "scalable", "robust", or "clean" as goals without asking what they mean for this task.
- Continuing past three failed review/fix loops without returning to the user.
- Continuing from a stale plan after the implementation has changed the actual scope.
- Letting "minimal" justify known correctness, security, data integrity, or accessibility failures.

## Verification

Before implementation, confirm:

- [ ] Intent is clear or the user explicitly accepted the restate.
- [ ] The plan names the minimal viable outcome.
- [ ] Each slice is independently useful or clearly foundational.
- [ ] The test plan is risk-based, not coverage-driven.
- [ ] The architecture favors simple, readable, functional code.
- [ ] The review plan says when to use main-agent review vs fresh-context subagents.
- [ ] Out-of-scope work is explicit.
- [ ] Existing `.cursor/plans/` state was checked when resuming non-trivial work.
- [ ] Saved plans include status, current slice, and review/fix loop count.

Before completion, confirm:

- [ ] Implemented slices meet the approved plan.
- [ ] Required verification passed or limitations are documented.
- [ ] Review findings are resolved, deferred with reason, or returned to the user.
- [ ] Follow-up improvements were not silently folded into MVP scope.
- [ ] The final diff contains no unrelated changes.
- [ ] The plan/checkpoint file is updated when one was created.
