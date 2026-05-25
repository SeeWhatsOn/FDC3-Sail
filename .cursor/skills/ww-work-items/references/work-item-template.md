# Canonical Work Item Template

Use this section order for local work items:

```markdown
---
title: "Short imperative title"
slug: short-descriptive-slug
type: feature              # feature | bug | chore
status: approved           # see lifecycle in SKILL.md
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - src/path/to/file.ts
  - tests/path/to/file.test.ts
depends_on: []
integration_branch: ""
branch: feature/short-descriptive-slug
external_tracker: ""       # empty unless backed by GitHub/Jira/etc.
tags: []                   # optional — see work-item-tags.md
---

## Goal
One sentence. What does this deliver and why does it matter?

## User or system context
Who benefits, what system behaviour changes, and what normal developer
needs to understand before starting.

## Reference docs
Links or paths from `plans/project-docs.md` relevant to this work item.

## Behavior spec
Given [context]
When [action]
Then [observable outcome]

Repeat for every required behaviour, including edge cases.

## Out of scope
- Item

## TypeScript interfaces
Relevant interfaces, or "none".

## Test guidance
High-level guidance for the RED phase. Do not prescribe exact test code
unless the PRD explicitly requires a particular test level.

## Blocked decisions
Questions raised by delivery agents and answered by the human.

## Loop history
Delivery retries after review failures.

## Staged for review
Evidence written when tests pass and changes are staged for human review.

## Escalation notes
Written when `loop_count >= loop_limit`.

## Learnings extracted
Patterns discovered during delivery and proposed for durable learning.
```

