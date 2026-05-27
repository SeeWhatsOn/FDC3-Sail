# Work Item Draft Validation

Run this checklist before presenting a draft work item for human
`approve`. Fix any failing item before the human gate.

Read [work-item-kinds.md](work-item-kinds.md) first. Apply the **kind**
column below.

## All kinds

- [ ] `kind` is set (`task` default if omitted)
- [ ] `## Out of scope` is non-empty
- [ ] `depends_on` slugs exist in `plans/work-items/` or is empty
- [ ] `loop_limit` is set (default 3)
- [ ] Slug matches filename (`plans/work-items/<slug>.md`)
- [ ] `tags` uses only allowed values from [work-item-tags.md](work-item-tags.md), or is empty
- [ ] `## Reference docs` includes PRD path and parent epic path when applicable
- [ ] `## Parent context` is concise enough for delivery subagents

## task

- [ ] Goal is one sentence and testable
- [ ] Every behavior change has Given/When/Then blocks
- [ ] `file_manifest` lists concrete paths (or explicit "TBD" with reason)
- [ ] `## TypeScript interfaces` present (or "none")
- [ ] No executable test code in the body
- [ ] `## Test guidance` describes RED-phase intent without prescribing implementation

## spike

- [ ] Goal states investigate outcome or phased deliverable
- [ ] Phase 1 G/W/T or explicit investigate steps documented
- [ ] If Phase 2 includes code change, Phase 2 has full G/W/T and test guidance
- [ ] Human told whether this slug is `/ww-deliver`-eligible or doc-only

## epic

- [ ] Goal is one sentence describing the grouped outcome
- [ ] Epic is justified by 3+ child items, phased delivery, multiple agents,
  shared architecture context, or cross-cutting behavior
- [ ] `## Child work items` table lists every child slug
- [ ] Each child slug has its own draft file (or is explicitly "TBD next plan pass")
- [ ] `## TypeScript interfaces` is "none"
- [ ] Orchestrator will **not** queue this slug for `/ww-deliver`

If validation fails, revise the draft and re-run this checklist. Do not
present the human gate until all boxes pass.

