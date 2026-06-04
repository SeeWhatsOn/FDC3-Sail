# Subagent Launch Procedure

Follow [Cursor subagents docs](https://cursor.com/docs/subagents). Watson
personas live in `~/.cursor/agents/` (user scope, all projects). Do not
require project-level `.cursor/agents/` copies.

Run the probe during delivery startup (see
[startup-checklist.md](startup-checklist.md)). Record the result for the
whole `/ww-deliver` session.

## Session probe

Before Phase A of the first work item:

```text
Task(
  subagent_type: "verifier-agent",
  readonly: true,
  prompt: "Reply with exactly one word: PONG. Do nothing else."
)
```

| Probe result | Session flag | Action |
|--------------|--------------|--------|
| Success (`PONG`) | `registered_subagents: yes` | Use registered specialists for all phases |
| Task enum rejection or launch failure | `registered_subagents: no` | Follow fallback ladder below |

Tell the human the probe result when reporting queue order.

## Launch paths (in order)

### 1. Registered Task subagent (preferred)

When `registered_subagents: yes`:

```text
Task(
  subagent_type: "<specialist>",
  readonly: <true for verifier-agent, code-reviewer, security-auditor>,
  prompt: [phase prompt from phase-prompts.md with fields filled in]
)
```

Specialists: `test-engineer`, `implement-agent`, `verifier-agent`,
`code-reviewer`, `security-auditor`.

Cursor loads the matching file from `~/.cursor/agents/<name>.md`. The
orchestrator passes the phase prompt; do not duplicate the full agent
body unless using fallback path 3.

### 2. Explicit Cursor delegation (when probe fails)

Stop delivery and ask the human to either:

- start a new agent session and re-run `/ww-deliver`, or
- add explicit delegation in the prompt (Cursor may inject
  `subagent_delegation_context`), for example requesting
  `/verifier-agent` for verification.

Do not continue Phase A–D in the top-level context.

### 3. Last-resort fallback (probe failed, human insists on continuing)

Only if the human explicitly approves continuing in this session:

```text
Task(
  subagent_type: "generalPurpose",
  readonly: <match specialist>,
  prompt: [full body from ~/.cursor/agents/<specialist>.md]
          + [phase prompt from phase-prompts.md]
)
```

Record `Registered subagent: no (generalPurpose fallback)` in the phase
audit. This is weaker than path 1 — prefer stopping instead.

## Never do

- Use `generalPurpose` with only “You are the verifier-agent…” and no
  full agent file body (simulation).
- Perform verifier judgment, review verdicts, tests, or implementation
  in the top-level orchestrator context.
- Assume `subagent_type` always includes custom names — the Task enum
  varies by session even when `~/.cursor/agents/` files exist.

## Phase audit column

Every phase audit row must include:

```text
Registered subagent: yes | no (generalPurpose fallback)
```

When `yes`, also record `subagent_type` used and `readonly` flag.

