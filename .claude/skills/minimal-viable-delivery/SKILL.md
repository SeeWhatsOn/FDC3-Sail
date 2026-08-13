---
name: minimal-viable-delivery
description: Runs lightweight end-to-end delivery from intent refinement through plan, implementation, risk-based testing, verification, and review, with coding, testing, and review isolated in separate subagents. Use when building a minimal viable feature or fix, breaking vague work into deliverable slices, avoiding over-engineering, or looping on review until the result is simple, correct, and good enough to continue from.
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
Clarify intent                                    [main]
  -> define minimal viable outcome                [main + explorer]
  -> plan useful slices + bind the verify command [main]
  -> choose risk-based tests                      [main]
  -> implement one slice                          [coder]
  -> write/verify tests                           [tester]
  -> verify                                       [main runs the command]
  -> review against the plan                      [reviewer]
  -> fix or adjust                                [coder]
  -> continue, stop, or ask the user              [main]
```

### Role separation

Coding, testing, and review are **three separate subagents with three separate contexts**. This is the point of the loop, not an optimization. An agent that wrote code cannot be trusted to judge it, and tests written by the implementer test what was built rather than what was asked for.

| Role | Owns | Must never also be |
|---|---|---|
| **main** | User intent, the plan file, gates, running verify commands, the final decision | — |
| **coder** | Code edits for one slice | tester, reviewer |
| **tester** | Test design and test code, written from the plan's acceptance criteria | coder |
| **reviewer** | Plan-bound review of the slice diff | coder, tester |

Hard rules:

- **Never reuse one subagent across two roles**, in one slice or across slices. A fresh context per role is the isolation.
- **The tester is briefed from the plan, not from the diff.** Give it the slice's Goal and Acceptance, not the implementation, unless it is verifying an existing failure.
- **The reviewer never edits.** It returns findings; the coder applies them.
- **The main agent never writes slice code.** If it catches itself editing implementation files, that is a skipped gate — see step 10 for the only exemption.

### Gates

These phases each emit one artifact. Do not enter a phase until the previous phase's artifact exists.

| Phase | Owner | Artifact it emits | Gate it opens |
|---|---|---|---|
| 1. Clarify intent | main | Restate block the user confirmed | No plan from ambiguous intent |
| 2-3. Minimal outcome | main + explorer | Reuse findings, chosen code shape | No slices before knowing what already exists |
| 4-6. Plan | main | Slice list, each with a literal verify command | No edits without an approved plan |
| 8.1-8.3 Implement | **coder** | One slice's diff | No second slice while the first is unverified |
| 8.3b Tests | **tester** | Test files, plus what it declined to test and why | No verify on a slice whose risk-planned tests do not exist |
| 8.4 Verify | main | Command plus exit status under Verification Notes | No review of an unverified slice |
| 9. Review | **reviewer** | Findings split Required / Follow-up / Ignore for MVP | No "done" while a Required is open |

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

**A slice's `Verify:` is the Focused command, scoped to that slice's files.** Full suite and typecheck/lint are a **single end-of-delivery run**, not a per-slice gate. Repeating them on every slice costs minutes per loop and tells you nothing the focused run did not — the slice is not shipping on its own.

Bind a slice to Full or typecheck/lint only when that slice can plausibly break something outside its own files: a shared type or interface change, a dependency or config edit, a rename crossing modules, or a delete. Say in the slice why.

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

- Full: <literal command, or "none — manual check only"> — end of delivery only
- Focused: <literal command for a single file or suite> — this is what slices use
- Typecheck/lint: <literal command, or "none"> — end of delivery only

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

## Agent Roles

Resolved against the agent types available this session, per step 10.

- coder: <exact agent type name>
- tester: <exact agent type name, or "none — no risk-planned tests">
- reviewer: <exact agent type name>
- security reviewer: <exact agent type name, or "not applicable">
- explorer: <exact agent type name, or "not needed">

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

When the user approves the plan, the main agent runs one slice as an orchestration, not as its own edit session:

1. **Set up rollback first.** Work on a branch by default; commit per passing slice when the user has asked for commits. "Reversible" with neither a branch nor a commit is a claim, not a rollback.
2. **Dispatch the coder subagent** with one slice only, under the plan's stated Simplicity Bias policy — the repo's own minimality skill if it named one, otherwise the defaults in step 3. Brief it per step 10.
3. **Dispatch the tester subagent** for the tests the risk plan justified. Brief it from the slice's Goal and Acceptance. It writes tests only; it does not fix implementation code.
4. **Run that slice's `Verify:` command yourself** — that one command, not the full suite on top of it — and record it with its exit status under Verification Notes. A slice with no recorded exit status is unverified. Do not accept a subagent's claim that tests pass — the exit status you observed is the artifact.
5. **On failure, send the failure back to the coder**, not to whoever is convenient. Increment the slice counter per the loop rule.
6. Note useful follow-up improvements without building them unless the user asks.

Steps 2 and 3 may run in either order. Prefer tester-first when the slice is a bug fix, so the reproduction fails before the fix exists.

If a subagent's diff starts adding polish, abstractions, dependencies, broad tests, or extra files, do not merge it forward — send it back with the scope cut, or pause and ask the user: "Is this required for MVP, or should it be a follow-up?"

### 9. Verify And Review

After each non-trivial slice, review the result against the approved plan:

- Does it satisfy the stated outcome and success criteria?
- Did it stay inside out-of-scope boundaries?
- Does the diff contain only the intended slice plus justified tests/docs?
- Is the implementation simpler than the obvious alternatives?
- Are abstractions, classes, folders, dependencies, and tests justified by current risk?
- Are there missing tests only where bugs, boundaries, or brittle logic make them useful?
- Are follow-up improvements better left as follow-up instead of included now?

Route the review to a **fresh reviewer subagent** per step 10. The main agent does not review the slice itself — it read the plan, argued for the approach, and dispatched the coder, so it is not a fresh context. Review must be plan-bound: do not request production hardening, broad refactors, extra abstraction, or coverage increases unless they are required to meet the plan or prevent a real bug.

Categorize review findings as:

- Required: blocks the slice because it misses the plan, introduces real bug risk, weakens safety, or makes the code hard to reason about.
- Follow-up: useful improvement, polish, hardening, or refactor that should not block the MVP slice.
- Ignore for MVP: valid preference or optional idea that would expand scope without improving this delivery.

Brief the reviewer per the table in step 10, and give it those three category definitions verbatim.

### 10. Dispatch The Role Subagents

Every non-trivial slice uses at least a **coder** and a **reviewer**, plus a **tester** whenever the risk plan calls for tests. These are separate agents. Do not collapse them to save a round trip.

| Role | When | Typical type |
|---|---|---|
| **explorer** | "What already exists?" in step 2 spans many files or unknown naming conventions | read-only search agent |
| **coder** | Every slice that edits code | general-purpose |
| **tester** | The risk plan named a unit, integration, or runtime check for this slice | test engineer |
| **reviewer** | Every non-trivial slice, and always after a slice failure | code reviewer |
| **security reviewer** | Auth, permissions, secrets, user input, external data, payments, destructive actions, sensitive storage | security auditor |

Security review is **in addition to** the ordinary reviewer, not a substitute for it.

**Resolving type names.** Agent type names differ between setups. Resolve each role against the agent types actually available in the current session and use the exact name; fall back to a general-purpose agent carrying the role's focus in its prompt when no specialist exists. Record the resolved names in the plan's Review Plan section so a resumed session reuses the same mapping. Do not name a skill where an agent type is required — they are different things.

**Briefing.** Every subagent gets a written brief. Give each role exactly this and no more:

| Role | Gets | Does not get |
|---|---|---|
| coder | Plan intent, this slice's Goal / Acceptance / Likely files, Simplicity Bias, prior review findings marked Required | Other slices, follow-up ideas |
| tester | Plan intent, this slice's Goal / Acceptance, the Test Plan row, the literal verify command | The implementation diff (except when reproducing a known bug) |
| reviewer | The approved plan, the slice diff, the verify command with the exit status you observed, and the three finding categories from step 9 verbatim | Permission to edit files |

A review that comes back in a shape other than Required / Follow-up / Ignore for MVP cannot drive the loop — send it back rather than reinterpreting it yourself.

**The only exemption.** A slice that is a single obvious edit in one file, with no risk-planned test, may be done by the main agent directly. Say so in the plan's Slice Checkpoints line when you take it. If you take the exemption twice in a row, you have mis-sliced the work — go back to step 4.

### 11. Loop Or Stop

Run the loop and stop rule defined in the Control Loop section at the top of this skill. That section is authoritative for what counts as a failure, when the counter resets, and when to stop. Do not re-derive it here.

Stop on success when the MVP outcome is met. Do not continue into hardening, polish, extra slices, or architecture cleanup unless the user asks.

After a clean slice, check the diff for unrelated changes, give the user a concise checkpoint summary, and park follow-ups instead of silently folding them into scope. If the user asked for commits, create an atomic commit only after the slice verifies cleanly.

**Once, when the last slice is done:** run the plan's `Full` and `Typecheck/lint` commands and record both exit statuses under Verification Notes. This is the run that catches what the focused per-slice commands could not see. A failure here is a slice failure attributed to whichever slice caused it — fix, re-verify focused, then re-run Full.

## MVP Quality Floor

Minimal viable does not permit known data loss, security holes, race conditions, broken error handling at trust boundaries, inaccessible critical user paths, or behavior that contradicts the approved plan. If one of these appears, fix it in the current slice or return to the user with the tradeoff.

## Handoff Summary

When finishing or pausing, report what the plan file already holds: completed slices, verification exit statuses, review result, parked follow-ups, known limitations, and the next recommended slice.

## Red Flags

Patterns to catch mid-flight, when you have stopped re-reading the steps above:

- One context wrote the code, wrote the tests, and passed the review. That is not a loop, it is a single opinion in three costumes.
- Reviewing your own slice because "the diff is small and I already know what it does" — that is exactly the reasoning the fresh context exists to defeat.
- Handing the tester the diff and asking it to "write tests for this". It then tests what was built, not what the plan asked for.
- Reporting a slice verified on a subagent's word instead of an exit status you observed.
- Running the full suite, typecheck, or lint after every slice. That is the end-of-delivery run, and paying it per slice buys nothing the focused command did not already prove.
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
- [ ] Every non-trivial slice was coded, tested, and reviewed by three separate contexts — or took the step 10 exemption and said so.
- [ ] Every slice has a recorded verify command and exit status, or a documented limitation explaining why not.
- [ ] The `Full` and `Typecheck/lint` commands were run once at the end, with both exit statuses recorded.
- [ ] Review findings are resolved, deferred with reason, or returned to the user.
- [ ] Follow-up improvements were not silently folded into MVP scope.
- [ ] The final diff contains no unrelated changes.
- [ ] The plan file's `Status:` is `done` and its checkpoint sections match what actually happened.
