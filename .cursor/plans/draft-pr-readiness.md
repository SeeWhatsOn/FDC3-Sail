# Draft PR Readiness — Review Register

> **Partly overtaken by the 2026-08-04 `sail-platform` cull.** Items about `SailPlatform`,
> `createSailBrowserDesktopAgent`, `SailAppLauncher` and `SailPlatformClient` are moot — those APIs
> are deleted. Register item 17 (make the WCP4 origin allowlist fail closed) is resolved by removal,
> with the requirement preserved in `.cursor/plans/parked-wcp4-origin-allowlist.md` as an acceptance
> criterion for any reimplementation.

> ### Third re-verification — 2026-08-14 against `a6c6b62`
>
> **The register earns its size: ~23 of 32 rows are still live.** Not a candidate for reduction or
> archiving. Five rows need updating:
>
> | Row | Change |
> |---|---|
> | **11** Demo app directory | **NOW MOOT — downgrade from `BLOCKER` to resolved.** The evidence it cites is gone: `packages/sail-finance/fixtures/default-app-directory.json` no longer exists. `sail-finance/src/main.tsx:19,125` points non-toolbox runs at the real `https://directory.fdc3.finos.org/v2/apps` and toolbox runs at the harness's own `conformance-appd.json` (all publishers `FINOS`). Open Decision #5 reads as answered and implemented. |
> | **9** CI green | **Still blocking, and the evidence here is *understated*.** The 08-07 note "lint and typecheck now exit 0" was measured against a stale local `dist`. On a genuinely clean clone they fail, because CI runs Typecheck (`ci.yml:43`) *before* Build (`:46`) while `sail-desktop-agent`/`sail-platform` publish types from gitignored `dist` — consumers hit `TS2307`. Two further steps are red outright: `docs:build` (invalid HTML comment in MDX) and the Cucumber step (missing script). All three are written up in `.cursor/plans/open-items.md` §0. |
> | **15** `sail-platform` API shape | **Consumer story is backwards.** `sail-one/src/state/client-state.ts:2-6` imports the **storage** half (`createLocalStorage`, `SailStorage`), not `createWorkspaceStore`. The workspace half — `createWorkspaceStore`, `Workspace`, `Layout` — has **zero** consumers outside the package. `sail-finance/src/stores/workspace-store.ts:205` defines its own same-named function; that is a naming collision, not an import. The "two parallel systems" framing survives; the consumer attribution does not. |
> | **19** Test state (`FIXED`) | **No longer accurate.** Vitest is 539/541, with `wcp-multi-pending-adoption.integration.test.ts` failing on two consecutive full-suite runs but passing in isolation — timing-sensitive, not conclusively a regression. And "Cucumber unchanged: 154/154" cannot be re-established: the command that would prove it now fails before any scenario runs (§0). |
> | **28** tsconfig references | **Partly fixed.** The dangling `./packages/sail-ui` reference is gone from both root and `sail-finance` tsconfigs. What still stands is the *omission* of `sail-conformance-harness` — and now `sail-one` — from root references. |
>
> Blockers **0, 3, 7, 10, 29** were each re-checked against the tree and are **unchanged**: still 22
> commits behind upstream; `LICENSE:189` still en-dash `2022–2026 FINOS` against `NOTICE:2`'s
> `2022 - 2022 Nick Kolba`; both working docs still tracked at repo root; `packages/sail-one/html/`
> still absent so `build -w @finos/sail-one` still fails on `options.input`. **29 got worse**, as the
> register predicted it would: 290 commits since fork (was 252), author split `SeeWhatsOn` ×206 /
> `Chris Watson` ×75, and the `Claude-Session:` trailer is now in **19** commits, not 9.
>
> **Net: 6 of 7 claimed blockers still block; item 11 is resolved.**

Standing oversight of what is good, bad, and unknown in the v3 work, measured against
"could this be opened as a draft PR to `finos/FDC3-Sail`". A **review artifact, not a
work order** — nothing here is committed work, and some of it may never be done.

Last reviewed: 2026-08-03 against `457a0896c` on `clde/draft-pr-readiness-review-60e643`.
**That commit is 4 behind the tip of `wip/v3-local`** (`9897b48ac`). The four missing commits
are docs-only — `website/docs/**`, `sidebars.ts`, and two `.cursor/plans` files. Spot-checked:
both doc defects in item 22 survive on the newer tip, so no finding here is stale on that
account. Re-verify before acting if `wip/v3-local` has moved again.
Method: first-pass manual review, then 10 specialist agents briefed to *falsify* the
first pass rather than confirm it, then spot-verification of every load-bearing claim.

**Last re-verified: 2026-08-07** against `wip/v3-local` @ `a903cffba`. Every item below was
re-checked against the current tree (grep, direct file reads, and — for build/test items — actually
running the commands). Full per-item results are in **"Re-verification — 2026-08-07"** below; the
Summary table's Status column is updated in place for items whose verdict changed. **Fresh count:
32 rows total. 3 newly `FIXED`** (14, 16, 19) **· 1 newly resolved by removal** (17, matching the
banner note above) **· 1 downgraded from `BLOCKER`** (15, most of what it described no longer
exists) **· 25 unchanged** (still `BLOCKER`/`NEEDS WORK`/`DECISION`/`GOOD`/`WITHDRAWN` as before,
evidence refreshed for the ones actually re-run). **7 `BLOCKER`s remain: 0, 3, 7, 9, 10, 11, 29** —
down from 8 (16 fixed; 15 downgraded to `NEEDS WORK`).

## How to read this

| Status | Meaning |
| --- | --- |
| `GOOD` | Assessed. No action needed. |
| `NEEDS WORK` | Assessed. Specific gaps listed. Does not block the draft. |
| `BLOCKER` | Assessed. Would stop or embarrass the PR. |
| `DECISION` | Needs a human answer before the work can be scoped. |
| `UNASSESSED` | No evidence either way. Absence of a finding is not a pass. |
| `WITHDRAWN` | A first-pass claim that turned out to be false. |

Evidence marked **[verified]** was re-run directly against the tree. Evidence marked
**[agent]** is a specialist's finding not independently re-checked. Everything else is
inference and is labelled as such.

---

## Read this first: the branch is nine months stale

**STATUS: `BLOCKER`. This reframes the whole review and should be resolved before
anything else on any list.**

- Merge base: `07347d448` (2025-10-21). Upstream tip: `2c91d6f66` (2026-07-22).
- **22 upstream commits are missing.** **[verified]**

Consequences:

1. **Four of the first pass's six compliance blockers were artefacts of my own method.**
   I checked deletions with two-dot `git diff upstream/main HEAD`, which compares tips —
   so anything upstream added *after* the fork appears as "deleted" from HEAD. See items
   4, 5 and 8, now `WITHDRAWN`.
2. **Real merge conflicts are queued.** `ci.yml` exists on both sides with materially
   different content (job name, pinned action SHAs, `npm ci` vs `npm i`, extra
   `lint:boundaries`/`typecheck`/`docs:build` steps here). `semgrep.yml` is byte-identical,
   so no conflict there. **[agent]**
3. **Fixing compliance before syncing wastes effort** — a merge restores several of the
   files in question automatically.

---

## Summary

| # | Area | Status | Blocks draft? | Effort |
| --- | --- | --- | --- | --- |
| 0 | **Branch staleness vs upstream** | `BLOCKER` | Yes | Hours–days |
| 1 | Toolchain (vite-plus / oxlint) | `DECISION` | Yes | Hours–days |
| 2 | PR shape and socialisation | `DECISION` | Yes | Conversation |
| 3 | Licence and attribution | `BLOCKER` | Yes | Minutes |
| 4 | ~~`MAINTAINERS.md` deleted~~ | `WITHDRAWN` | No | — |
| 5 | ~~CLA / DCO coverage~~ | `WITHDRAWN` | No | — |
| 6 | README badges | `NEEDS WORK` | Yes | Minutes |
| 7 | Working docs at repo root | `BLOCKER` | Yes | Minutes |
| 8 | ~~Security tooling removed~~ | mostly `WITHDRAWN` | No | Minutes |
| 9 | **CI green on the fork** | `BLOCKER` (narrowed 08-07) | Yes | Hours |
| 10 | **Clean-clone build** | `BLOCKER` (narrowed 08-07) | Yes | Hours |
| 11 | Demo app directory | `BLOCKER` | Yes | Hours–day |
| 12 | Package metadata and versions | `NEEDS WORK` | No | Hours |
| 13 | Release and publishing rights | `DECISION` | No | Conversation |
| 14 | API shape — `sail-desktop-agent` | `FIXED` (08-07) | No | — |
| 15 | API shape — `sail-platform` | `NEEDS WORK` (was `BLOCKER`, 08-07) | No | Hours |
| 16 | Trust boundary — identity spoofing | `FIXED` (08-07) | No | — |
| 17 | Trust boundary — origin allowlist | `RESOLVED BY REMOVAL` (08-07) | No | — |
| 18 | Complexity and dead code | `NEEDS WORK` | No | Days |
| 19 | Test state | `FIXED` (08-07) | No | — |
| 31 | Missing `.gitattributes` | `NEEDS WORK` | No | Minutes |
| 20 | AI tells | `NEEDS WORK` | No | ~2 hours |
| 21 | README / CONTRIBUTING truthfulness | `NEEDS WORK` | Yes | Hours |
| 22 | Docs site | `NEEDS WORK` | No | Hours |
| 23 | Agent config in the diff | `NEEDS WORK` | Yes | Minutes |
| 24 | PR description | `NEEDS WORK` | Yes | Hours |
| 25 | Shell scope (two demo apps) | `DECISION` | No | Conversation |
| 26 | Conformance harness | `GOOD` | No | Confirm only |
| 27 | v2 → v3 feature regressions | `NEEDS WORK` | Yes | Hours to document |
| 28 | tsconfig project references | `NEEDS WORK` | No | Hours |
| 29 | **Commit history and metadata** | `BLOCKER` | Yes | Hours |
| 30 | `console.log` in shipped code | `NEEDS WORK` | No | ~1 hour |

**Eight blockers** at the last full review. The build does not build and CI is not green (9, 10) —
that outranks everything else, because nothing below it can be trusted until it is. Then: a genuine
security vulnerability (16), nine months of drift (0), authorship metadata visible on GitHub
before anyone reads a line of code (29). Three are cheap (3, 7, 11 — though 11 needs a
decision, not just a delete). **As of 2026-08-07, 16 is fixed and 15 is downgraded — 7 blockers
remain: 0, 3, 7, 9, 10, 11, 29.**

---

## Re-verification — 2026-08-07

Every item re-checked against `wip/v3-local` @ `a903cffba`, by direct grep/read and — for 9, 10, 19
— actually running the commands. `unchanged` means the underlying fact is still true; it does not
mean untouched, it means re-confirmed.

| # | Status now | Evidence |
|---|---|---|
| 0 | unchanged — `BLOCKER` | `git merge-base upstream/main HEAD` still `07347d448`; still 22 commits behind upstream, now 252 ahead (was 218) |
| 1 | unchanged — `DECISION` | `package.json` still overrides `vite` to `@voidzero-dev/vite-plus-core@0.2.5`; `oxlint` still an undeclared transitive devDependency |
| 2 | unchanged — `DECISION` | No repo artifact answers PR shape/socialisation; still a conversation |
| 3 | unchanged — `BLOCKER` | `LICENSE` still en-dash `2022–2026 FINOS`; `NOTICE` still unreconciled `2022 - 2022 Nick Kolba` |
| 6 | unchanged — `NEEDS WORK` | `README.md:20,23,24,25` still 4 badges pinned to `?branch=v3-pre` |
| 7 | unchanged — `BLOCKER` | `ARCHITECTURE-REMEDIATION-PLAN.md` (36,540 B) and `FDC3-SAIL-REVIEW.md` (46,651 B) still at repo root |
| 8 | unchanged — mostly `WITHDRAWN` | Same file-presence matrix; no local pre-commit hook still the real gap |
| 9 | **narrowed — `BLOCKER`** | `npm run lint` and `npm run typecheck` now exit 0 (item 10's tsconfig fix cascaded). Vitest now 462/462 (was 449/450). `ci.yml`'s Build step still lists exactly `sail-desktop-agent`, `sail-platform`, `sail-finance`, `sail-conformance-harness` — **still omits `sail-one`** — so the falsely-green Build step is still the live defect, not the failing lint/typecheck/test that used to co-occur with it |
| 10 | **narrowed — `BLOCKER`** | `packages/sail-finance/tsconfig.json` now has `"types": ["node", "vitest/globals"]` — that half is fixed. `packages/sail-one/html/` still does not exist; `npm run build -w @finos/sail-one` still fails: `[INVALID_OPTION] You must supply options.input` from `vite.config.ts:68`'s `globSync("html/**/*.html", ...)` returning `[]`. Build genuinely still fails |
| 11 | unchanged — `BLOCKER` | Not re-walked in full this pass; `sail-one`'s build failure (item 10) is a new, separate reason the demo-app-directory decision still can't be closed out |
| 12 | unchanged — `NEEDS WORK` | `sail-desktop-agent/package.json` `exports["."]` still orders `import, types, default`; `sail-platform/package.json` still correctly orders `types` first — still inconsistent. Root `package.json` still has no `license` field. `.changeset/config.json`'s ignore list now also omits `sail-one` (private, unpublished) alongside `sail-theme` |
| 13 | unchanged — `DECISION` | `npm view @finos/sail-desktop-agent` / `@finos/sail-platform` both still 404 |
| 14 | **FIXED** | `attachAppConnection` — zero matches anywhere in `packages/sail-desktop-agent/src` (only in docs/plans, now flagged separately in the website-docs-blueprint carry-forward). `.connector` renamed to `.appConnection`, documented as intentionally public with rationale (`index.ts:59-70`); the `sail-finance` banning test (`connection-store.test.ts:201`) updated to match the new name. The phantom `DACPValidationError` class is gone — `dacp-errors.ts` now only has `DACPTimeoutError`/`DACPProcessingError`, both actually constructed and used. README now points to a dedicated integrator guide instead of a bare 4-line sample |
| 15 | **downgraded — `NEEDS WORK`, was `BLOCKER`** | `packages/sail-platform/src/index.ts` now exports only `createWorkspaceStore`/`Workspace`/`Layout`/storage helpers. `SailPlatform`, `createSailBrowserDesktopAgent`, `MiddlewarePipeline`, `.use()`, `generateUuid` — zero matches repo-wide outside docs/plans; the whole "published no-op `.use()` API" and "own-goal boundary cast" findings are moot, the code they were about is gone. `wcp4-origin-allowlist.ts` no longer exists (see item 17). **Still real:** `sail-one/src/state/client-state.ts` now imports `createWorkspaceStore` from `@finos/sail-platform` — a genuine consumer exists now — but `sail-finance/src/stores/workspace-store.ts` still runs its own separate Zustand store. Two systems, one of them now actually used |
| 16 | **FIXED** | `browser-app-connection.ts`'s `enrichMessageWithSource` (~line 198-228) now strips `hostInstanceId` alongside `source`/`messageOrigin`, with a comment explaining why. `handlers/utils/resolve-context-listener-instance-id.ts` no longer reads `meta.hostInstanceId` at all — comment at `:11-18` documents the fix and the reasoning |
| 17 | **RESOLVED BY REMOVAL** | `packages/sail-platform/src/wcp4-origin-allowlist.ts` no longer exists. Matches this file's own header banner and `.cursor/plans/parked-wcp4-origin-allowlist.md`, which preserves the fail-closed requirement for any reimplementation |
| 18 | unchanged — `NEEDS WORK` | Sub-findings 1 (dead `.use()`) and 2 (dead workspaces/layouts stack) are resolved via item 15's deletion; sub-findings 3–5 (`handleWcp4ValidateAppIdentity` complexity, `private-channel.ts` repetition, dead `panel-store.ts`) not re-walked, no reason to expect they changed |
| 19 | **FIXED** | Vitest 462/462 (69/69 files). The specific failing test, `sail-platform/src/__tests__/host-contracts-reexport.test.ts`, no longer exists — the file (and the API it tested) was deleted in the `sail-platform` cull, not fixed in place. Cucumber unchanged: 154/154 scenarios, 1461/1461 steps |
| 20 | unchanged in substance — `NEEDS WORK` | Dead duplicate class `WCPEventEmitter` — zero matches repo-wide, gone (tracks item 15/18). Divider-comment pattern persists: `state/types.ts` 18, `app-directory/types.ts` 10, `handlers/types.ts` 6, `fdc3-errors.ts` 6 (the old `sail-platform.ts` 16-divider file is gone with the rest of that package). Formulaic commit phrasing ("Enhanced… ensuring…") still present, 118 hits across 252 since-fork commits, including the current tip commit |
| 21 | unchanged — `NEEDS WORK` | `website/docs/development.md` still names ESLint/Prettier as the tooling and still says `validate` runs "Prettier, ESLint" |
| 22 | not fully re-walked — `NEEDS WORK` | The two specific broken samples cited (platform `desktopAgent.start()` double-start; `platform.start({ onChannelChanged })`) describe APIs since deleted in the cull, so those exact lines are moot — but the docs site was independently re-audited in full while closing out `.cursor/plans/archive/website-docs-defect-register.md` this same session; see the new "Open doc defects" section added to `.cursor/plans/website-docs-blueprint.md` for what's actually still wrong on the site today |
| 23 | unchanged, sizes grown — `NEEDS WORK` | `.claude/` 7 tracked files; `.cursor/` 149 tracked files (was 143); `AGENTS.md` 49,427 bytes (was 45,894) |
| 24 | unchanged — `NEEDS WORK` | No PR description artifact exists |
| 25 | unchanged — `DECISION` | Both `sail-one` and `sail-finance` still in the diff |
| 26 | unchanged — `GOOD` | `results/conformance-report-v6.txt` is still the latest committed export, not regenerated |
| 27 | unchanged — `NEEDS WORK` | `WorkspaceDirectory.tsx:109` still defines and renders `MOCK_WORKSPACES` behind its TODO. Native-app WebSocket instructions still ported into `sail-one/src/appd/appd.tsx` with no server-side bridge behind them (same gap, now also present in `sail-one`, not just the original v2→v3 comparison) |
| 28 | unchanged — `NEEDS WORK` | Root `tsconfig.json:5-10` still references `./packages/sail-ui` (doesn't exist) and still omits `sail-conformance-harness`. `sail-finance/tsconfig.json` still carries the same dangling `../../packages/sail-ui/src/**/*` include behind its `_comment` TODO |
| 29 | unchanged in substance, evidence updated — `BLOCKER` | Since-fork commit count now 252 (was 218). Author split now `SeeWhatsOn` ×169 / `Chris Watson` ×74 (was 135/74). `Cursor Agent <cursoragent@cursor.com>` still exactly 9 commits. `Claude-Session:` trailer now found in **9** commits, not the 1 originally recorded — larger than reported. **One correction:** the two specific `cursor/…` merge-commit subjects the doc names are **not ancestors of current HEAD** (`git merge-base --is-ancestor` false for both) — they exist only on other refs, not on `wip/v3-local`. The broader finding (formulaic messages, author split, session trailers) still holds and looks worse by trailer count |
| 30 | unchanged in substance, evidence updated — `NEEDS WORK` | 35 real `console.log` hits now (was 45), after excluding false-positive JSDoc examples. Same hotspots: `Layout.tsx` 9, `connection-store.ts` 7, `intent-resolver-store.ts` 4, `main.tsx` 4. `sail-platform.ts`'s 3 are gone because that file no longer exists (item 15) |
| 31 | unchanged — `NEEDS WORK` | Still no `.gitattributes`. Local `npm run format` now flags only 9 files (was 434) in this environment — narrower symptom, same unfixed root cause (`eol=lf` not enforced) |

---

## Findings

### 0. Branch staleness — `BLOCKER`

See above. **[verified]** `git merge-base upstream/main HEAD` → `07347d448`;
`git rev-list --count HEAD..upstream/main` → 22.

### 1. Toolchain — `DECISION`

`package.json:50` sets `"vite": "npm:@voidzero-dev/vite-plus-core@0.2.5"` as a repo-wide
override, plus `vite-plus@0.2.5` as the `vp` CLI behind `lint`/`format`/`test`, plus
oxlint/oxfmt config.

Licences check out — vite-plus MIT, oxlint MIT, knip ISC, vite-plus-core MIT. **[agent]**
So the objection is not legal; it is that a pre-1.0 vendor alias silently substituting a
core build dependency is a hard sell on a FINOS incubating project carrying an OpenSSF
Scorecard. *(Inference. No maintainer has said this.)*

**New, concrete fragility:** `lint:boundaries` runs `oxlint`, but `oxlint` is **not** a
declared root devDependency — it resolves only because `vite-plus@0.2.5` happens to depend
on it and npm hoists its bin. A vite-plus bump that drops or re-versions oxlint breaks the
script with no signal in `package.json`. **[agent]**

Answer this first: it changes items 6, 8, 9, 12, 21.

### 2. PR shape and socialisation — `DECISION`

877 files against the fork point; 847 against upstream's current tip. **[agent]** Deletes
four upstream packages. Not linearly reviewable.

Open: single draft PR framed as a discussion artifact, or a stacked series? And do the
FINOS maintainers know it is coming? Not visible from the repo.

### 3. Licence and attribution — `BLOCKER`

`LICENSE` copyright changed from `Copyright 2022 Nick Kolba` to `Copyright 2022–2026 FINOS`.
**[verified]**

Worse than first reported **[agent]**: the separator is a Unicode **en-dash (U+2013)**, and
`NOTICE` was left untouched, so it still reads `Copyright 2022 - 2022 Nick Kolba` — the two
files now disagree. Attribution is a foundation/legal decision, not a contributor edit.

Not a gap: this repo has **no** per-file Apache header convention (2 hits repo-wide, one in
a deleted legacy file), so "new files missing headers" is not a real finding. **[agent]**

### 4. `MAINTAINERS.md` — `WITHDRAWN`

**My claim was false.** The file was never in this branch's lineage; upstream added it in
`ea6dc71be` (#295) after the fork. **[verified]** A sync restores it.

### 5. CLA / DCO — `WITHDRAWN`

**Not a defect.** FINOS uses EasyCLA (an org-level app, no repo config file), not DCO.
Upstream's own history carries only 10 sign-offs across its whole life, so sign-off is
plainly not the gate. `CONTRIBUTING.md:15` is accurate as written. **[agent]**

Worth one line in the PR body so a reviewer does not misread the absence as a DCO gap.

### 6. README badges — `NEEDS WORK`

**Four** badges pin `?branch=v3-pre` — `README.md:20, 23, 24, 25`. My "five" was wrong, and
my speculation that something referenced the deleted `lint.yml` is **false** — zero
references. **[agent]**

`v3-pre` exists only on the personal fork, and the workflows push-trigger on `main` only,
so the badges will render dead once viewed on `finos/FDC3-Sail`. All 28 other README links
resolve. **[agent]**

### 7. Working docs at repo root — `BLOCKER`

`ARCHITECTURE-REMEDIATION-PLAN.md` (36,241 bytes) and `FDC3-SAIL-REVIEW.md` (46,134 bytes).
**[verified]** Both reference internal working branches (`wip/v3-local`), a
`claude.ai/code/artifact/…` link, and environment-specific paths. **[agent]** Unambiguously
internal scratch. Do not ship.

### 8. Security tooling removed — mostly `WITHDRAWN`

Presence matrix at fork / HEAD / upstream-tip **[agent]**:

| File | Fork | HEAD | Upstream | Verdict |
| --- | --- | --- | --- | --- |
| `.semgrepignore` | no | no | yes | Added upstream post-fork — `WITHDRAWN` |
| `.husky/pre-commit` | no | no | yes | Added upstream post-fork — `WITHDRAWN` |
| `lint-staged.config.mjs` | no | no | yes | Added upstream post-fork — `WITHDRAWN` |
| `eslint.config.mjs` | yes | no | yes | **Genuine deliberate deletion** |
| `.prettierrc` | yes | no | no | Upstream dropped it too — convergent |
| `.github/workflows/lint.yml` | yes | no | no | Upstream dropped it too — convergent |

`semgrep.yml` is byte-identical to upstream and still runs; upstream's `.semgrepignore`
only excludes a CI artifact, so the practical scanning impact is negligible — not the gap
I implied.

**What is real:** there is now **no local pre-commit enforcement at all**. `.husky` is
absent and `"prepare": "vp config"` installs no git hook. CI is the only gate.

### 9. CI green on the fork — `BLOCKER`

**Three of CI's eight steps fail today, and a fourth is falsely green.** Established by
running every CI step locally on node 24. **[agent, headline items re-verified]**

| CI step | Result | Cause |
| --- | --- | --- |
| `npm ci` | Pass | 5m20s, 2015 packages |
| Prettier (`npm run format`) | Pass on Linux | Local Windows failure is a CRLF artifact — item 31 |
| ESLint (`npm run lint`) | **Fail** | sail-finance tsconfig (item 10) |
| `lint:boundaries` | Pass | clean, 3.4s |
| Typecheck | **Fail** (exit 2) | sail-finance tsconfig (item 10) |
| Build | Pass — **falsely** | CI omits `sail-one`, the one broken package |
| Docs build | Pass | 3m |
| Vitest | **Fail** | 1 of 450 (item 19) |
| Cucumber | Pass | 154/154 in 15s |

The falsely-green Build step is the structural problem, not the individual failures. CI at
`ci.yml:46-49` builds four packages explicitly and **omits `sail-one`**, while the root
`build` script — the one the README tells contributors to run — includes it. **[verified]**
So a total build failure is invisible to CI by construction.

### 10. Clean-clone build — `BLOCKER`

`npm ci` succeeds into a genuinely empty worktree. **[verified]** Then:

**`npm run build` fails outright.** `packages/sail-one/vite.config.ts:68` sets
`input: globSync("html/**/*.html", …)`, and `packages/sail-one/html/` **does not exist** —
only `public/`, `src/`, `images/`. **[verified]** `globSync` returns `[]`, rolldown gets zero
entrypoints and errors `[INVALID_OPTION] You must supply options.input`. The config was added
in `06476be62` with no `html/*.html` ever added alongside it. **[agent]** The other four
packages build clean.

**`npm run typecheck` fails, exit 2**, and `npm run lint` fails identically — one shared
cause. `packages/sail-finance/tsconfig.json` sets `"types": ["vitest/globals"]`, which
overrides TS's default of loading all `@types/*`. `@types/node` is installed and hoisted, but
not in that array, so `process`, `__dirname` and `path` are invisible — and
`playwright.config.ts` is in that tsconfig's `include`. **[agent]** Fix is adding `"node"` to
the array. Note this is the same tsconfig carrying the dangling `sail-ui` TODO from item 28.

This is the loudest "did anyone run this?" signal in the review, and none of it is subtle
architecture — it is three independent *nobody ran it end-to-end* bugs.

Still missing regardless: screenshots or a short capture for the PR body.

### 11. Demo app directory — `BLOCKER`

Two agents reached different conclusions; both are partly right. The combined picture:

- The seven upstream `directory/*.json` demo apps were removed **by upstream itself**, in
  `307645509`, not an ancestor of this branch. Upstream's current tip ships **no** bundled
  demo apps at all. So this is not a v3 regression. **[agent]**
- v3 does ship a replacement: `packages/sail-finance/fixtures/default-app-directory.json`,
  loaded at runtime via `main.tsx:11` — not a test fixture. **[verified]**
- **That replacement does not work and is not ours.** All nine entries carry
  `"publisher": "EW"` (matching the `ew-remote` → `Elgin-White/fdc3-sail`) and point at
  `localhost:5174/5175/5176/5178/5188/5190/5191/3000/4175` for services that exist nowhere
  in this repo. It references a `voice-agent` package that is not in the tree. **[verified]**

Exposure is low — app ids, titles, localhost URLs. No credentials, no proprietary code, no
internal hostnames. But it is another organisation's application list, under a non-FINOS
publisher tag, in a contribution to FINOS, and every app fails on open.

Honest framing for the PR: *v3 is ahead of upstream on having a demo at all, and the demo
it has does not run.* Replacing it is real work — standing up demo apps or pointing at
hosted equivalents — not a cleanup line.

### 12. Package metadata and versions — `NEEDS WORK`

**Confirmed bug:** `sail-desktop-agent`'s `exports["."]` orders conditions `import`, `types`,
`default`. Node/TS match in declaration order and `types` must come first under
`node16`/`nodenext`. `sail-platform` gets this right, so the two published packages are
inconsistent with each other. Already logged as NEW-4 in the repo's own review doc on
2026-07-28 and still unfixed. **[agent]**

Other gaps **[agent]**: no package anywhere has `keywords`; root `package.json` has no
`license` field despite `LICENSE`/`LICENSE.spdx` at root; `sail-finance`, `sail-one`,
`sail-conformance-harness` and `website` have no `description`; `sail-one` carries
`files: ["dist"]` while `private: true`, which is dead config.

Versions are coherent but undocumented — `3.0.0-pre.1.0` means "v3 rewrite of a formerly
published API", `0.0.1` means "new, never published", `0.0.0` means "private, never
versioned". Nothing states this.

`.changeset/pre.json` pre-mode is intentional, not accidental; exiting is a manual
`changeset pre exit` that nothing triggers. `.changeset/config.json` ignores three private
packages but omits `sail-theme`, which is the same kind of package. **[agent]**

**Premise I got wrong:** `.changeset/pre.json` lists `@finos/sail-docs`, and that *is* the
website package's real name. No mismatch. **[agent]**

### 13. Release and publishing rights — `DECISION`

`release:publish` publishes under `@finos`, which is a maintainer permission.

**This got easier:** `npm view` returns 404 for both `@finos/sail-platform` and
`@finos/sail-desktop-agent` — never published. **[verified]** Upstream's v2 packages are
also 404. **[agent]** So every "check for external consumers before removing" caveat is
void, and there is no npm migration problem for anyone.

### 14. API shape — `sail-desktop-agent` — `NEEDS WORK` *(was `GOOD` — my error)*

The first pass rated this `GOOD` because every export carries an `@internal` label. That
verified the wrong thing.

**Root cause: `@internal` is decorative here.** There is no `stripInternal` and no
api-extractor anywhere in the repo. **[verified]** Plain `tsc` treats the tag as a comment,
so every symbol labelled internal still emits into the `.d.ts` as public API. The label
documents an intention the build does not enforce.

Consequences **[verified unless noted]**:

- `attachAppConnection` is public at `desktop-agent.ts:467` with no access modifier,
  despite the surface-reduction plan claiming this seam was closed. Two test files already
  call it from outside the constructor. **[agent]**
- The exported "error contract" is not one. `index.ts:55` says *"Errors thrown on paths a
  host can catch"*, but `DACPValidationError` is **never constructed anywhere**, and
  `DACPTimeoutError`/`DACPProcessingError` are always converted to wire responses inside
  `routeDACPMessage` and never re-thrown to a host. **[agent]**
- `.connector` is a public handle to the whole internal connection object, and
  `sail-finance` already has a regression test at `connection-store.test.ts:201` banning
  `agent.connector` — the team knew it was a foot-gun and enforced it with a string match
  rather than an access modifier.
- **README cold-start fails at step two.** The README's only sample is a four-line
  constructor call; it never shows the `AppLauncher` shape, never mentions `apps`,
  `channels` or `intentResolver`, and gives no way to discover `agent.apps.open(...)`.
  **[agent]**

### 15. API shape — `sail-platform` — `BLOCKER`

**A published no-op API.** `createSailBrowserDesktopAgent` returns
`Object.assign(desktopAgent, { use })` at `sail-browser-desktop-agent.ts:94`. Calling
`.use(middleware)` registers into a `MiddlewarePipeline` whose `.execute()` is **never
called anywhere in the package**. **[verified]** A consumer gets a method that looks like it
works and silently does nothing. Two agents found this independently.

The package description promises "middleware and transports". Middleware is inert, and
`sail-desktop-agent/src/index.ts:7-8` explicitly states *"There is no transport abstraction
to configure"* — so the description contradicts its own dependency.

**Dead persistence stack.** `SailPlatform.workspaces` and `.layouts`, plus
`SailPlatformClient` and `LocalStorageBackend`, have zero callers anywhere in the monorepo,
while `sail-finance` independently built a competing workspace store. Two parallel systems,
one unused. The `"remote"` storage branch throws `"not yet implemented"` and is never
selected. **[agent]**

**Own-goal on the boundary.** `wcp4-origin-allowlist.ts:68` casts
`desktopAgent as unknown as DesktopAgentInternals` and reassigns a method declared `private`
at `desktop-agent.ts:244`; the same file reaches
`desktopAgent.connector.connectionRegistry.sendToAppInstance(...)`. **[verified]** The
package meant to model correct usage of the agent cannot do its job without casting past
the agent's access modifiers. The reviewing agent downgraded its own boundary rating from
`GOOD` to `NEEDS WORK` on this basis and raised the `.connector` leak to blocker-grade,
because the leak is now load-bearing rather than cosmetic.

Proposed fix, concrete: a `validateOrigin?: (ctx) => boolean | Promise<boolean>` hook on the
already-public `appConnectionOptions`, with the agent constructing the WCP5 failure response
itself. Removes both casts. **[agent]**

**Docs contradiction resolves cleanly, contrary to the agent's first report.** The
extensibility doc's "demote `SailPlatform` because the shipping shell uses the other export"
is reasoning from consumer count, which this project explicitly rejected; the design doc
supersedes it ten days later, and explicitly marks `MiddlewarePipeline` superseded at
`sail-platform-design.md:197`. **[verified]** Nothing to escalate. What remains is narrower:
`index.ts`'s banner comments still carry the old maturity framing.

Also: `generateUuid` is exported from a public SDK surface as a one-line wrapper around
`crypto.randomUUID()`, while `LocalStorageBackend` carries a *second*, private, more
defensive UUID generator. Two implementations, one exported. **[agent]**

### 16. Trust boundary — identity spoofing — `BLOCKER` (the one real vulnerability)

**Any connected app can impersonate any other app.**

`resolve-context-listener-instance-id.ts:25-29` reads `message.meta.hostInstanceId` — an
app-supplied field — and returns it *before* the trusted, port-derived `context.instanceId`.
**[verified]** Its own JSDoc three lines above says *"Never guess identity from app-supplied
`meta.source.appId`"*: it guards one app-supplied field and trusts another.

`enrichMessageWithSource` destructures out exactly `source` and `messageOrigin`, so
`...safeMetaRest` carries `hostInstanceId` straight through, under a comment claiming it
strips app-authored identity fields. **[verified]** No production code ever sets the field on
an inbound message. **[verified]**

Attack: an attacker app completes a normal handshake, learns a victim's `instanceId` (not
secret — handed out in `findInstancesResponse`, broadcast events, intent metadata), then
sends a `broadcastRequest` with `meta.hostInstanceId` set to the victim's id. Every
downstream authorization check runs against the victim's identity, so the broadcast lands on
private channels the attacker was never granted, attributed to the victim. **[agent]**

Two things make it worse:

- **`ValidationMode: "strict"` does not help.** FDC3's own schemas declare `"meta": true` —
  unconstrained by design. The payload is fully spec-valid. **[agent]**
- **The default is `"warn"`**, which dispatches malformed messages to handlers anyway.

A version-gated `closeRequest` path additionally allows terminating arbitrary app instances,
currently gated behind `fdc3Version >= 3.0` (default `2.2`). A reprieve, not a defence.

**Fix confirmed simple.** Strip `hostInstanceId` alongside `source`/`messageOrigin` in
`enrichMessageWithSource`. The apparent second reader in `wcp-host-instance-adoption.ts:44`
is a naming collision — it derives from the WCP4 *payload*, `window.name`, or pure state
lookup, never from DACP `meta`, so stripping has zero effect on that path. **[verified]**

**Coverage gap:** `wcp-trusted-metadata.test.ts` has two tests, both for `messageOrigin` and
`source.appId`. The team built and tested exactly this class of defence, and a second
identity-resolution path bypassed it. **[verified]**

Not runtime-reproduced. Static trace only, across multiple independent reads. A one-line PoC
test should confirm before this is treated as settled.

### 17. Trust boundary — origin allowlist — `NEEDS WORK` *(downgraded from my framing)*

**I overstated this.** An unconfigured host does **not** accept arbitrary origins.
`wcp-identity-url-matching.ts:38` does a hard, unconditional
`parsedAppDUrl.origin !== identityUrl.origin` rejection against App Directory URLs, plus a
three-way cross-check of identity origin, actual URL origin and recorded `MessageEvent.origin`.
`allowedOrigins` is optional policy *narrowing* within already-trusted origins. **[agent]**

What survives: the control is a monkey-patch that works only because `start()` happens to do
a dynamic `this.handleMessage` lookup rather than binding early. Change that one line to
`.bind(this)` — a strictly cleaner-looking refactor — and the wrapper becomes a dead property
that never runs, with no type error (the `as unknown as` cast erased the check) and no test
failure. The existing suite drives a hand-built mock with a `vi.fn()`; it proves the
wrapper's branching and nothing about interception. **[agent]**

### 18. Complexity and dead code — `NEEDS WORK`

Ranked, worth doing **[agent]**:

1. The dead `.use()` middleware API (item 15).
2. The dead workspaces/layouts stack (item 15).
3. `handleWcp4ValidateAppIdentity` — one ~245-line function doing five jobs
   (`wcp-identity-validation.ts:48-294`). Essential complexity is real; the decomposition
   is not. Highest-risk file to touch blind.
4. `private-channel.ts:81-110` repeats an identical filter-and-delete across five listener
   maps. Add a sixth listener type and it is easy to miss one — a real drift risk.
5. `sail-finance`: `panel-store.ts` is alive only in its own test; 14 of 20 exported
   workspace-store actions have zero callers.

Explicitly **not** findings: `sidebar.tsx` (694 lines) is vendored shadcn/ui boilerplate,
not tangled logic. No genuine swallowed-error patterns — every empty catch reviewed is a
deliberate, commented fallback. **Nothing real found on performance**, which is worth
stating plainly rather than inventing something.

TODOs: 6 files, not 5. Two converge on the same underlying `BrowserTypes` timestamp-typing
issue and should become one upstream GitHub issue.

### 19. Test state — `NEEDS WORK` (but the numbers are good)

**Real figures, for the PR body — do not imply coverage beyond these** **[agent]**:

- **Vitest: 449 of 450 passing**, 71 of 72 files, across all five packages.
- **Cucumber: 154 of 154 scenarios, 1461 of 1461 steps**, in 15s.
- **Conformance toolbox: 53 of 79** (item 26).

The single failure is deterministic and will reproduce on Linux:
`sail-platform/src/__tests__/host-contracts-reexport.test.ts` regex-matches the re-export
line as text, accepting `./host-contracts` or `./host-contracts/index.js`. The actual source
at `sail-desktop-agent/src/index.ts:47` is `export * from "./host-contracts/index"` —
extensionless, matching neither. **[verified]** Minutes to fix.

Worth noting what that test *is*: a regex over source text rather than a behavioural
assertion. It is in the same family as the `agent.connector` ban test in `sail-finance`
(item 14) — the codebase enforces structural rules by string-matching source, which is
brittle by construction and is what broke here.

### 31. Missing `.gitattributes` — `NEEDS WORK`

There is no `.gitattributes` in this branch **or** upstream, while `.oxfmtrc.json` requires
`"endOfLine": "lf"`. Any Windows contributor with the common `core.autocrlf=true` sees
**every tracked file** fail `npm run format` locally — 434 of 435 in this environment —
despite the committed blobs being pure LF. Confirmed by raw blob inspection: `HEAD:package.json`
is `7b 0a`, the working tree is `7b 0d 0a`. **[agent]**

This does not affect CI (`ubuntu-latest` does no such conversion), so it is not a PR blocker.
It does mean local format-check is broken out of the box for a meaningful share of Windows
contributors. `* text=auto eol=lf` fixes it.

**Do not read the "434 files fail formatting" result as formatting drift** — it is an
artifact, and the agent flagged it as disconfirming its own brief.

### 20. AI tells — `NEEDS WORK` *(and my first read was wrong)*

I originally reported this area as better than expected, based on a lexical sample. The
vocabulary *is* clean — no emoji, zero hits for *comprehensive / seamless / leverage /
delve*. But the sample measured the wrong thing.

- **77 divider comments across 8 files.** **[verified]** `state/types.ts` 18,
  `sail-platform.ts` 16, `sail-types.ts` 11, `app-directory/types.ts` 10, then 6/6/6/4.
- **A dead duplicate class.** `wcp-event-emitter.ts` exports `WCPEventEmitter` with zero
  imports repo-wide; its executable code is identical to the live
  `AppConnectionEventEmitter`, differing only by carrying more JSDoc. **[agent]** The
  strongest single tell — an entire orphaned file is instantly visible in a GitHub file list.
- **Two guards whose premise is false.** `fdc3-errors.ts:72`
  `super(ResolveError.UserCancelled || "UserCancelledResolution", …)` guards an
  always-truthy string enum member with a byte-identical literal; `:83-84` fabricates
  optionality via a cast for a member that is present. The JSDoc claims both are FDC3 3.0
  additions, but they ship in the installed 2.2.3. **[agent]**
- **Identical JSDoc on unrelated declarations.** `handlers/types.ts:33-42` — correct for
  `PendingIntentPromiseEntry`, nonsense for the two-member string union above it. **[agent]**
- Restating comments concentrated in three test mocks. **[agent]**

Nuance worth keeping: restating field JSDoc does **not** co-occur with banners uniformly.
In `app-directory/types.ts` the field docs mirror official FDC3 App Directory spec text and
should be kept — strip the banners only. **[agent]**

**Large `UNASSESSED` remainder**, disclosed by the agent itself: all ~15
`handlers/intents/*.ts` bodies, most of `app-connection/**`, all of `dacp/**` and `agent/**`,
and the package's README/config files were never opened. All four confirmed findings sit
*inside* areas marked unassessed, which is reason to expect more.

### 21. README / CONTRIBUTING truthfulness — `NEEDS WORK`

**`CONTRIBUTING.md` is clean** — contrary to my expectation. It contains no references to
husky, lint-staged, eslint or prettier; it is governance-only and correctly describes the
Changesets flow. **[agent]**

**The stale-tooling problem lives in `website/docs/development.md`** and is blocker-grade for
a contributor following it **[agent]**:

- `:28` names ESLint and Prettier as the shared tooling. Neither is a dependency.
- `:151` says `npm run validate` runs "Prettier, ESLint". It runs `vp fmt` / `vp lint`.
- `:241-242` recommends the ESLint and Prettier VS Code extensions. No config exists.

Root README is otherwise accurate — every command checked resolves to a real script.
**[agent]** Gaps: the Packages/Apps tables omit `sail-one` and `sail-conformance-harness`,
both real workspaces with their own READMEs, on the very PR meant to introduce them.

### 22. Docs site — `NEEDS WORK`

Two samples that do not run **[agent]**:

- `packages/platform/overview.md:76-84` calls `desktopAgent.start()` after
  `createSailBrowserDesktopAgent`, which already auto-starts → throws
  `"DesktopAgent is already started"`. The comment directly above correctly describes
  auto-start; the code contradicts it.
- `architecture/channel-selection.md:109` shows `platform.start({ onChannelChanged })`
  against a real `start(): void`. Already logged as row A8 in your own defect register —
  known, still unfixed.

Also: `sail-platform/README.md:9-10` has two broken doc links (`platform-api/overview` should
be `platform/overview`; `architecture/sail-platform-sdk` does not exist).
`conformance.md` claims 103 tagged scenarios where a direct count gives ~136, and cites three
feature files that do not exist. `sail-one` has no page on the docs site at all.

Otherwise the doc set is genuinely good — information architecture is coherent and most
pages were checked line-by-line against source.

### 23. Agent config in the diff — `NEEDS WORK`

`.claude/` 7 files / 39,966 bytes; `.cursor/` 143 files / 941,220 bytes; `AGENTS.md` 45,894
bytes. With item 7, **~1.06 MB across 152 tracked files**. **[agent]**

Nothing in the READMEs or `website/` links into them, so deletion breaks nothing. **[agent]**
`AGENTS.md` additionally documents internal branch names (`v3-pre`, `wip/v3-local`) that
contradict the branch actually being opened.

**This register lives in `.cursor/plans/` and goes with them.** Copy it out first.

### 24. PR description — `NEEDS WORK`

Does not exist. For this diff it does more reviewing work than the diff. Needs: the why;
what happens to a v2 user; what is deliberately deferred; the item 1 justification; real
test numbers; screenshots; explicit draft framing; and the notes flagged in items 5, 11, 27.

### 25. Shell scope — `DECISION`

Both `sail-one` and `sail-finance` are in the diff. Two demo shells is a harder sell than
one. Note `sail-one` currently produces no build output (item 10).

### 26. Conformance harness — `GOOD`

**The strongest fact in the PR.** `sail-conformance-harness` is a real integration with the
official FINOS FDC3 conformance toolbox, not internal scaffolding. Latest committed export
(`results/conformance-report-v6.txt`): **53 passing / 26 failing**, up from 15/60 on the
first clean-room run. Most remaining failures are attributed to harness session-teardown
hygiene rather than missing agent capability; the genuine open items are `getResultMetadata()`
and `AppMetadata.desktopAgent`, plus a `findIntent` dedupe question blocked on a FINOS spec
clarification. **[agent]**

Keep it. Already `private: true` and already out of `release:publish`, so it costs nothing
in PR scope.

### 27. v2 → v3 feature regressions — `NEEDS WORK`

**FDC3 coverage went up, not down.** v3 implements everything v2's `da-impl` did, plus
`fdc3.close` and `IntentListenerConflict`, version-gated. Agent Bridging is `false` in both,
so that is not a regression. **[agent]**

**Genuine losses, none flagged anywhere:**

- Context-history viewer — gone, no replacement. Looks like an oversight.
- Directory search/filter — gone. Fine for nine demo apps, not for a real directory.
- Native non-browser app bridging — the *UI* was ported, the server-side WebSocket bridge
  was not. Instructions describe something that cannot work.
- Embeddable channel-selector / resolver — code ported, then hardcoded to `() => false`.

**"Looks done but isn't", in three places** — this is the sharpest available criticism of
the PR and I would endorse it: workspace save/load runs on `MOCK_WORKSPACES` behind a TODO;
the embeddable UI is switched off; the platform advertises middleware that no-ops.

**Do not claim credit for removing Electron.** Upstream removed it itself in `6d86fd4ee`,
not an ancestor of this branch. Same for the named demo apps. Both need one explicit
sentence in the PR body so a reviewer diffing a stale base does not misread them.

**Migration is a smaller problem than the diff implies:** neither v2's nor v3's packages were
ever published, so nobody has a dependency to bump. Only contributors with a local v2
checkout are affected, and for them it is a fresh clone.

### 28. tsconfig project references — `NEEDS WORK`

Root `tsconfig.json:8` references `./packages/sail-ui`, which does not exist — the pre-rename
name of `sail-theme`. `sail-finance/tsconfig.json` carries a second dangling reference to the
same path, behind a `_comment` reading *"TODO: Fix sail-ui type checking - currently disabled
due to rootDir/declaration issues"*. **[verified]**

That second one may be masking a real typecheck gap in `sail-finance`, so it wants
understanding rather than deleting. Root references also omit `sail-conformance-harness`
despite it having its own tsconfig and being built by root scripts. **[agent]**

### 29. Commit history and metadata — `BLOCKER`

**The most visible tells in the entire review, and the first pass missed the category
completely — it audited file contents and never looked at history.** All of this renders on
GitHub's Commits tab before a reviewer reads a line of code. **[verified]**

| Finding | Extent |
| --- | --- |
| Author `Cursor Agent <cursoragent@cursor.com>` | 9 of 218 commits |
| `Claude-Session: https://claude.ai/code/session_…` trailer | 1 commit body |
| `cursor/…` tool-generated branch names in merge-commit subjects | ≥2 (`cursor/update-consume-sail-desktop-agent-skill-ade5`, `cursor/update-conformance-harness-desktop-agent-api-ade5`) |
| Author identity split, same email | `SeeWhatsOn` ×135 / `Chris Watson` ×74 |
| Commit bodies citing `.cursor/plans/…` paths | several — dangling once item 23 lands |

Separately, ~65 of 218 commit bodies follow a formulaic *"Enhanced… ensuring better
maintainability and clarity in the codebase"* pattern — "Enhanced" ×41, "ensuring" ×36,
"enhancing" ×22, "Introduced a" ×15. **[agent]** What makes this conspicuous is not the
wording alone but the contrast: the same branch contains unmistakably expert commits citing
exact figures (*"60+ to 24"*, *"38 of 458 messages… 152 passing scenarios"*). Two voices in
one history is itself the tell.

**Squashing the branch resolves nearly all of this at once**, and 218 commits is not
reviewable as a PR regardless. That is the cheap path; selectively rewriting history is the
expensive one. Either way it must happen *before* the PR opens — history cannot be cleaned
after a reviewer has seen it.

Note the sequencing trap: this interacts with item 0. Sync with upstream first, then squash,
or the merge will be redone.

### 30. `console.log` in shipped code — `NEEDS WORK`

**45 occurrences across shipped `src/`, excluding tests.** **[verified]** Worst:
`sail-finance/components/layout-grid/Layout.tsx` (9), `stores/connection-store.ts` (7),
`stores/intent-resolver-store.ts` (4), `main.tsx` (4), `sail-platform/sail-platform.ts` (3).

The tell is not the calls themselves but the inconsistency: `sail-desktop-agent` built a
proper injectable `Logger` interface (`src/interfaces/logger.ts`) for exactly this, and
`sail-finance`/`sail-platform` bypass it with raw bracket-tagged `console.log` — sibling
packages, same architecture, different discipline. **[agent]**

---

## Corrections to the first-pass review

Recorded because the point of this register is that a wrong `GOOD` is worse than an honest
`UNASSESSED`.

| Claim | Reality |
| --- | --- |
| `MAINTAINERS.md` deleted — BLOCKER | Never in this lineage. Two-dot diff artefact. |
| CLA/DCO unverified — BLOCKER | Not a defect; EasyCLA, not DCO. |
| Security tooling removed — NEEDS WORK | 3 of 5 were post-fork upstream additions. |
| Five badges pinned; one may reference `lint.yml` | Four badges; no `lint.yml` reference. |
| `sail-desktop-agent` API — GOOD | `@internal` is unenforced; several real leaks. |
| AI tells — better than assumed | 77 dividers, a dead duplicate class, false-premise guards. |
| Unconfigured host may accept any origin | It does not; directory-origin matching is unconditional. |
| `.vite-hooks/pre-commit` may silently no-op | It works for a fresh contributor — proved on a clean clone. It no-ops only against a pre-existing conflicting `core.hooksPath`. |
| 434 files fail formatting | Windows CRLF artifact, not drift. Item 31. |

The `GOOD` on item 14 and the "AI tells are fine" read share one cause: checking that a
label or a word was absent, rather than that the underlying claim was true.

**One whole category was missed rather than mis-rated: commit history (item 29).** The first
pass audited file contents and never ran `git log --format='%an'`. The single most visible
tell in the PR — a commit author literally named `Cursor Agent` — was sitting in plain sight
the entire time and took one command to find.

## Open decisions

1. Toolchain — keep or revert (item 1)
2. PR shape, and whether maintainers know (item 2)
3. Release machinery in or out (item 13)
4. Shell scope — one demo app or two (item 25)
5. What replaces the demo app directory (item 11)

## If the work does happen

Dependency order, not importance. **Updated 2026-08-07:** items 14, 16, 17, 19 are done or moot;
item 15 downgraded; item 9's and 10's tsconfig cause is fixed, `sail-one`'s html entrypoint is the
one remaining cause of both.

1. **Make it build and go green** (items 9, 10) — one located fix left: the `sail-one` html
   entrypoint (`packages/sail-one/vite.config.ts:68` globs `html/**/*.html`, which doesn't exist).
   `"node"` in sail-finance's tsconfig `types` and the test regex (item 19) are **already fixed**.
   Also add `sail-one` to CI's build step so the blind spot closes. Do this first; until it is
   done, nothing else in this register can be trusted.
2. **Sync with upstream `main`** (item 0) — everything after is cheaper
3. Decisions above
4. ~~The security fix (item 16)~~ — **done**, `hostInstanceId` is stripped at the trust boundary
5. Cheap blockers — items 3, 7, 23, 31
6. Verify what is still unknown — item 21
7. Substance — items 11, 12, 15, 18, 28 (14 and 17 done/moot; dropped from this line)
8. Presentation — items 20, 22, 24, 27, 30
8. **Squash the history last** (item 29) — after the sync, after the file-level work, so
   nothing has to be redone. This is the final act before opening the PR.

Items 3, 7, 16 and 28 are worth doing whether or not the PR ever opens.

## What this review did not cover

- **No real GitHub Actions run.** Every CI step was reproduced locally on Windows/node 24;
  the Linux runner was never exercised. The Prettier/CRLF conclusion in particular rests on
  byte inspection, not an actual green/red result.
- The security review covered the app-connection boundary only. Intent-handler registration
  abuse and heartbeat-specific DoS were explicitly not traced.
- No runtime reproduction of item 16 — static trace only.
- Large parts of `sail-desktop-agent` were never read in full for item 20 (see its
  `UNASSESSED` list).
- No full transitive licence audit — 4 top-level packages spot-checked, not the lockfile.
- No accessibility assessment of either shell.
- No hands-on comparison of the v2 vs v3 first-five-minutes experience.

## Change log

- 2026-08-03 — first pass against `457a0896c`.
- 2026-08-03 — 10 specialist agents; 7 first-pass claims corrected, 3 withdrawn; branch
  staleness and one security vulnerability added. Build/test rows still pending.
- 2026-08-03 — added items 29 (commit history/metadata) and 30 (`console.log`). Item 29 is
  a category the first pass never looked at, and contains the most visible tell in the PR.
- 2026-08-03 — build/test complete. Items 9, 10 and 19 resolved from `UNASSESSED`: the build
  fails, 3 of 8 CI steps fail, and a 4th is falsely green. Added item 31. All 31 areas now
  have a verdict; no `UNASSESSED` rows remain.
