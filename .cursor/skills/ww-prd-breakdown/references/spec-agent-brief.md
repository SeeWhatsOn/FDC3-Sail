# Spec-Agent Task Brief

Use when launching `spec-agent` for an isolated work-item draft. The
orchestrator owns validation, human gate, and file writes.

Include this block in the subagent prompt, filled in for one slice:

```text
SKILLS TO LOAD:
- spec-driven-development
- planning-and-task-breakdown
- ww-work-items

TASK: Draft one local markdown work item for the Watson workflow.
Use the canonical format from ww-work-items. Do not write executable
tests or production code.

title:              [work item title]
slug:               [descriptive filename slug]
kind:               [task | spike | epic]
goal:               [one sentence goal]
type:               [feature | bug | chore]
tags:               [from work-item-tags.md or empty]
prd_context:        [relevant PRD excerpt]
user_or_system:     [who or what depends on this]
file_manifest:      [likely files or areas]
depends_on:         [work item slugs or empty]
loop_limit:         [number, default 3]
relevant_docs:      [PRD, epic, ADR, README, AGENTS.md, or source links]
project_context:    [relevant AGENTS.md sections]
revision_feedback:  [empty on first draft, or human feedback]
```

After the subagent returns, run draft validation from `ww-work-items`
before the human gate.

