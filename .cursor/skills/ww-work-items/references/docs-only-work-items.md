# Documentation-Only Work Items

Work items whose deliverable is **markdown or other static documentation**
(README, ADRs, website docs, TSDoc-only changes) must **not** prescribe or
produce executable tests (Vitest, Cucumber, Playwright, etc.) that read
`.md` files and assert regex or layout against prose.

Respect project convention in `AGENTS.md`: do not add tests for README,
TSDoc, or other documentation.

## Detecting docs-only scope

A work item is docs-only when **all** of:

- `file_manifest` lists documentation paths only (`.md`, optional static
  assets such as images under `website/docs/`)
- No runtime behavior, public API, or TypeScript implementation changes
- `## TypeScript interfaces` is `none`

If a slice mixes docs and code, split into separate work items or scope
RED to the code paths only. Do not add "documentation contract tests" to
justify the docs half.

## Planning (`/ww-plan`) rules

When drafting a docs-only work item:

1. **`## Test guidance`** must start with:
   `Docs-only: no executable RED phase.`
2. Describe verification instead: human review, optional docs site build
   (e.g. Docusaurus), link check, or spellcheck when the repo provides them.
3. **`file_manifest`** must list only documentation paths — no `*.test.ts`,
   `*.feature`, or other test harness files.
4. **Behavior spec** may use Given/When/Then for *reader outcomes* (e.g.
   "developer can distinguish presets from manual composition in README").
   Those are acceptance criteria for human review, not executable tests.
5. Do **not** prescribe:
   - "documentation contract tests"
   - Vitest/Cucumber reading README or website `.md` files
   - Regex assertions on markdown prose
   - RED phase checks against "current package exports and source layout"
     when the slice does not change runtime code

## Delivery (`/ww-deliver`) rules

For docs-only work items:

- **Skip Phase A** (`test-engineer` / RED). Record:
  `Docs-only delivery — RED phase skipped (docs-only-work-items.md).`
- Start at **Phase B** (`implement-agent`) for markdown edits only.
- **Phase C**: diff ⊆ `file_manifest`; run docs build or other checks
  named in Test guidance; do not require new test files.
- **Phase D**: verify reader outcomes and factual accuracy against the
  behavior spec.

## Anti-patterns

- `package-architecture-docs.test.ts`-style files that `readFileSync` README
  and assert regex on architecture prose
- Test guidance such as "RED phase should check documentation expectations
  against current package exports"
- Adding test files to `file_manifest` for documentation-only PRDs
