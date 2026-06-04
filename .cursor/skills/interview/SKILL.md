---
name: interview
description: >
  Watson planning skill: clarify goals through structured Q&A before writing
  a PRD. Wraps interview-me with a ww-specific priority ladder and a clear
  stop condition tied to PRD readiness. Keywords: ww, interview, clarify,
  Q&A, intent, goals, planning.
metadata:
  author: watson
  workflow: ww
  phase: planning
---

# Interview

ww-tuned Q&A for the planning phase. Wraps `interview-me` with a priority
ladder and stops when enough is known to write a PRD without guessing on any
required field.

## When to load

Load this skill when the `spec-planner` harness determines that the goal,
user, success criteria, constraints, or architecture direction are unclear.

**Skip when** the input already contains enough to fill the PRD template
without guessing — go directly to the `prd` skill.

**Do not use** in non-interactive contexts (CI, scheduled runs, `/loop`).

## Priority ladder

Ask about these in order, skipping any already established in context:

1. **User / persona** — who benefits or operates this?
2. **Goal / outcome** — what changes and why does it matter?
3. **Success criteria** — how do we know it worked? (specific, testable)
4. **Constraints** — platform, security, deadline, or team limits
5. **Edge cases** — what breaks it or limits scope?
6. **Architecture direction** — human-provided design intent, preferred
   patterns, data boundaries, or code-specific notes

## Process

Follow the `interview-me` skill for full process (one question at a time,
hypothesis + guess attached, stop at ~95% confidence).

ww-specific adaptations:
- Maximum 3 questions per turn
- Use the priority ladder to determine which question to ask next
- Skip any ladder item already answered in the conversation
- After each answer, check the stop condition before asking another question

## Stop condition

You are done when you can fill every required PRD field without guessing:

- Persona / user ✓
- Goal / outcome ✓
- Success criteria (at least one testable condition) ✓
- In scope / out of scope boundaries ✓
- Constraints ✓
- Architecture direction (human-provided, or explicitly "none provided") ✓

Output a confirmed intent block and hand off to the `prd` skill:

```text
INTENT CONFIRMED:
- User/persona:            [who]
- Goal:                    [one line]
- Success:                 [testable outcome]
- Constraints:             [list or "none stated"]
- Edge cases:              [list or "none stated"]
- Architecture direction:  [human intent, or "none provided"]
- Out of scope:            [explicit non-goals]
```

## What you must never do

- Ask more than 3 questions in a single turn
- Accept "whatever you think" as a confirmed answer — re-ask with two
  concrete options
- Proceed to PRD without an explicit confirmation of the intent block
- Invent architecture direction not provided by the human
