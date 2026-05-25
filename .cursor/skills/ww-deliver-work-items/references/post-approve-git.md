# Post-Approve Git Flow

Run only after the human replies `approve` at the staged review gate.

## Sequence

1. Confirm the work item is `status: staged`.
2. Collect learnings and propose any `AGENTS.md` updates before commit.
3. Include only human-approved durable learning updates.
4. Commit approved source, test, product-doc, and approved `AGENTS.md`
   changes on the work item branch.
5. Checkout `integration_branch`.
6. Squash merge the work item branch into `integration_branch`.
7. Run final project checks from `ww-work-items` command detection.
8. Set the work item `status: done`.
9. Continue to the next eligible approved work item.

## Guardrails

- Do not commit before human `approve`.
- Do not include `plans/` artifacts unless the human explicitly asks.
- Do not push unless the human explicitly asks.
- If final checks fail after squash merge, stop and report the failure.
- If merge conflicts occur, stop and ask before resolving unless the human
  explicitly asked for conflict resolution.

