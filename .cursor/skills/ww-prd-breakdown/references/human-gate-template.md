# Human Gate Template

Present each draft work item like this:

```text
WORK ITEM: [title]
Slug: [slug]
Kind: [task|spike|epic]
Type: [feature|bug|chore]

Goal:
[one sentence]

Behavior spec:
[Given/When/Then blocks]

Files likely touched:
[file_manifest]

Out of scope:
[items]

Child work items (epic only):
[table or "n/a"]

Deliverable via /ww-deliver: [yes | no — epics always no]

Reply with:
approve
revise [note]
```

For `revise`, update the draft, re-run draft validation from
`ww-work-items`, and re-present. Do not mark the work item approved
until the human replies `approve`.

