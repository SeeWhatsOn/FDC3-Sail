# Agent Personas

Specialist personas that play a single role with a single perspective. Each persona is a Markdown file consumed as a system prompt by your harness (Claude Code, Cursor, Copilot, etc.).

| Persona | Role | Best for |
|---------|------|----------|
| [code-reviewer](code-reviewer.md) | Senior Staff Engineer | Five-axis review before merge |
| [security-auditor](security-auditor.md) | Security Engineer | Vulnerability detection, OWASP-style audit |
| [test-engineer](test-engineer.md) | QA Engineer | Test strategy, coverage analysis, Prove-It pattern |

## How personas relate to skills and commands

Three layers, each with a distinct job:

| Layer | What it is | Example | Composition role |
|-------|-----------|---------|------------------|
| **Skill** | A workflow with steps and exit criteria | `ww-deliver-work-items` | The *how* — the top-level agent follows it |
| **Persona** | A role with a perspective and an output format | `implement-agent` | The *who* — performs one bounded subagent task |
| **Command** | A user-facing entry point | `/ww-plan`, `/ww-deliver` | The *when* — triggers the top-level workflow |

The top-level agent is the orchestrator for workflow skills. **Personas do not call other personas.** Specialist personas are launched only for bounded phase work that benefits from separate temporary context.

## When to use each

### Direct persona invocation
Pick this when you want one perspective on the current change and the user is in the loop.

- "Review this PR" → invoke `code-reviewer` directly
- "Are there security issues in `auth.ts`?" → invoke `security-auditor` directly
- "What tests are missing for the checkout flow?" → invoke `test-engineer` directly

### Slash command backed by a workflow skill
Pick this when there is a repeatable workflow with human gates, state transitions, and specialist phases.

- `/ww-plan` → top-level agent loads `ww-work-items` + `ww-prd-breakdown` and may launch `spec-agent` for isolated work-item drafting
- `/ww-deliver` → top-level agent loads `ww-work-items` + `ww-deliver-work-items` and launches `test-engineer`, `implement-agent`, `verifier-agent`, and `code-reviewer` for isolated phases
- `/review` → wraps `code-reviewer` with the project's review skill
- `/test` → wraps `test-engineer` with the project's testing skill

Skills define how the workflow is performed. Personas define who is doing one bounded role. The top-level agent routes, records state, and enforces gates; it should not duplicate full specialist work in its own context.

## Decision matrix

```
Is the work a single perspective on a single artifact?
├── Yes → Direct persona invocation
└── No  → Is it a named workflow with skills and human gates?
         ├── Yes → Slash command backed by a workflow skill
         └── No  → Are the sub-tasks independent?
                  ├── Yes → Parallel fan-out with specialist personas
                  └── No  → Sequential workflow steps in the top-level agent
```

## Worked example: valid orchestration

`/ww-deliver add-context-broadcast-handler` is a valid sequential workflow because each phase needs a different isolated context and an explicit handoff:

```
/ww-deliver add-context-broadcast-handler
  top-level agent follows ww-deliver-work-items skill
  ├── test-engineer    → RED tests from BDD behavior spec
  ├── implement-agent  → GREEN implementation
  ├── verifier-agent   → read-only verification
  └── code-reviewer    → typed verdict
                  ↓
        human approval + commit + learning proposal
```

Why this works:
- The top-level agent owns routing, state, and gates
- Skills own the procedure
- Specialist personas do one bounded job each
- Context stays separate and temporary

`/ship` is the canonical fan-out workflow in this repo:

```
/ship
  ├── (parallel) code-reviewer    → review report
  ├── (parallel) security-auditor → audit report
  └── (parallel) test-engineer    → coverage report
                  ↓
        merge phase (main agent)
                  ↓
        go/no-go decision + rollback plan
```

Why this works:
- Each sub-agent operates on the same diff but produces a **different perspective**
- They have no dependencies on each other → genuine parallelism, real wall-clock savings
- Each runs in a fresh context window → main session stays uncluttered
- The merge step is small and benefits from full context, so it stays in the main agent

## Worked example: invalid orchestration (do not build this)

A `meta-orchestrator` persona whose job is "decide which other persona to call":

```
/work-on-pr → meta-orchestrator
                  ↓ (decides "this needs a review")
              code-reviewer
                  ↓ (returns)
              meta-orchestrator (paraphrases result)
                  ↓
              user
```

Why this fails:
- Pure routing layer with no domain value
- Adds two paraphrasing hops → information loss + 2× token cost
- The user already knows they want a review; let them call `/review` directly
- Replicates work that slash commands and `AGENTS.md` intent-mapping already do

## Rules for personas

1. A persona is a single role with a single output format. If you find yourself adding a second role, create a second persona.
2. **Personas do not invoke other personas.** Composition is the job of slash commands or the user. On Claude Code this is also a hard platform constraint — *"subagents cannot spawn other subagents"* — so the rule is enforced for you.
3. A persona may invoke skills (the *how*).
4. Every persona file ends with a "Composition" block stating where it fits.

## Cursor and Claude Code interop

These personas are user-scoped markdown files in `~/.cursor/agents/`. Per
[Cursor subagents docs](https://cursor.com/docs/subagents), they apply to
**all projects** for the current user — no project-level copy required.

### Cursor

- **Discovery:** Cursor loads custom subagents from `~/.cursor/agents/`
  (or project `.cursor/agents/` when present).
- **Invoke explicitly:** `/code-reviewer`, `/verifier-agent`, or natural
  language (“use the verifier subagent…”).
- **Invoke from orchestrator:** `Task(subagent_type: "code-reviewer", …)`
  when the session Task enum includes custom agent names. The enum varies
  by session; `ww-deliver-work-items` probes at startup (see
  `subagent-launch.md`).
- **Parallel work:** parent sends multiple Task calls in one message.

Do not simulate a persona with `generalPurpose` and a one-line “You are
the …” prompt. Either use the registered subagent or paste the full agent
file body (last-resort fallback documented in `ww-deliver-work-items`).

### Claude Code (Agent Teams)

Reference the same persona name when spawning a teammate (experimental,
requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`). The persona body is
**appended to** the teammate's system prompt. Subagents only report back
to the main agent; Agent Teams allow direct teammate messaging.

See [references/orchestration-patterns.md](../references/orchestration-patterns.md)
for orchestration patterns.

## Adding a new persona

1. Create `~/.cursor/agents/<role>.md` with the same frontmatter format used by existing personas.
2. Define the role, scope, output format, and rules.
3. Add a **Composition** block at the bottom (Invoke directly when / Invoke via / Do not invoke from another persona).
4. Add the persona to the table at the top of this file.
5. If the persona enables a new orchestration pattern, document it in `references/orchestration-patterns.md` rather than inventing the pattern in the persona file itself.

