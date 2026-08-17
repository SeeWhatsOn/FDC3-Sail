---
description: Watson workflow planning — break a PRD into approved work items with BDD specs
argument-hint: [PRD path or goal description]
---

# /ww-plan

Kick off the Watson workflow **planning phase**.

## Load skills immediately

Read and follow these skills in order:

1. `ww-workflow-config` (create `plans/workflow-config.yaml` via interview if missing)
2. `ww-work-items`
3. `ww-prd-breakdown`

Also load `interview-me` if intent, scope, or constraints are unclear.

## What to do

1. Run the full planning workflow from `ww-prd-breakdown`.
2. Use the PRD path, attached doc, or goal from the user's message as input.
3. Present each work item draft for human approval before writing it.
4. End with the handoff report pointing to `/ww-approve` and `/ww-deliver`.
5. Handoff must state active **automation tier** and `plans.version_in_git`.

## Usage

```text
/ww-plan docs/PRD-checkout.md
/ww-plan Add FDC3 context broadcast handler with retry on failure
```

Do not write production code or executable tests in this phase.
