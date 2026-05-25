# Work Item Draft Validation

Run this checklist before presenting a draft work item for human
`approve`. Fix any failing item before the human gate.

- [ ] Goal is one sentence and testable
- [ ] Every required behaviour has Given/When/Then blocks
- [ ] `file_manifest` lists concrete paths (or explicit "TBD" with reason)
- [ ] `## Out of scope` is non-empty
- [ ] `depends_on` slugs exist in `plans/work-items/` or is empty
- [ ] `loop_limit` is set (default 3)
- [ ] No executable test code in the body
- [ ] `## Test guidance` describes RED-phase intent without prescribing implementation
- [ ] Slug matches filename (`plans/work-items/<slug>.md`)
- [ ] `tags` uses only allowed values from [work-item-tags.md](work-item-tags.md), or is empty

If validation fails, revise the draft and re-run this checklist. Do not
present the human gate until all boxes pass.

