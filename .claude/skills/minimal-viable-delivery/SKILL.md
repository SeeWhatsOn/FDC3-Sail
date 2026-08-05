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
- The user wants enough testing and review to avoid obvious bugs, not 100% coverage or final-form architecture.

Do not use it for obvious one-line fixes, mechanical edits, formatting, or pure information requests.

Non-trivial means multi-file work, cross-boundary behavior, risky logic, persistence, security, concurrency, UI flows that need runtime verification, or work likely to resume later.

Example: "Resume `.cursor/plans/add-import-flow.md` and continue the next slice."

## Control Loop

Read this section first. It and the MVP Quality Floor are the mechanism; steps 0-11 are their detail.

```text
Clarify intent
  -> define minimal viable outcome
  -> plan useful slices + bind the verify command
  -> choose risk-based tests
  -> implement one slice
  -> verify
  -> review against the plan
  -> fix or adjust
  -> continue, stop, or ask the user
```

### Gates

These phases each emit one artifact. Do not enter a phase until the previous phase's artifact exists.

| Phase | Artifact it emits | Gate it opens |
|---|---|---|
| 1. Clarify intent | Restate block the user confirmed | No plan from ambiguous intent |
| 2-3. Minimal outcome | Reuse findings, chosen code shape | No slices before knowing what already exists |
| 4-6. Plan | Slice list, each with a literal verify command | No edits without an approved plan |
| 8.1-8.3 Implement | One slice's diff | No second slice while the first is unverified |
| 8.4 Verify | Command plus exit status under Verification Notes | No review of an unverified slice |
| 9. Review | Findings split Required / Follow-up / Ignore for MVP | No "done" while a Required is open |

Steps 7, 10, and 11 are support, not gates: persist, delegate, and decide as needed.

When you notice you are past a gate whose artifact does not exist, stop, say which one you skipped, and produce it before continuing. Do not backfill it afterward to make the record look right.

Update the plan file's `Status:` as each gate opens, so a resumed session can tell where the loop stopped. Step 0 creates the file before gate 1, so it always exists.

### Loop and stop rule

The failure counter is **per slice**, not per delivery.

- A slice **fails** when its verify command exits non-zero on a slice you believed complete, or review returns one or more `Required` findings. A test you deliberately wrote to fail first is not a slice failure — the slice is not claimed complete yet.
- On failure: fix, re-verify, re-review, and increment that slice's counter.
- On a clean verify **and** a review with no `Required`: the slice passes and its counter resets to 0.
- At **3 failures on the same slice**: stop. Do not start a fourth attempt. Ask the user whether to reduce scope, change the plan, accept a known limitation, split the slice, or switch to a fuller workflow.

A new slice starts a new counter at 0.

### 0. Resume Or Start

Do this on entry, before answering the user.

1. Look in `.cursor/plans/` for a plan matching this request. Create the folder if it does not exist.
2. **Found one:** read it. Resume at its `Status:`, current slice, and slice-failure count. The file wins over anything you remember or infer from the conversation.
3. **None:** create `.cursor/plans/<short-slug>.md` from the step 6 template with `Status: clarifying` and its sections empty.

The plan file is the state, and it is not optional — one file per delivery. Every phase reads it on entry and writes its artifact into it before exiting, so "gate not open" means "that section is still empty". That is a check you can run, which is the whole point of the gates.

Re-read this skill and the plan file after context compaction, after a session resume, and after every second completed slice.

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

"What already exists" is a search job. When the answer spans more than a couple of files or you do not know the naming conventions, delegate it to a read-only search subagent per step 10 and keep the main agent's context for the plan. Answer it inline only when you already know where to look.

Prefer deletion, reuse, standard library, native platform features, and installed dependencies before writing new code. Add no new dependency unless it clearly beats a small local solution.

### 3. Choose Simple Architecture And Code Shape

If the repo has its own minimality or code-shape skill, that skill wins and this section is the fallback. Check for one before applying the defaults below, and name the winner in the plan's Simplicity Bias section.

Default to code that is easy to follow in one pass:

- Prefer functions and small modules over classes.
- Use a class only when a top-level consumer API benefits from one.
- Keep class methods thin; push behavior into testable functions where useful.
- Avoid abstractions until duplication or complexity is real.
- Keep folder structure boring and flow-oriented. Boring means predictable, not flattened — do not collapse existing module boundaries to save files.
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

First, bind the verify command. This skill is repo-agnostic, so the plan carries what the repo cannot be assumed to provide:

- Find the repo's actual test, typecheck, lint, or build commands from its package manifest, task runner config, CI config, or contributor docs.
- Write them into the plan as literal, runnable strings — `pnpm test path/to/file.test.ts`, not "run the tests".
- If nothing runnable exists, say so in the plan and name the manual check instead. Do not leave verification undefined.

Then use this format:

```markdown
# Minimal Viable Delivery Plan: <name>

Status: clarifying | scoping | planning | implementing | verifying | reviewing | blocked | done
Current slice: <number or title>

## Intent

- Outcome:
- User:
- Success:
- Constraint:
- Out of scope:

## Verify Commands

- Full: <literal command, or "none — manual check only">
- Focused: <literal command for a single file or suite>
- Typecheck/lint: <literal command, or "none">

## Simplicity Bias

- Policy: <repo-local minimality skill, or "MVP defaults">
- Reuse:
- Avoid:
- Architecture:

## Slices

1. <slice title>
   - Goal:
   - Acceptance:
   - Verify: <literal command to run for this slice>
   - Likely files:

2. <slice title>
   - Goal:
   - Acceptance:
   - Verify: <literal command to run for this slice>
   - Likely files:

## Test Plan

- Unit:
- Integration:
- Manual/runtime:
- Not testing:

## Review Plan

- Main-agent checks:
- Fresh-context review:
- Resolved agent types: <exact names available this session, per step 10>

## Risks

- <risk or "None obvious">:

## Slice Checkpoints

- [ ] <slice>: working | verified | reviewed | blocked (failures: <0-3>)

## Verification Notes

- `<literal command>` -> exit <code> (<slice>)
- <manual check>: <result>

## Review Notes

- Required:
- Follow-up:
- Ignore for MVP:

## Parked Follow-ups

- <deferred improvement and why>

## Known Limitations

- <accepted limitation or "None">
```

Everything down to Risks is written while planning. The four sections below it accumulate as slices land.

### 7. Keep The Plan True

If implementation shows the plan is stale or wrong, update the plan before continuing. Do not let code drift away from the written intent and then document the drift afterward.

Keep it short. If it grows large, split the work or switch to a fuller planning/spec workflow.

### 8. Implement One Slice

When the user approves the plan:

1. Implement one slice at a time, under the plan's stated Simplicity Bias policy — the repo's own minimality skill if it named one, otherwise the defaults in step 3.
2. Keep each change focused, and reversible by a mechanism rather than by intention: work on a branch by default, and commit per passing slice when the user has asked for commits. "Reversible" with neither a branch nor a commit is a claim, not a rollback.
3. Write or update only the tests justified by the risk plan.
4. Run that slice's `Verify:` command and record it with its exit status under Verification Notes. A slice with no recorded exit status is unverified.
5. Stop and simplify if the code starts needing speculative abstractions.
6. Note useful follow-up improvements without building them unless the user asks.

Keep implementation in the main agent by default. The main agent owns user intent, the plan, code edits, ordinary test runs, and obvious fixes.

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

Route the review to a subagent per the table in step 10 when the change is non-trivial. Review must be plan-bound: do not request production hardening, broad refactors, extra abstraction, or coverage increases unless they are required to meet the plan or prevent a real bug.

Categorize review findings as:

- Required: blocks the slice because it misses the plan, introduces real bug risk, weakens safety, or makes the code hard to reason about.
- Follow-up: useful improvement, polish, hardening, or refactor that should not block the MVP slice.
- Ignore for MVP: valid preference or optional idea that would expand scope without improving this delivery.

When briefing a review subagent, give it the plan, the diff, the verification already run, and those three category definitions verbatim. Reviews that come back in other shapes cannot drive the loop.

### 10. Use Subagents Selectively

Default to the main agent. Spawn a fresh-context subagent when independence is worth the overhead:

| Situation | Agent role | Typical type |
|---|---|---|
| "What already exists?" in step 2, spanning many files | Read-only search, returns the conclusion | read-only explorer |
| Non-trivial change, cross-boundary behavior, concurrency, data loss risk, or a slice that already failed once | Plan-bound code review | code reviewer |
| Non-trivial test design, flaky failures, integration-heavy checks, runtime verification, or tests that should be written without implementation bias | Test design and verification | test engineer |
| Auth, permissions, secrets, user input, external data, payments, destructive actions, sensitive storage | Security review | security auditor |

Agent type names differ between setups. Resolve each role against the agent types actually available in the current session and use the exact name; fall back to a general-purpose agent carrying the role's focus in its prompt when no specialist exists. Do not name a skill where an agent type is required — they are different things.

Do not spawn subagents for tiny, obvious slices. When using a subagent, pass the approved plan, the changed files, the verification already run with its exit status, and the exact review focus.

### 11. Loop Or Stop

Run the loop and stop rule defined in the Control Loop section at the top of this skill. That section is authoritative for what counts as a failure, when the counter resets, and when to stop. Do not re-derive it here.

Stop on success when the MVP outcome is met. Do not continue into hardening, polish, extra slices, or architecture cleanup unless the user asks.

After a clean slice, check the diff for unrelated changes, give the user a concise checkpoint summary, and park follow-ups instead of silently folding them into scope. If the user asked for commits, create an atomic commit only after the slice verifies cleanly.

## MVP Quality Floor

Minimal viable does not permit known data loss, security holes, race conditions, broken error handling at trust boundaries, inaccessible critical user paths, or behavior that contradicts the approved plan. If one of these appears, fix it in the current slice or return to the user with the tradeoff.

## Handoff Summary

When finishing or pausing, report what the plan file already holds: completed slices, verification exit statuses, review result, parked follow-ups, known limitations, and the next recommended slice.

## Red Flags

Patterns to catch mid-flight, when you have stopped re-reading the steps above:

- Skipping tests for brittle logic, concurrency, storage, security, or cross-boundary behavior.
- Letting "minimal" justify known correctness, security, data integrity, or accessibility failures.
- Accepting "scalable", "robust", or "clean" as goals without asking what they mean for this task.
- Treating reviewer suggestions as mandatory when they are production polish outside the MVP plan.
- Creating an epic, PRD, ADR, or diagram when a short plan would be enough.
- Planning work the user did not ask for yet.

## Completion Check

Before implementation, the gates are the check: every plan section down to Risks is filled, every slice carries a literal `Verify:` command, and the user approved it.

Before calling the delivery done, confirm:

- [ ] Implemented slices meet the approved plan.
- [ ] Every slice has a recorded verify command and exit status, or a documented limitation explaining why not.
- [ ] Review findings are resolved, deferred with reason, or returned to the user.
- [ ] Follow-up improvements were not silently folded into MVP scope.
- [ ] The final diff contains no unrelated changes.
- [ ] The plan file's `Status:` is `done` and its checkpoint sections match what actually happened.
