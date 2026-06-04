---
name: bdd
description: >
  Watson planning skill: generate Given/When/Then behavior specifications
  from a feature description. Produces observable, implementation-neutral
  acceptance criteria for ww work items. Keywords: ww, BDD, Given When Then,
  behavior spec, acceptance criteria, scenarios.
metadata:
  author: watson
  workflow: ww
  phase: planning
---

# BDD

Generates `Given / When / Then` behavior specifications for ww work items.
Called by `work-breakdown` for each work item with a behavior change. Also
available directly from `spec-planner`.

## When to load

- Load for every work item that changes observable system behavior
- Skip for pure infrastructure, configuration, or documentation work items
  with no user-visible behavior

## Process

For each scenario:

1. Identify the observable behavior (not the implementation)
2. Write the core happy-path scenario first
3. Write at least one edge, error, or boundary scenario
4. Check: can each `Then` be observed from outside the system without
   reading internal state?

Use [references/bdd-patterns.md](references/bdd-patterns.md) for pattern
examples and anti-patterns.

## Format

```text
Scenario: [short name]
  Given [specific starting context]
  When  [specific action or event]
  Then  [specific observable outcome]

Scenario: [edge case name]
  Given [edge context]
  When  [same or variant action]
  Then  [boundary outcome]
```

## Rules

- Each `Given / When / Then` block is one scenario — do not chain with `And`
  more than twice
- `Then` must be observable without inspecting internals or reading database
  state directly
- Do not prescribe implementation details in `Given` or `When`
- Do not reference class names, method names, or internal identifiers
- Do not write executable test code — behavior specs only
- `Scenario:` labels are optional but strongly recommended for work items
  with 3+ scenarios

## Output

Return `Given/When/Then` blocks directly. The calling skill (`work-breakdown`
or `spec-agent`) embeds them in the work item's `## Behavior spec` section.
