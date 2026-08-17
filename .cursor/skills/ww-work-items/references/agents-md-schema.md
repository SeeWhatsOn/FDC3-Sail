# AGENTS.md Schema

Documents the expected sections and their purpose in `AGENTS.md` for this
repository. Agents and skills should know which section to read or write.

## Section map

| Section | Owner | Purpose |
|---------|-------|---------|
| `## Cursor Cloud specific instructions` | Human + agents | Repo overview, commands, workspace packages, dev server notes |
| `### Watson workflow` | Human + ww harness | Workflow config, tiers, status lifecycle, first-run interview |
| `### Cucumber tags` | Human | Cucumber filtering conventions for `@finos/sail-desktop-agent` |
| `## Learned User Preferences` | `continual-learning` / human | Durable coding preferences extracted from sessions |
| `## Learned Workspace Facts` | `continual-learning` / human | Durable facts about the codebase, modules, conventions |

## Watson workflow section contents

The `### Watson workflow` section contains embedded configuration that was
previously stored in `ww-workflow-config/SKILL.md`. It includes:

- Config file location (`plans/workflow-config.yaml`)
- Integration branch
- Plans-in-git flag
- Delivery automation tiers table
- Status lifecycle summary + pointer to `status-lifecycle.md`
- Plans/git policy rules
- First-run interview script (7 questions)

Do not move these entries back into a skill file. Config loads once from
`AGENTS.md` and stays in context for the session.

## Who writes what

| Writing agent | Writes to |
|---------------|-----------|
| `continual-learning` / `agents-memory-updater` | `## Learned User Preferences`, `## Learned Workspace Facts` |
| Human | Any section |
| ww harness (spec-planner) | Does not write to AGENTS.md directly; triggers `continual-learning` |
| Other skills | Read-only |

## Pointer to reference files

Key ww reference files (no longer loaded via `ww-workflow-config`):

| File | Location |
|------|----------|
| Status lifecycle | `.cursor/skills/ww-work-items/references/status-lifecycle.md` |
| Reconcile process | `.cursor/skills/ww-work-items/references/reconcile.md` |
| PRD template | `.cursor/skills/ww-work-items/references/prd-template.md` |
| PRD accuracy gate | `.cursor/skills/ww-work-items/references/prd-accuracy-gate.md` |
| MoSCoW guide | `.cursor/skills/ww-work-items/references/moscow-guide.md` |
| INVEST criteria | `.cursor/skills/ww-work-items/references/invest-criteria.md` |
| BDD patterns | `.cursor/skills/bdd/references/bdd-patterns.md` |
| Human gate template | `.cursor/skills/ww-approve-work-items/references/human-gate-template.md` |

## Agents directory (repo-level `.cursor/agents/`)

| Agent | Role |
|-------|------|
| `spec-agent.md` | Writes individual ww work items from a structured brief |
| `architect-agent.md` | Conditional architecture review + ADR drafting |
| `implement-agent.md` | Implements code for approved work items |
| `test-engineer.md` | Writes tests for approved work items |
| `verifier-agent.md` | Verifies implementation against behavior spec |
| `code-reviewer.md` | Reviews code quality, correctness, security |
| `security-auditor.md` | Security-focused deep review |
