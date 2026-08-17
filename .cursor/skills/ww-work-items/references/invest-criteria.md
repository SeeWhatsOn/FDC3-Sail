# INVEST Criteria

Use this checklist to validate each work item before marking it ready for
delivery. Apply it in `work-breakdown` skill after drafting each item and
in `spec-agent` before submitting the quality checklist.

## The six criteria

### I — Independent

The work item can be developed and delivered without requiring another work
item to be completed first (except items declared in `depends_on`).

**Check:** Could a developer start this today without waiting for another PR?

**Fail signals:**
- Shared database migration needed from another in-progress item
- Depends on API that doesn't exist and isn't in `depends_on`
- Tightly coupled to sibling item with no defined interface

**Fix:** Add the dependency to `depends_on`, split the shared piece into a
prerequisite item, or re-scope to use an existing interface.

---

### N — Negotiable

The work item defines the **what** and **why**, not the exact **how**.
Implementation details are a collaboration between the human and agent.

**Check:** Could the agent propose an alternative approach and still satisfy
the acceptance criteria?

**Fail signals:**
- Specific class names, file structures, or algorithms required in the goal
- "Must use X library" without a stated reason tied to a PRD constraint
- Acceptance criteria read like a code walkthrough

**Fix:** Move implementation constraints to `## Architecture notes` and keep
`## Behavior spec` focused on observable outcomes.

---

### V — Valuable

The work item delivers something observable to a user, system, or the
project's quality bar. Pure refactors are valuable only if they unblock
delivery or reduce measurable risk.

**Check:** If this item shipped alone, would someone notice the improvement?

**Fail signals:**
- "Clean up" with no stated behavior goal
- Rename variables with no downstream effect
- Work that only enables another item (consider merging or making a spike)

**Fix:** Add a stated value statement. If truly invisible, confirm it's
`kind: task` with a clear risk-reduction rationale.

---

### E — Estimable

The scope is clear enough that an agent could plan the work in one session.

**Check:** Is there enough context to know what files are touched and roughly
how complex the change is?

**Fail signals:**
- File manifest is empty or too vague ("entire platform")
- No acceptance criteria (agent can't know when done)
- Depends on a spike that hasn't been done yet

**Fix:** Split into a spike + task, add file manifest, or move unknown scope
to `## Blocked decisions`.

---

### S — Small

The item fits in a single delivery session (one agent context + human review
cycle). A typical task is 1–5 files and 1–3 behavior changes.

**Check:** Could `/ww-deliver` complete this in one uninterrupted run?

**Fail signals:**
- More than 7 files in the manifest
- More than 3 distinct behavior changes
- "Phase 1 of N" pattern without a delivery milestone after Phase 1

**Fix:** Split into child tasks. If it's an epic, classify it as `kind: epic`
and list child slugs.

---

### T — Testable

The acceptance criteria include at least one `Given / When / Then` scenario
that passes or fails without human judgment.

**Check:** Could `test-engineer` write a test for each `Then` statement
without asking clarifying questions?

**Fail signals:**
- "Works correctly" or "feels right" as acceptance criteria
- `Then` references internal state not observable from outside
- No behavior spec section

**Fix:** Load the `bdd` skill and generate at least one concrete scenario.
