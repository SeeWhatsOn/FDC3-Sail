# Context Budget

Keep each context focused. The work item is the handoff — not the PRD.

## Orchestrator (`/ww-plan`, `/ww-deliver`)

Load only:

- `ww-work-items`
- `ww-prd-breakdown` or `ww-deliver-work-items` (one phase skill)
- `context-engineering`
- `git-workflow-and-versioning` (delivery only)
- `continual-learning` (after human `approve` only)

Do not load TDD, review, implement, or domain skills in the orchestrator.

## Subagent brief — pass only

- Work item: Goal, Behavior spec, Test guidance, tags, file_manifest
- Relevant `AGENTS.md` sections (not the full file)
- Phase artifact: RED test list, diff summary, or implementation report
- `SKILLS TO LOAD`: max 2 skills for that phase

Do not pass: full PRD, full `plans/project-docs.md`, or delivery
orchestrator skills.

## Verifier override

Even if `verifier-agent` mentions loading WW skills, the orchestrator
brief must say **do not load skills** and use the inline checklist in
[verification-checklist.md](verification-checklist.md).

