# Minimal Viable Delivery Plan: draft-PR readiness for Sail V3

Status: planning
Current slice: none — awaiting plan approval

> Not to be confused with `draft-pr-readiness.md`, which is a standing **review register**.
> This file is the **delivery plan** for the subset of that register the user has scoped in.

## Intent

- Outcome: `wip/v3-local` can be opened as a draft PR against `finos/FDC3-Sail` `main` without
  a reviewer hitting a stale branch, a licence contradiction, a 29-script front door, or docs that
  describe tooling the repo does not use.
- User: the maintainer opening the PR, and the FINOS reviewers who read it cold.
- Success: `npm run validate` exits 0 on the merged tree — all ten gates, same numbers as today
  (571 Vitest passing / 1 deliberate skip; 154 Cucumber scenarios / 1460 steps).
- Constraint: **no file deletions in this delivery** (user direction). **No commit-history rewrite**
  (user will squash-merge into a clean branch afterwards). Work happens on `wip/v3-local`.
- Out of scope: deleting `.cursor/`, `.claude/`, `AGENTS.md` or the duplicate Playwright spec;
  normalising authorship; the desktop-agent defect backlog; the iframe `sandbox` decision;
  the vite-plus / Node-24 toolchain question.

## Verify Commands

- Full: `npm run validate` — end of delivery only
- Focused: per slice, see each slice's `Verify:` line
- Typecheck/lint: `npm run lint && npm run lint:boundaries && npm run typecheck` — end of delivery only

## Simplicity Bias

- Policy: repo-local `minimal-implementation` skill exists but scopes itself to
  `packages/*/src` implementation code. **No slice here touches those trees**, so MVP defaults apply.
- Reuse: `npm run validate` already chains the exact CI gate — do not invent a new verification script.
- Avoid: hand-merging `package-lock.json`; inventing new npm scripts; rewriting docs prose beyond the
  specific false statements named below.
- Architecture: no source changes. This is config, docs and repo metadata only.

## Slices

1. Merge `origin/main` into `wip/v3-local`
   - Goal: branch is no longer 22 commits behind; every gate still green.
   - Acceptance: merge committed with no conflict markers anywhere; `npm run validate` exits 0;
     the old V2 trees (`packages/web`, `packages/common`, `packages/da-impl`) stay deleted;
     **`main`'s `.husky/` and `lint-staged.config.mjs` are rejected, not merged** — this repo already
     has a working tracked pre-commit hook at `.vite-hooks/pre-commit` (`vp staged`), wired through
     `core.hooksPath` by the `prepare` script. Taking main's would install a second hook system that
     `core.hooksPath` guarantees never runs.
   - Verify: `npm run validate`
   - Likely files: ~64 conflicted paths; the ~15 that need judgement are `ci.yml`, `package.json`,
     `package-lock.json`, `README.md`, `LICENSE`, `CONTRIBUTING.md`, `.gitignore`,
     `eslint.config.mjs`, `tsconfig.root.json`, `.prettierrc`, `.prettierignore`,
     `.vscode/{launch,settings}.json`, `.github/CODE_OF_CONDUCT.md`, `ql.yml`, `scorecard.yml`.
   - Binds Full because a merge can break anything.

2. Licence and attribution
   - Goal: one consistent copyright story.
   - Acceptance: `LICENSE` and `NOTICE` no longer contradict each other; root `package.json`
     declares `"license": "Apache-2.0"`.
   - Verify: `npm run format && node -e "if(!require('./package.json').license) process.exit(1)"`
   - Likely files: `LICENSE`, `NOTICE`, `package.json`

3. Trim the root npm scripts
   - Goal: the front door reads as ~12 scripts, not 29.
   - Acceptance: root `package.json` keeps roughly `dev`, `build`, `test`, `lint`, `format`,
     `typecheck`, `validate`, `clean`, `docs:dev`, `docs:build`, `changeset`, `release:publish`;
     Cucumber variants and docs-inventory scripts move into their owning packages;
     **every script name `.github/workflows/*.yml` invokes still exists and still works.**
   - Verify: `npm run format && npm run build && npm run lint && npm run lint:boundaries && npm run typecheck && npm run docs:build && npm test -- --run && npm run test:cucumber -w @finos/sail-desktop-agent`
   - Likely files: root `package.json`, `packages/sail-desktop-agent/package.json`,
     `website/package.json`, `.github/workflows/ci.yml`
   - Binds a near-full command because it edits the scripts every other command goes through.

4. Truth pass on docs and repo metadata
   - Goal: nothing shipped states something false about the repo.
   - Acceptance: `SECURITY.md` no longer routes vulnerability reports to a public issue nor claims
     support for `0.0.1`; the four README badges no longer point at `?branch=v3-pre`;
     `.gitattributes` exists; `website/docs/development.md` names oxlint/oxfmt rather than
     ESLint/Prettier; the `#two-entry-points` anchor resolves from both `intro.md` and
     `architecture/deployment-targets.md`; `intro.md`'s and `README.md`'s stale `sail-platform`
     "lifecycle" descriptions match the package's own README; `architecture/overview.md`'s
     `channelSelector` row no longer documents a constructor option that does not exist;
     and `onBrokenAnchors: "throw"` is set so this class of defect fails the build next time.
   - Verify: `npm run docs:conformance-inventory:check && npm run docs:build`
   - Likely files: `SECURITY.md`, `README.md`, `.gitattributes`, `website/docusaurus.config.ts`,
     `website/docs/{intro,development}.md`, `website/docs/architecture/{overview,deployment-targets}.md`

5. Make the dead-code tool runnable again
   - Goal: `knip` can start, so the audit's ~1,150-line cleanup claim becomes checkable.
   - Acceptance: one Playwright version resolves across the workspace; `npx knip` runs to completion
     and reports findings rather than dying on a config load error.
   - Verify: `npx knip --no-progress`
   - Likely files: `packages/sail-conformance-harness/package.json`,
     `packages/sail-finance/package.json`, `package-lock.json`
   - Binds Full because it changes a dependency graph.

## Test Plan

- Unit: none justified. No slice touches `packages/*/src` runtime code.
- Integration: none new. The existing 571 Vitest + 154 Cucumber suites **are** the regression test
  for slice 1 — a merge that breaks behaviour fails them.
- Manual/runtime: `npm run validate` after slice 1 and once at the end.
- Guardrail added rather than tests: `onBrokenAnchors: "throw"` (slice 4) converts the anchor defect
  class from a warning into a build failure. That is the right-sized test for a docs slice.
- Not testing: licence text, badge URLs, script renames, `.gitattributes` — asserting on these
  would test the edit rather than any behaviour.

## Agent Roles

Resolved against the agent types available this session.

- coder: `general-purpose`
- tester: none — no risk-planned tests (see Test Plan). Slice 4's guardrail is written by the coder.
- reviewer: `general-purpose`, briefed as a plan-bound reviewer with the three finding categories
- security reviewer: not applicable — no auth, secrets, user input or destructive runtime paths in scope
- explorer: `Explore`, only if a slice turns out to need a repo-wide search

## Risks

- **The merge drags back a competing hook system.** `main`'s `lint-staged.config.mjs` runs
  `prettier --write` and `eslint --fix`; this repo runs `vp fmt` / `vp lint` from
  `.vite-hooks/pre-commit`. Because `core.hooksPath` is `.vite-hooks/_`, anything landing in
  `.husky/` is inert — so merging it adds dead files that read as the real hook. Reject both.
  *(Corrects `open-items.md` §8, which lists "no local pre-commit hook" as an open gap. It is
  closed — V3 replaced husky with vite-plus hooks rather than dropping hooks.)*
- **`package-lock.json` must be regenerated, not hand-merged.** Take one side, then `npm install`.
- **Slice 3 edits the scripts every other verify command calls.** Run it after the merge has settled,
  and re-check `.github/workflows/*.yml` in the same slice.
- **This container runs Node 22; the repo declares `>=24`.** All ten gates pass anyway, but a
  Node-24-only failure would not show up here. Flag rather than chase.
- **`wip/v3-local` squashed its history** (257 commits since fork, not 293). SHAs cited in the older
  plans no longer resolve — search for findings rather than trusting line numbers.

## Slice Checkpoints

- [ ] 1 Merge `origin/main`: not started (failures: 0)
- [ ] 2 Licence and attribution: not started (failures: 0)
- [ ] 3 Trim root npm scripts: not started (failures: 0)
- [ ] 4 Truth pass on docs and metadata: not started (failures: 0)
- [ ] 5 Make knip runnable: not started (failures: 0)

## Verification Notes

- Pre-delivery baseline, measured on `04e30df` (tree-identical to `wip/v3-local` apart from
  `.vscode/settings.json`): all ten gates exit 0 — format, build, lint, lint:boundaries, typecheck,
  docs:conformance-inventory:check, docs:build, Vitest 571 passed / 1 skipped, Cucumber 154 scenarios
  / 1460 steps. Conformance 83/83 not re-run (needs a live browser).

## Review Notes

- Required:
- Follow-up:
- Ignore for MVP:

## Parked Follow-ups

- Deleting `.cursor/`, `.claude/`, `AGENTS.md` and the duplicate Playwright spec — excluded by user
  direction for this delivery. Note that three `website/docs` pages link into `.cursor/plans/`,
  so whenever the deletion happens, those two parked plans need rehoming first.
- Normalising commit authorship — user will squash-merge into a clean branch instead.
- The `vite-plus@0.2.5` override and the `node >=24` / `npm >=11` engine floor — a reviewer will ask;
  an answer is needed, but not a code change.

## Known Limitations

- No file is deleted in this delivery, so the diff still carries 160 `.cursor/` files, 7 `.claude/`
  files and a 54 KB `AGENTS.md`. A reviewer will see them.
- Conformance (83/83) is not re-run as part of `validate`; it needs a browser and runs nightly.
