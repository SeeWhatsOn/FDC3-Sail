# Canonical Work Item Template

Use this section order for local work items:

```markdown
---
title: "Short imperative title"
slug: short-descriptive-slug
kind: task                 # task | spike | epic — see work-item-kinds.md
type: feature              # feature | bug | chore
status: draft              # human approval changes this to approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - src/path/to/file.ts
  - tests/path/to/file.test.ts
depends_on: []
integration_branch: ""
branch: feature/short-descriptive-slug
pr_url: ""                 # set when status: pr_awaiting
merged_pr: ""              # set when status: done (PR URL or #N)
external_tracker: ""       # empty unless backed by GitHub/Jira/etc.
tags: []                   # optional — see work-item-tags.md
---

## Goal
One sentence. What does this deliver and why does it matter?

## User or system context
Who benefits, what system behaviour changes, and what normal developer
needs to understand before starting.

## Reference docs
Links or paths to the PRD, parent epic when applicable, ADRs, README,
AGENTS.md sections, or source files relevant to this work item.

## Parent context
Short PRD or epic excerpt that explains how this work item fits the whole
system. Keep this concise so delivery subagents do not need the full PRD.

## Behavior spec
Given [context]
When [action]
Then [observable outcome]

Repeat for every behavior change, including edge cases.
For `kind: spike`, use Phase 1 (investigate) and Phase 2 (fix) if needed.
For `kind: epic`, omit — use `## Child work items` instead.

## Child work items
Required for `kind: epic` only. Table of child slugs, kinds, depends_on,
status.

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

