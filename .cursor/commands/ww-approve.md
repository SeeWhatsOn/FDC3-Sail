---
description: Watson workflow approval — review draft work items and set status approved before delivery
argument-hint: [work-item-slug | PRD path | --catalog-only]
---

# /ww-approve

Kick off the Watson workflow **approval phase** (between plan and deliver).

## Load skills immediately

Read and follow these skills in order:

1. `ww-workflow-config`
2. `ww-work-items`
3. `ww-approve-work-items`

## What to do

1. Run the full approval workflow from `ww-approve-work-items`.
2. Print the **approval catalog** (all work items by status) first.
3. If the user provided a slug, only queue that item (if draft).
4. If the user provided a PRD path, queue draft items for that PRD.
5. Otherwise queue all draft non-epic items in dependency order.
6. Present each item for human `approve` | `approve all` | `revise` | `skip` | `done <slug>`.
7. End with handoff to `/ww-deliver`.

## Usage

```text
/ww-approve                                    # review all drafts
/ww-approve --catalog-only                     # summary table only
/ww-approve conformance-traceability-map       # one slug
/ww-approve plans/prd-desktop-agent-conformance-gaps.md   # P1 drafts only
```

Do not write production code or executable tests in this phase.
