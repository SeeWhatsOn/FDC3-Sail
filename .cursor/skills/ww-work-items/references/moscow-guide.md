# MoSCoW Prioritization Guide

Apply MoSCoW in `work-breakdown` skill when sequencing vertical slices from a
PRD. Each in-scope PRD row gets one label. Use the table and decision tree
below.

## Labels

| Label | Meaning | Delivery order |
|-------|---------|----------------|
| **Must-have** | Required for the workload to deliver its stated goal. Missing = failure. | First |
| **Should-have** | Important but the workload still delivers value without it. Time-box risk. | Second |
| **Could-have** | Nice to have; cut if time or scope is tight. | Third |
| **Won't-have** | Explicitly out of scope for this workload. | Never (record in Out of scope) |

## Decision tree

```
Is the workload incomplete / broken without this?
  Yes → Must-have

Is it a stated success criterion in the PRD?
  Yes → Must-have

Would a user notice its absence and complain?
  Yes → Should-have
  No  → Could-have

Was it excluded from the PRD scope by the human?
  Yes → Won't-have
```

## Rules

1. **Must-have ≤ 60%** of total work items. If more than 60% are Must-have,
   you have over-scoped. Split the PRD or push items to Should-have.

2. **Won't-have items never become work items.** Record them in the PRD Out
   of scope section. If the human later changes their mind, create a new PRD
   row.

3. **Could-have items are optional delivery.** If the delivery session runs
   long, drop Could-have items and report them as deferred — do not rush
   them.

4. **MoSCoW is a conversation tool, not a mandate.** If the human re-scopes
   during planning, update labels and re-sequence. Do not argue about labels
   — surface the trade-off and let the human decide.

## In the work item frontmatter

```yaml
priority: must-have   # must-have | should-have | could-have | wont-have
```

## Relation to delivery order

`work-breakdown` sequences work items in dependency + MoSCoW order:

1. Must-have items in dependency order
2. Should-have items in dependency order
3. Could-have items last

`/ww-deliver` processes the queue in this sequence unless the human overrides.
