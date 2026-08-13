# Minimal Viable Delivery Plan: TypeScript strictness rollout

Status: reviewing
Current slice: 7 — promote to root and delete the scaffolding (not started; slice 6 reviewed and closed)

> **Read this whole Context section before touching anything.** The two settings this plan
> rolls out produce ~346 findings, and **21 of them are the tools being wrong**. Obeying those
> deletes real input validation with the test suite still green. The classification below is the
> product of a completed investigation — do not redo it, and do not "fix" a finding this plan
> lists as bucket B.

---

## Context — how we got here

A separate refactor (`.cursor/plans/dacp-handler-deps-refactor.md`, slice 3) removed three
`logPayloadDetail ?? "metadata"` fallbacks from DACP handlers. `AGENTS.md` line 145 already
banned handler-level `??` fallbacks, and the code had been violating its own documented rule.
That raised the question: **should this be enforced by tooling rather than by prose in
`AGENTS.md`, so a contributor with only tests and lints gets caught?**

Two settings were enabled repo-wide to find out, then reverted. This plan re-lands them
properly, staged per package.

### The two settings, and why they ship together

```jsonc
// tsconfig.root.json
"noUncheckedIndexedAccess": true
```

```ts
// vite.config.ts — lint.rules
"typescript/no-unnecessary-condition": "error"
```

`no-unnecessary-condition` trusts the type system completely. Without
`noUncheckedIndexedAccess`, every `record[key]` types as non-undefined, so the rule calls
correct runtime guards dead. Measured on `sail-desktop-agent`:

| Configuration | Findings in `src` |
|---|---|
| lint rule alone | 130 |
| lint rule + `noUncheckedIndexedAccess` | **31** |

99 of the 130 were false positives caused by the missing flag. **Never enable the lint rule
in a package without the tsconfig flag.**

### What the classification found

Every finding was sorted into one of four buckets:

| Bucket | Meaning |
|---|---|
| **A — Ceremony** | Code is correct, the tool cannot see it. `length > 0` then `[0]`; a matched regex indexed by capture group. Fix is a `!` or a destructure. No behaviour can change. |
| **B — Tool is wrong** | The value crosses a trust boundary, so the declared type is an assumption about what *should* arrive. The guard is load-bearing. **Suppress with a comment, never delete.** |
| **C — Genuinely dead** | The condition truly cannot fire. Deleting it is correct. |
| **D — Real bug** | An actual defect. This bucket is the entire return on the exercise. |

| Package | A | B | C | **D** |
|---|---|---|---|---|
| `sail-one` | 28 | 5 | 1 | **4** |
| `sail-finance` | 12 | 10 | 3 | **5** |
| `sail-conformance-harness` | 66 | 6 | 4 | 0 |
| `sail-desktop-agent` · `state/mutators` | 29 | 0 | 0 | 0 |
| `sail-desktop-agent` · sampled remainder | 3 | 6 | 1 | 0 |
| `sail-platform` | 19 | 0 | 0 | 0 |

Raw counts are inflated by transitive type-checking — 52 of the harness's 65 `tsc` errors are
`sail-desktop-agent` source pulled in through its imports, and 8 of `sail-finance`'s are
harness source. Treat each row as per-package signal, not as a de-duplicated sum.

**All nine bugs are in the UI packages.** The desktop agent, harness and platform produced
nothing but ceremony, because that code already guards its inputs — it parses wire protocol.
The UI packages never acquired the habit.

### Coverage honesty

- Two of the nine bugs were verified by direct source reading (the `createContext` default and
  the `client-state` tab indexing). The other seven come from a classifier report and are
  **unverified** — the coder should confirm each before fixing.
- `sail-desktop-agent`'s tail is **sampled, not exhaustive**. `state/mutators` was fully
  classified at 29 findings, all ceremony. Of the remainder only the bug-shaped subset was read
  — the "always truthy", "always falsy" and "no overlap" messages, where a dead guard would
  hide. Slice 4 will surface anything missed.

---

## Intent

- **Outcome:** the nine real bugs are fixed with tests, and both strictness settings are on
  repo-wide with a clean `tsc` and `vp lint`.
- **User:** contributors, including agents, who have only tests and lints as feedback. The
  rule that a default has exactly one owner currently lives only in `AGENTS.md` prose, which
  a terminal never shows you.
- **Success:** `npx vp test run`, `npx cucumber-js`, `npx vp lint .` and `npx tsc --noEmit`
  all clean with both settings enabled at the root, and every bucket B suppression carries a
  comment naming its trust boundary.
- **Constraint:** the repo must be green after every slice. `tsconfig.root.json` is shared by
  all six packages, so enabling there first would redden everything at once — hence the
  per-package staging in slices 3–7.
- **Out of scope:** fixing the unchecked `as DirectoryApp[]` cast at
  `sail-conformance-harness/src/conformance-app-directory.ts:78` (parked — it is the root
  cause behind three bucket B findings, but it is a schema-validation task, not a strictness
  task). Also out of scope: any other lint rule, and `noUncheckedIndexedAccess` on `website/`.

---

## Verify Commands

Run **sequentially, never in parallel** — parallel Vitest runs in this repo produce a
transport-logging flake (see Parked Follow-ups).

- **Full (repo):** `npx vp test run` — baseline **76 files / 513 tests passing**
- **Focused (desktop-agent):** `cd packages/sail-desktop-agent && npx vp test run` — baseline **58 files / 385 tests**
- **BDD (desktop-agent only):** `cd packages/sail-desktop-agent && npx cucumber-js` — baseline **154 scenarios / 1460 steps**
- **Lint:** `npx vp lint .` — must be silent
- **Typecheck (per package):** `npx tsc --noEmit -p packages/<pkg>` — must be silent

`vp lint` is **oxlint + `oxlint-tsgolint`** (type-aware), not ESLint and not `tsc`. A clean
`tsc --noEmit` is **not** evidence that lint passes. Run both.

Do not run `vp fmt` — it currently fails on 177 of 190 files for pre-existing config reasons
and would rewrite the whole package.

---

## Simplicity Bias

- **Policy:** the repo-local `minimal-implementation` skill governs
  `packages/sail-desktop-agent/src`, `packages/sail-platform/src` and
  `packages/sail-finance/src`. Fewest edits, not fewest layers. No compat shims, no
  deprecation aliases.
- **Reuse:** the existing per-package `tsconfig.json` files already `extend`
  `../../tsconfig.root.json`, so a `compilerOptions` override in one package is the whole
  staging mechanism. The root `vite.config.ts` `lint.overrides` array already scopes rules by
  `files:` glob — use the same shape.
- **Avoid:** a new shared config package, a codemod, `// @ts-expect-error` as a bulk silencer,
  and any refactor that merely moves a finding rather than resolving it.
- **Architecture:** no new modules. Slices 1–2 are bug fixes in existing files; slices 3–7 are
  config edits plus mechanical follow-through.

---

## Slices

### 1. `sail-finance` — the provider guards that never fire

- **Goal:** using a context hook outside its provider throws the intended error instead of
  failing several frames later with an unrelated `TypeError`.
- **The bug:**

  ```ts
  // src/contexts/sail-desktop-agent-context-value.ts:14
  export const SailDesktopAgentContext = createContext<SailDesktopAgentContextValue>(
    {} as SailDesktopAgentContextValue,   // ← default is truthy
  )

  // src/contexts/use-sail-desktop-agent-hooks.ts — all four hooks
  const context = useContext(SailDesktopAgentContext)
  if (!context) {                          // ← can never fire
    throw new Error("useSailDesktopAgent must be used within SailDesktopAgentProvider")
  }
  ```

  `src/components/theme/theme-provider.tsx:69` has the identical shape against a default of
  `{ theme: "system", setTheme: () => null }`. There, misuse silently no-ops instead of
  throwing at all.
- **Acceptance:**
  - The context defaults become `undefined`, and the context types become
    `SailDesktopAgentContextValue | undefined` / the theme equivalent, so the existing
    `if (!context) throw` guards become reachable and TypeScript enforces them.
  - All five guards fire when the hook is called outside its provider.
  - No call site inside a provider changes behaviour.
  - **Confirm the count before fixing.** Four hooks in `use-sail-desktop-agent-hooks.ts` at
    `:13`, `:21`, `:33`, `:45`, plus `theme-provider.tsx:69`. If a fifth hook exists, include it.
- **Verify:** `npx vp test run` then `npx vp lint .` then `npx tsc --noEmit -p packages/sail-finance`
- **Likely files:** `packages/sail-finance/src/contexts/sail-desktop-agent-context-value.ts`,
  `packages/sail-finance/src/contexts/use-sail-desktop-agent-hooks.ts`,
  `packages/sail-finance/src/components/theme/theme-provider.tsx`, plus each provider component.

### 2. `sail-one` — array indexing with no floor

- **Goal:** draining tabs, or resolving an intent whose only handlers are elsewhere, no longer
  crashes or renders a dead UI.
- **The bugs:**

  ```ts
  // src/state/client-state.ts:215,219
  getActiveTab(): TabDetail {
    const out = this.tabs.find(t => t.id == this.activeTabId)
    if (!out) {
      this.activeTabId = this.tabs[0].id      // tabs can be []
      ...
      return this.tabs[0]
    }
    return out
  }

  // src/state/client-state.ts:239 — removeTab filters with no floor
  this.tabs = this.tabs.filter(t => t.id != id)
  ```

  The "you cannot close the final tab" rule lives **only** in the UI's alert dialog, so any
  programmatic path leaves `[]`. `getActiveTab()` is called throughout `grid.tsx` and
  `resolver.tsx`.

  `src/resolver/resolver.tsx:160,170` — `generateStartState()` indexes
  `uniqueNewAppIntents[0]` guarded only by `uniqueExistingAppIntents.length > 0`, a
  *different* array. When an intent's only handlers are running instances on another channel
  both lists come back empty, `chosenIntent` becomes `undefined`, and the Resolver popup
  renders an empty picker the user cannot complete.
- **Acceptance:**
  - `getActiveTab()` has a defined return for an empty `tabs`, or `removeTab()` enforces the
    last-tab floor in state rather than in the dialog. **Pick one and say which in the diff** —
    do not do both.
  - `generateStartState()` guards the array it actually indexes.
  - The Resolver cannot render a picker with no selectable option.
- **Verify:** `npx vp test run` then `npx vp lint .` then `npx tsc --noEmit -p packages/sail-one`
- **Likely files:** `packages/sail-one/src/state/client-state.ts`,
  `packages/sail-one/src/resolver/resolver.tsx`

### 3. Enable both settings on `sail-platform`

- **Goal:** prove the per-package staging mechanism on the smallest surface.
- **How:** add `"noUncheckedIndexedAccess": true` to
  `packages/sail-platform/tsconfig.json`'s `compilerOptions`, and add a
  `lint.overrides` entry in root `vite.config.ts` scoping
  `"typescript/no-unnecessary-condition": "error"` to `packages/sail-platform/**/*.{ts,tsx}`.
- **Acceptance:**
  - Both settings active for this package only; every other package unchanged and still green.
  - All 19 findings resolved. They are **all** test-fixture indexing — expect pure ceremony
    and zero behaviour change.
  - **Also add the test-file exclusion** decided during the investigation: fixtures are
    authored data, not untrusted input, so the strictness buys nothing there and the noise is
    what makes people stop reading lint output. Scope the lint override to exclude
    `**/__tests__/**` and `**/*.test.{ts,tsx}`, and record the shape used — slices 4–6 copy it.
- **Verify:** `npx tsc --noEmit -p packages/sail-platform` then `npx vp lint .` then `npx vp test run`
- **Likely files:** `packages/sail-platform/tsconfig.json`, `vite.config.ts`

### 4. Enable both settings on `sail-desktop-agent`

- **Goal:** the largest surface, ~183 raw findings, expected to be almost entirely ceremony.
- **Acceptance:**
  - All 29 `state/mutators` findings resolved as ceremony. They are uniformly a guard
    `if (!state.X[key]) return state` followed by a synchronous
    `produce(state, draft => draft.X[key]...)`. TypeScript does not carry narrowing from
    `state` to `draft` — different objects from its view — but nothing can mutate between the
    guard and the access in single-threaded JS. Both independent classifiers agreed.
  - **These four are bucket B. Suppress with a comment naming the boundary; do not delete:**

    | File:line | Boundary |
    |---|---|
    | `src/app-directory/fetch-app-directory.ts:12,21` | Validates JSON fetched from a remote app-directory URL. Obeying the linter deletes the body of `validateApplication` with tests green. |
    | `src/app-connection/browser-app-connection.ts:203` | The MessagePort trust boundary where app-authored `meta` is stripped and re-stamped — the anti-spoof path `AGENTS.md` documents. |
    | `src/handlers/intents/intent-result-handlers.ts:97,118` and `src/handlers/intents/intent-result-metadata.ts:80` | `intentResult === null`. The FDC3 schema types it non-nullable but the wire carries null — there is a **passing** Cucumber scenario at `test/features/intents/intent-result.feature:61` for `NoResultReturned`. |
    | `src/handlers/intents/intent-helpers.ts:364` and `intent-directory-helpers.ts:22` | `intentDef` comes from app-directory JSON. |

  - `src/errors/fdc3-errors.ts:72` is bucket C — genuinely dead. `ResolveError.UserCancelled`
    is an enum member, so `|| "UserCancelledResolution"` has never been reachable. Delete the
    fallback.
  - Anything not listed above that the tools flag as "always truthy" / "always falsy" /
    "no overlap" is **unclassified** — the investigation sampled this package rather than
    auditing it. Classify each into A/B/C/D before acting, and add any new bucket D to the
    plan rather than silently fixing it.
- **SPLIT INTO 4a / 4b (user decision, 2026-08-12).** Slice 4 is the only slice where an agent
  would have to *produce* a classification rather than *apply* one, and a wrong call there
  deletes a load-bearing guard with the whole suite still green. So the judgement is not
  delegated:

  | | Scope | Who decides |
  |---|---|---|
  | **4a** | Enable both settings. Apply the pre-classified work: the 29 `state/mutators` ceremony sites, the 4 bucket B suppressions, the 1 bucket C deletion. Plus any *pure indexing ceremony* in the tail — `noUncheckedIndexedAccess` TS2532/TS18048 where a length check, literal or preceding assignment proves the element exists. | coder |
  | **4b** | Every remaining `no-unnecessary-condition` finding whose message is **"always truthy" / "always falsy" / "no overlap"** — the plan's own stated hiding place for a dead guard. The coder **enumerates these and changes nothing.** Buckets are assigned by the main agent and the user. | main + user |

  The split line is the plan's own: indexing ceremony is mechanical and provably
  behaviour-neutral; a constant-condition finding is where a real guard hides.
  **The repo is not green until 4b lands** — that is expected, and slice 4 is not complete
  until both halves are done.

- **Verify:** `npx tsc --noEmit -p packages/sail-desktop-agent` then `npx vp lint .` then
  `cd packages/sail-desktop-agent && npx vp test run` then `npx cucumber-js`
- **Likely files:** `packages/sail-desktop-agent/tsconfig.json`, `vite.config.ts`, plus
  `src/state/mutators/*` (29 sites), `src/handlers/**`, `src/app-directory/**`,
  `src/app-connection/**`, `src/agent/fdc3-version.ts`

### 5. Enable both settings on `sail-conformance-harness`

- **Goal:** ~24 harness-native findings. Zero bugs expected.
- **Acceptance:**
  - **`src/harness-browsing-context-close.ts:36` is bucket B and the linter's own autofix
    breaks it.** TypeScript narrows `windowRef.closed` to `false` from an earlier guard and
    never invalidates that across the `windowRef.close()` call — which is precisely what
    mutates it. Reproduced in isolation. Applying the fix breaks same-origin close detection.
    Suppress with a comment.
  - `src/app-launcher.ts:68`, `src/harness-bootstrap.ts:36`,
    `src/__tests__/harness-open-with-context.harness.ts:54`,
    `src/harness-console-capture.ts:67,68` are bucket B — FDC3 wire payload, unvalidated
    `conformance-appd.json` fixture, and cross-runtime `console` respectively.
  - `harness-browsing-context-close.ts:53,133` and `harness-bootstrap.ts:177` are bucket C —
    `AppConnectionMetadata.source: Window` and `AgentAppConnection.sendToAppInstance` are
    required members set by our own handshake code. Delete those guards.
- **Verify:** `npx tsc --noEmit -p packages/sail-conformance-harness` then `npx vp lint .` then `npx vp test run`
- **Likely files:** `packages/sail-conformance-harness/tsconfig.json`, `vite.config.ts`,
  `src/harness-browsing-context-close.ts`, `src/harness-bootstrap.ts`, `src/app-launcher.ts`,
  `src/intent-resolution.ts`, `src/harness-console-capture.ts`

### 6. Enable both settings on `sail-one` and `sail-finance`

- **Goal:** the two UI packages, ~79 findings. Their bucket D was already cleared in slices 1–2.
- **Acceptance:**
  - The 15 bucket B findings are suppressed with a comment naming the boundary. They are FDC3
    App Directory JSON (`appd.tsx`, `default-app-state.ts`, `AppDirectory.tsx`),
    `localStorage`-persisted state (`custom-apps.tsx`, `theme-provider.tsx`,
    `workspace-store.ts`, `Layout.tsx`, `Panels.tsx`, `FDC3Tab.tsx`), and a nullable `Window`
    argument (`fdc3-store.ts` — the one case with explicit test coverage at
    `fdc3-store.test.ts:119-145`).
  - Slices 1–2 already removed the bucket D findings, so no new bug should surface here. **If
    one does, stop and report it** — it means the classification missed something and the
    remaining slices need re-reading.
- **Verify:** `npx tsc --noEmit -p packages/sail-one` then `npx tsc --noEmit -p packages/sail-finance`
  then `npx vp lint .` then `npx vp test run`
- **Likely files:** `packages/sail-one/tsconfig.json`, `packages/sail-finance/tsconfig.json`,
  `vite.config.ts`, plus the files named above

### 7. Promote to root and delete the scaffolding

- **Goal:** one owner for the setting, matching the rule this whole exercise is about.
- **Acceptance:**
  - `"noUncheckedIndexedAccess": true` moves to `tsconfig.root.json`; the six per-package
    `compilerOptions` overrides are deleted.
  - `"typescript/no-unnecessary-condition": "error"` moves to root `vite.config.ts`
    `lint.rules`; the per-package `lint.overrides` entries are deleted. The test-file
    exclusion stays.
  - **Rewrite `AGENTS.md` line 145.** It currently bans "handler-level `??` fallbacks", which
    is a *syntax* ban, not the actual rule — it over-bans (a legitimate `??` on a genuinely
    optional field) and under-catches (`const { x = "default" } = params` is the identical
    defect with no `??` in it). Replace with the real rule: **a config value is defaulted
    exactly once, at the boundary where user input enters (`default-config.ts`); every
    downstream type is required.** Note that the type system now enforces it.
  - The same rewrite must also state, per slice 5's and slice 6's reviews, that (a) **bucket B is
    not only about trust boundaries** — it equally covers "the compiler cannot model this
    mutation"; and (b) the suppression shape is a single `//` line immediately above the exact
    flagged sub-line, **except where the diagnostic's span crosses lines**, where only the
    trailing same-line `oxlint-disable-line` suppresses it (`Layout.tsx:82` is the one instance).
  - Full repo green.
- **Verify:** `npx tsc --noEmit -p packages/sail-desktop-agent` (and each other package) then
  `npx vp lint .` then `npx vp test run` then `cd packages/sail-desktop-agent && npx cucumber-js`
- **Likely files:** `tsconfig.root.json`, `vite.config.ts`, all six `packages/*/tsconfig.json`,
  `AGENTS.md`

---

## Test Plan

- **Unit:** slice 1 needs a test per guard proving the hook throws when rendered outside its
  provider — this is the reproduction, and it must **fail before the fix**. Slice 2 needs an
  empty-`tabs` test for `getActiveTab()`/`removeTab()` and an empty-both-lists test for
  `generateStartState()`. None of these paths has any test today, which is exactly why the
  bugs survived.
- **Integration:** none new. Slices 3–7 are config changes; the existing suites are the
  regression net.
- **Manual/runtime:** after slice 2, open the Resolver in `sail-one` and confirm no empty
  picker state. After slice 7, confirm a fresh `npm install` still produces a clean typecheck.
- **Not testing:** every bucket A ceremony fix. They cannot change behaviour by definition —
  a test would assert the compiler's opinion, not the program's.

---

## Agent Roles

Resolve against the agent types available in the executing session and record what was used.

- **coder:** `general-purpose`
- **tester:** `agent-skills:test-engineer`
- **reviewer:** `agent-skills:code-reviewer`
- **security reviewer:** `agent-skills:security-auditor` — **required for slices 4 and 5**,
  which touch the MessagePort trust boundary and the remote-JSON validator. Not needed for
  slices 1–3, 6–7.
- **explorer:** not needed — the investigation is complete and its findings are in Context.

**Model guidance.** Original guidance was opus for slices 1, 2 and 4 (subtle reachability
reasoning; slice 4's tail is unclassified). **Overridden by the user on 2026-08-12: sonnet 5
for every subagent, all slices.** Mitigation for slice 4 — do not classify a borderline
finding down to bucket A/C on judgement; stop and report it instead.

**Cadence.** Pause after every slice for user go-ahead. No commits — the user commits manually.

**Do not let one agent take two roles.** A prior delivery on this branch produced two
false-positive test suites — tests that passed for the wrong reason — because a reviewer
inherited the coder's context.

---

## Risks

- **The tools are wrong 21 times, and their autofixes are confidently wrong.** This is the
  headline risk. `fetch-app-directory.ts:21` and `harness-browsing-context-close.ts:36` both
  break real behaviour if the suggestion is applied, and the test suite stays green either
  way. Every bucket B site must end up with a comment, not a deletion.
- **`tsconfig.root.json` is shared across all six packages.** Adding the flag there before
  slice 7 reddens everything at once and destroys the per-slice gate. Stage per package.
- **The `sail-desktop-agent` tail is sampled, not audited.** Slice 4 may surface a bucket D
  that this plan does not list. That is expected; add it to the plan rather than fixing it
  silently.
- **Seven of the nine bugs are unverified by direct reading.** The coder confirms each before
  fixing. If one turns out not to be real, say so and drop it — do not manufacture a fix.
- **A flaky test exists.** `wcp-host-logger-threading.test.ts` fails intermittently under
  parallel load and passes in isolation. It is a pre-existing transport-logging flake, not a
  regression. Re-run before investigating.

---

## Slice Checkpoints

- [x] 1. `sail-finance` provider guards: **reviewed** (failures: 1) — coded, tested and
      reviewed by three separate contexts. All five guards confirmed dead before the fix and
      live after it.
- [x] 2. `sail-one` array indexing: **reviewed** (failures: 1) — coded, tested and reviewed by
      three separate contexts. All three bugs confirmed real by direct reading first.
- [x] 3. Enable on `sail-platform`: **reviewed** (failures: 0) — coded and reviewed by two
      separate contexts; no tester, since the plan's Test Plan specifies no new tests for
      slices 3–7. Override proved live by probe, not assumed.
- [x] 4. Enable on `sail-desktop-agent`: **reviewed** (failures: 1) — 4a coded + security-audited
      + main-agent verified; 4b coded (enumerate-only), classified by main + user against the
      FDC3 spec, then reviewed by `agent-skills:code-reviewer`. The one failure is 4b's upheld
      Important finding (the `intent-launch-helpers.ts:91` log/logic divergence), fixed by
      suppressing site #2 instead of deleting it. State re-confirmed on resume (2026-08-12):
      `npx tsc --noEmit -p packages/sail-desktop-agent` -> exit **0**; `npx vp lint .` -> exit 1
      with **zero** `no-unnecessary-condition` findings, output identical to the recorded
      pre-existing set.
- [x] 5. Enable on `sail-conformance-harness`: **reviewed** (failures: 0) — coded, security-
      audited and reviewed by three separate contexts. Clean verify on the first attempt and no
      Required finding from either reviewer. Zero escalations: the plan's classification of this
      package was complete. Both reviewers independently re-derived the three bucket C deletions
      from the type declarations rather than trusting the plan's table — which is how two wrong
      boundary citations in that table were found.
- [x] 6. Enable on `sail-one` + `sail-finance`: **reviewed** (failures: 1) — config + indexing
      ceremony landed by an earlier session that stopped before recording anything; the
      11-finding constant-condition tail was classified by main + user and coded on resume
      (2026-08-13). `agent-skills:code-reviewer` returned two Required findings, both upheld
      after the main agent re-read the source: a **second** `concat`-discards-result bucket D bug
      in `getAllContextTypes` (six sites, same file as the first), and an undocumented
      `Layout.tsx:82` suppression. The one failure is the second bucket D bug. Both fixed/recorded,
      then re-verified end to end. Two reproduction tests exist and were each proved to fail with
      their bug reverted.
- [ ] 7. Promote to root, rewrite AGENTS.md line 145: not started (failures: 0)

---

## Verification Notes

Baseline captured before any slice, on branch `refactor/dacp-handler-deps` with both settings
**off**:

- `npx vp test run` (repo root) -> exit 0, **76 files / 513 tests passing**
- `cd packages/sail-desktop-agent && npx vp test run` -> exit 0, **58 files / 385 tests passing**
- `cd packages/sail-desktop-agent && npx cucumber-js` -> exit 0, **154 scenarios / 1460 steps passing**
- `npx vp lint .` -> exit 0, silent
- `npx tsc --noEmit -p packages/sail-desktop-agent` -> exit 0, silent

### Correction — the `vp lint` baseline above is WRONG (found during slice 1, 2026-08-12)

`npx vp lint .` actually exits **1**, not 0, on an untouched tree. Two pre-existing **errors**:

| Finding | Cause |
|---|---|
| `packages/sail-finance/vite.config.ts:3:25` TS2307 `Cannot find module '@tailwindcss/vite'` | `@tailwindcss/vite` is declared in `packages/sail-finance/package.json` dependencies but **is not installed** — verified absent from the worktree's `node_modules` *and* the main checkout's. Not a worktree artifact. |
| `packages/sail-finance/vite.config.ts:8:3` TS2578 unused `@ts-expect-error` | Downstream of the same missing module. |

Plus ~25 pre-existing **warnings** across `sail-one`, `website/scripts`,
`sail-finance/src/utils/dockview-popout.ts`, `sail-conformance-harness` tests and
`sail-one/src/appd/appd.tsx`.

**Consequence for slices 3–7:** the "`npx vp lint .` must be silent" acceptance gate is
**not achievable as written**. Substitute gate: *no new findings attributable to the slice*,
compared against this recorded pre-existing set. Do not let an agent "fix" the missing
dependency as part of a strictness slice — see Parked Follow-ups.

### Slice 1

- `cd packages/sail-finance && npx vp test run` -> exit 0, **4 files / 27 tests passing**
  (22 pre-existing + 5 new reproductions). Before the fix: 22 passed / 5 failed, the 5
  failures being exactly the outside-provider reproductions.
- `npx tsc --noEmit -p packages/sail-finance` -> attempt 1 exit **2** (TS2769 in the new
  test file); sent back to the tester. Attempt 2 -> exit **0**, silent.
- `npx vp lint .` -> attempt 1 exit **1**; the only slice-attributable finding was the same
  TS2769. Attempt 2 -> exit 1 with **zero** findings in any slice file; the remaining output
  matches the pre-existing set above.
- `npx vp test run` (repo root) -> exit 0, **78 files / 523 tests passing**
  (baseline 76 / 513; +2 files and +10 tests are this slice's reproductions).

Slice 1 failure count: **1** (the TS2769, fixed by the tester on attempt 2).

### Slice 2

All three suspected bugs **verified real by direct reading** before any fix — none was a
classifier false positive. The empty-`tabs` crash is reachable through the public `removeTab()`
API by draining the three default tabs, not only via a contrived fixture.

Decision on the plan's open choice: **the floor went into `removeTab()`, not `getActiveTab()`.**
The tester's two assertions — `getActiveTab()` must not throw, and `getTabs().length > 0` after
removing the last tab — can only both hold that way. It is also the root-cause fix, since the
"cannot close the final tab" rule otherwise lives only in the UI alert dialog.

`generateStartState` needed `export` added to be testable at all. Extracting it to its own
module would have avoided the resulting lint warning, but the plan's Architecture line forbids
new modules, so the warning is accepted instead — see Known Limitations.

- `npx tsc --noEmit -p packages/sail-one` -> exit **0**, silent.
- `cd packages/sail-one && npx vp test run` -> **13/13 passing** (10 pre-existing + 3 new).
- `npx vp lint .` -> attempt 1 exit 1 with **two** slice-attributable findings: a
  `no-unnecessary-type-assertion` **error** in the tester's new `resolver.test.ts:19`
  (sent back to the tester), and the accepted `only-export-components` warning at
  `resolver.tsx:153`.

Attempt 2, after the tester cleared its lint error:

- `cd packages/sail-one && npx vp test run` -> exit **0**, **3 files / 13 tests passing**.
- `npx tsc --noEmit -p packages/sail-one` -> exit **0**, silent.
- `npx vp lint .` -> the `resolver.test.ts` error is gone. The only `resolver` finding left is
  the accepted `only-export-components` warning.
- `npx vp test run` (repo root) -> exit 1, **1 failed / 522 passed**. The failure is
  `sail-desktop-agent/src/app-connection/__tests__/wcp-host-logger-threading.test.ts` —
  the **known pre-existing flake** this plan documents under Risks. Re-run in isolation:
  **passes, 2/2**. Not a regression, and unrelated to `sail-one`.

The tester re-proved its `generateStartState` reproduction against real behaviour: with the
guard reverted but `export` kept, the test fails
`AssertionError: expected undefined not to be undefined` at `resolver.test.ts:32`. So the test
catches the bug, not merely the missing export.

Slice 2 failure count: **1**.

### Slice 3

Prediction was exact: **19 findings predicted, 19 hit**, all bucket A ceremony, all in one
file — `packages/sail-platform/src/workspace/__tests__/workspace-store.test.ts`
(17 × TS2532, 2 × TS18048), all fixture indexing such as `tabs[0]`, `panels[0]`, `saved[0]`
where a preceding `store.create(...)` / `store.addPanel(...)` provably populates the array but
the compiler cannot carry that across the call boundary. Resolved uniformly with non-null
assertions. **No production file needed any change**, and nothing was refused.

- `npx tsc --noEmit -p packages/sail-platform` -> exit **0**, silent.
- `npx tsc --noEmit -p packages/sail-desktop-agent` -> exit **0**, silent (confirms the
  tsconfig flag did not leak to other packages).
- `npx vp lint .` -> exit 1, **zero** `sail-platform` findings and no new findings anywhere;
  output matches the pre-existing set. The absence of ~100+ findings elsewhere is itself
  evidence the lint override did not leak repo-wide.
- `npx vp test run` -> exit **0**, **78 files / 523 tests passing**.

Slice 3 failure count: **0**.

### Slice 4a

144 findings on enable (113 `tsc` + 31 lint). Disposition: 29 `state/mutators` ceremony,
84 indexing ceremony, 4 bucket B site-groups suppressed with boundary comments (9 lint
findings), 1 bucket C deleted, **21 lint findings escalated to 4b**. All 113 `tsc` errors
resolved.

- `npx tsc --noEmit -p packages/sail-desktop-agent` -> exit **0**, silent.
- `npx vp lint .` -> exit 1; the 21 escalated findings are the only `sail-desktop-agent` output.
- `cd packages/sail-desktop-agent && npx vp test run` -> exit **0**, 58 files / 385 tests.
- `cd packages/sail-desktop-agent && npx cucumber-js` -> exit **0**, 154 scenarios / 1460 steps.
- `npx tsc --noEmit` on `sail-conformance-harness`, `sail-finance`, `sail-one` -> exit **0**
  on all three. **The flag did not leak**, despite the harness importing desktop-agent source.
- Probe confirmed the override live in `src` and suppressed in both `__tests__` and `test/`.

`test/` was added to the exclusion list alongside `__tests__/**` and `*.test.{ts,tsx}`, since it
holds Cucumber step-definitions and support fixtures — matching the existing `max-lines`
precedent at `vite.config.ts:364`.

**The escalation criterion in the plan was too narrow.** It named only "always truthy" /
"always falsy" / "no overlap". Every finding matching those strings was already covered by the
pre-named bucket B and C sites — **zero unnamed ones existed**. The real tail carries two
different oxlint messages: *"Unnecessary optional chain on a non-nullish value"* and
*"Unnecessary comparison between literal values"*. The coder escalated them anyway under the
"when in doubt, escalate" rule rather than the literal message filter. That was the right call
and the criterion is hereby widened: **escalate on any `no-unnecessary-condition` message,
not on the three strings.**

**The coder's escalation report covered only 20 of the 21 findings.** It omitted
`src/handlers/events/handlers.ts:43` — caught by cross-checking its report against the raw lint
output. That site is textbook bucket B (see 4b table). A report that enumerates is not
self-verifying; count it against the tool output.

### Slice 4b — the five `AppInstanceState` tautologies, and what the FDC3 spec says

`AppInstanceState` (`src/state/types.ts:28-31`) has exactly two members, `PENDING` and
`CONNECTED`. Five sites test "is this instance usable?" by enumerating both, so the linter is
correct that each is a tautology **today**:

| # | Site | Condition | If deleted |
|---|---|---|---|
| 1 | `intent-delivery-helpers.ts:77` | `!target \|\| (state !== PENDING && state !== CONNECTED)` | collapses to `if (!targetInstance)` |
| 2 | `intent-launch-helpers.ts:91` | `isReady` inside a `logger.debug` payload | **log only, no behaviour** |
| 3 | `intent-launch-helpers.ts:106` | same expression, feeds `allInstances.find(...)` | not-ready instance selected as launch target |
| 4 | `intent-launch-helpers.ts:134` | `launcher && (=== CONNECTED \|\| === PENDING)` | collapses to `if (launcherInstance)` |
| 5 | `intent-raise-shared.ts:104` | `.filter(=== CONNECTED \|\| === PENDING)` | filter disappears entirely |

**Decision: suppress all five.** The initial call was "delete #2, suppress the rest" — one line
of dead log formatting is not worth a suppression, four silent-acceptance paths are. **That was
revised during review.** Deleting #2 left the log payload at
`intent-launch-helpers.ts:91` spelled differently from the selection predicate 15 lines below at
`:106`:

```ts
isReady: state === CONNECTED || instanceId === launcherInstanceId          // the log
const isReady = state === CONNECTED || (state === PENDING && instanceId === launcherInstanceId)  // the logic
```

Equivalent today; **not equivalent once `CLOSED` ships** — the log would report a closed,
launcher-matched instance as `isReady: true` while the `find` correctly rejects it. A misleading
log at exactly the moment someone is debugging instance readiness. Two independent reads (main
agent and `agent-skills:code-reviewer`) reached this separately. #2 is therefore suppressed too,
with a comment stating that its job is to stay identical to the predicate below it. All five
sites now move together when `CLOSED` lands.

**The security auditor approved deleting all five, on reasoning that is wrong.** It argued "a
new enum member falls through to the not-ready branch — the code fails closed." That describes
the code *with* the check intact. After deletion there is no branch left to fall to, and sites
1, 3, 4 and 5 fail **open**. Its conclusion on #2 happens to be right; its stated reason is not
load-bearing anywhere. Recorded because the same argument will be offered again.

**The spec check (2026-08-12) — the third enum member is not hypothetical.** Neither FDC3 2.2
(`v2.2`) nor the 3.0 draft (`main`) defines an instance-state enum; `AppIdentifier { appId,
instanceId }` is the whole public surface, so `AppInstanceState` carries no direct conformance
obligation. But `api/specs/browserResidentDesktopAgents.md` (`v2.2`), under **"Disconnects"**,
does:

> "DAs are responsible for tracking when app windows close or navigate, which is necessary to
> provide accurate responses to the `findIntent`, `findIntentsByContext` & `findInstances` API
> calls."
>
> "Desktop Agents SHOULD retain instance details for applications that have closed as they may
> appear to close during navigation events."

`removeInstance` (`src/state/mutators/instance.ts:62-68`) does `delete draft.instances[id]`.
Sail **cannot** retain a closed instance, because no state means "closed". Liveness is
therefore modelled twice — by presence in the map (real) and by the enum (unable to express
absence) — and the five checks are guarding the half that cannot currently fire. A retained
`CLOSED` state is what the spec asks for, and the moment it exists these four checks become
load-bearing. That is the reason the suppression comments must cite, **not** "a future enum
member".

Two spec points that constrain the follow-ups below:

- `ResolveError.TargetInstanceUnavailable` is defined as "not available, for example because it
  has been closed". Sail throws it from `validateRequestedTargetAvailability`
  (`intent-raise-shared.ts:74-79`) when `getInstance` returns `undefined` — correct, and correct
  *because* of deletion. So the fix is not "stop deleting"; it is "add a retained `CLOSED` state
  and filter on it in the selectors".
- The spec never gates intent delivery on connection state. It gates on listener registration:
  `ResolveError.IntentDeliveryFailed` is "…because it has not added an intent handler within a
  timeout", and `api/spec.md` requires that "calls to `fdc3.raiseIntent` should not return an
  `IntentResolution` until the intent handler has been added and the intent delivered to the
  target app". Sail already has that gate — `isIntentListenerReady`
  (`intent-delivery-helpers.ts:34`). The `PENDING || CONNECTED` test beside it at `:77` is a
  second, weaker test of the same question on an axis the spec does not use.

**Slice 4b verification** (all four run by the main agent directly, not taken on the coder's word):

- `npx tsc --noEmit -p packages/sail-desktop-agent` -> exit **0**, silent.
- `npx vp lint .` -> **zero** `no-unnecessary-condition` findings in `sail-desktop-agent`. The
  only remaining output is the known pre-existing `packages/sail-finance/vite.config.ts` pair
  (TS2307, TS2578) plus one `no-unsafe-call` warning cascading from the same missing module.
- `cd packages/sail-desktop-agent && npx vp test run` -> exit **0**, 58 files / 385 tests.
- `cd packages/sail-desktop-agent && npx cucumber-js` -> exit **0**, 154 scenarios / 1460 steps.

**Suppression count, attributed** — the diff carries 24 `oxlint-disable-next-line
typescript/no-unnecessary-condition` comments in total: **16 from slice 4b** (12 bucket B + 4
enum; #2 made it 17 after the revision above) and **8 from slice 4a**, plus 4a's one bucket C
deletion at `errors/fdc3-errors.ts:72`. Counted per-file off `git diff`, not off any agent's
report.

**`oxlint-disable-next-line` suppresses the literal next line only.** The coder's first pass
wrote multi-line `//` rationale blocks above each site, which left the flagged line unsuppressed
whenever the rationale ran past one line, and missed entirely where an expression spans several
lines and the flagged sub-line is not the statement's first. Every suppression is therefore a
**single** `//` line placed immediately above the exact flagged sub-line. Slices 5 and 6 must
follow the same shape.

### Slice 5

22 findings on enable (13 `tsc` + 9 lint) against a predicted ~24 — close, and **zero
escalations**: every lint finding matched a pre-named bucket B or C site, so the plan's
classification of this package was complete. Disposition: 13 indexing ceremony (4 × TS2532 in
`conformance-app-directory.test.ts`, 8 × TS18048 in `intent-resolution.ts`, 1 × TS2345 in
`harness-finos-teardown.test.ts`), 5 bucket B suppressed, 4 bucket C deleted.

No `test/` entry was added to the lint exclusion — unlike `sail-desktop-agent`, the harness has
no top-level `test/` directory. Its tests live in `src/**/__tests__/` and `src/*.test.ts`, both
already covered.

**The plan's bucket C table paired the wrong boundaries with two sites.** It listed
`harness-browsing-context-close.ts:53,133` together under `AppConnectionMetadata.source: Window`.
Direct reading found `:53` and `harness-bootstrap.ts:177` are the `source` checks, while `:133`
is the `sendToAppInstance` check. All three still verified as required, non-optional members
before deletion. Corrected here so slice 7 does not inherit the mis-pairing.

**`src/__tests__/harness-open-with-context.harness.ts:54` never surfaced.** The guard
(`mockApp.details &&`) is still in the code, but the file sits under `__tests__/` and the test
exclusion catches it. Expected, and the right outcome — fixtures are authored data, not
untrusted input.

Probe (mandatory on every config slice, per slice 3's finding that a silent override is
indistinguishable from a working one):

| Probe | Expected | Observed |
|---|---|---|
| `if (instanceId !== undefined)` on a non-nullable `string` in `src/app-launcher.ts` | rule fires | `error typescript(no-unnecessary-condition)` |
| the same code in `src/app-launcher.test.ts` | rule suppressed | no finding |

Both reverted; `grep -rn "__probe" packages/sail-conformance-harness/` is empty.

**All four verify commands run by the main agent directly, not taken on the coder's word:**

- `npx tsc --noEmit -p packages/sail-conformance-harness` -> exit **0**, silent.
- `npx tsc --noEmit -p packages/sail-desktop-agent` -> exit **0**, silent (**the flag did not
  leak**, despite the harness importing desktop-agent source — this is the check that matters
  most here, since 52 of the harness's original 65 `tsc` errors were desktop-agent source pulled
  in through its imports).
- `npx vp lint .` -> exit 1, output **byte-identical** to the recorded pre-existing set; zero
  `no-unnecessary-condition` findings anywhere in the repo.
- `npx vp test run` -> exit **0**, 78 files / 523 tests.

### Slice 6

**Resumed onto a half-finished slice, and the plan file did not say so (2026-08-13).** An
earlier session had already landed both tsconfig flags, both `vite.config.ts` override pairs,
and all the indexing ceremony in `sail-one` and `sail-finance` — `tsc` was clean on all five
packages — then stopped without writing a single line into this plan, which still read "not
started". **The tree, not the plan, was the true state.** Check `git status` against the plan's
`Current slice` on every resume; a clean `tsc` on a package the plan calls untouched is the tell.

What remained was an 11-finding constant-condition tail, none of it recorded. Classified by main
+ user against the source (slice 4b's rule: this class is not delegated):

| Site | Finding | Bucket | Action |
|---|---|---|---|
| `sail-one/appd.tsx:173,184` | `if (chosen)` always truthy | **C** | Deleted. `const app = chosen` (`:111`) + the `{app ? (` JSX guard (`:160`) — TS aliased-**const** narrowing carries to `chosen`, and both are captured per-render, so the closure cannot see a stale value. |
| `sail-one/custom-apps.tsx:98` | `?? []` after `Object.keys()` | **C** | Deleted. |
| `sail-one/custom-apps.tsx:101` ×2 | `a.interop?.intents?.raises` inside its own guard | **A** | `?.` dropped. |
| `sail-one/resolver.tsx:118,313` | `a?.apps` after `.filter(a => a != null)` | **A** | `?.` dropped — TS 5.5 inferred type predicates narrow the array. |
| `sail-finance/Layout.tsx:138` | `state &&` on `api.current.toJSON()` | **B** | Suppressed — dockview third-party return type. |
| `sail-finance/Layout.tsx:225` | `!panels` always falsy | **B** | Suppressed. See the note below. |
| `sail-finance/RightControls.tsx:104` | `props.group?.activePanel` | **B** | Suppressed — dockview declares `group` required on `IDockviewHeaderActionsProps`. |
| `sail-finance/main.tsx:149` | `record?.type` | **B** | Suppressed — `record` is `message as {…}`, an unvalidated DACP wire cast. |

**`Layout.tsx:225` was the plan's own rule beating the main agent's derivation.** Direct reading
said bucket C: `panels` comes from `getPanelsForTab` (`workspace-store.ts:367`), whose every
return is `Array.from(...)` or `[]`, and the persisted-Map hazard is already suppressed upstream
at `workspace-store.ts:144`. But this plan pre-classifies `Layout.tsx` as bucket B for
localStorage-persisted state, and its standing rule is *do not classify a borderline finding down
to A/C on judgement*. **User decision: suppress.** A comment line costs nothing; a wrongly
deleted guard on persisted data costs a support ticket.

**A real bug surfaced that the linter did not flag, and the user chose to fix it here.**
`custom-apps.tsx:98,101` called `allIntents.concat(Object.keys(...))` and **discarded the return
value** — `concat` does not mutate. So `getAllIntentNames()` had never returned a single
app-declared intent, only the static `intentTypes`; the custom-app intent dropdown has always
been missing every intent the app directory actually declares. Fixed to `allIntents.push(...)`,
which also dissolved findings 3–5 above. `getAllIntentNames` gained an `export` to be testable —
same `only-export-components` trade the plan already accepted at `resolver.tsx:153`.

This is the **first bucket D outside slices 1–2**, and it was found by reading around a
bucket A/C site rather than by either tool. The plan predicted "no new bug should surface here";
that prediction was wrong, though not in a way that invalidates the classification — the linter
was right about the `?.` and `??`, and the discarded return value was simply a different defect
sitting on the same two lines.

Probe (mandatory per slice 3; the earlier session ran none). Both packages, both directions:

| Package | Probe | Expected | Observed |
|---|---|---|---|
| `sail-finance` | `s !== undefined` on a `string` in `src/main.tsx` | fires | `error typescript(no-unnecessary-condition)` |
| `sail-finance` | same code in `src/__tests__/contexts/theme-provider.test.tsx` | suppressed | no finding |
| `sail-one` | same code in `src/icon/app-icon.ts` | fires | `app-icon.ts:18 error typescript(no-unnecessary-condition)` |
| `sail-one` | same code in `src/config/__tests__/custom-apps.test.ts` | suppressed | no finding |

All four reverted; `grep -rn "__probe" packages/` is empty and no `.bak` file remains.

**All verification run by the main agent directly, not taken on any subagent's word:**

- `npx tsc --noEmit -p packages/{sail-one,sail-finance,sail-platform,sail-desktop-agent,sail-conformance-harness}`
  -> exit **0** on all five. The flag did not leak.
- `npx vp lint .` -> exit 1, with **zero** `no-unnecessary-condition` findings repo-wide
  (`grep -c` = 0). The only remaining *errors* are the two documented pre-existing
  `packages/sail-finance/vite.config.ts` ones (TS2307, TS2578).
- `npx vp test run` -> exit **0**, 78 files / 523 tests.
- `cd packages/sail-one && npx vp test run` -> exit **0**, **4 files / 14 tests** (was 3 / 13;
  +1 file and +1 test is the `getAllIntentNames` reproduction). Run separately because
  `sail-one` is absent from the root `projects` array — see below.

Tester re-proved the reproduction against real behaviour: with `push` reverted to `concat`,
`custom-apps.test.ts:78` fails with
`AssertionError: expected [ 'CreateInteraction', …(17) ] to include 'CustomListenIntent'`.
So the test catches the bug, not merely the new `export`.

**Post-review re-verification (2026-08-13, after the two Required findings were resolved).** Same
commands, all run by the main agent:

- `npx tsc --noEmit -p packages/{sail-one,sail-finance,sail-platform,sail-desktop-agent,sail-conformance-harness}`
  -> exit **0** on all five.
- `npx vp lint .` -> exit 1, `grep -c "no-unnecessary-condition"` = **0**. Only the two parked
  `packages/sail-finance/vite.config.ts` errors (TS2307, TS2578) remain.
- `npx vp test run` -> exit **0**, 78 files / 523 tests.
- `cd packages/sail-one && npx vp test run` -> exit **0**, **4 files / 16 tests** (was 4 / 14;
  +2 are the `getAllContextTypes` reproduction cases).

Tester proved the second reproduction the same way: with `push` reverted to `concat` at
`custom-apps.tsx:71`, `custom-apps.test.ts:159` fails with
`AssertionError: expected [ 'custom.appListen', …(27) ] to include 'custom.appBroadcast'`.

Slice 6 failure count: **1** — the second bucket D bug (`getAllContextTypes`), found by the
reviewer, not by either tool and not by the session that fixed its twin.

**Re-verified on the committed tree (`98716f08c`, 2026-08-13 16:46).** Necessary because that
commit swept in an unrelated hand refactor of
`packages/sail-desktop-agent/src/handlers/index.ts` — hoisting the `getHandlerForMessageType`
closure out of `routeDACPMessage` to a module-level `getHandlerFor`, renaming the `K` generic to
`MessageType`, swapping `Object.prototype.hasOwnProperty.call` for `Object.hasOwn`, and returning
`undefined` instead of `null`. That belongs to the DACP handler-deps work, not to this slice, and
it landed *after* the verification above. It is behaviour-preserving (the caller tests `if
(!handler)`), but it means the committed tree was not the tree that had been verified. Re-run
results: `tsc` exit **0** on all five packages; `vp lint .` exit 1 with `no-unnecessary-condition`
count **0** and only the two parked `sail-finance/vite.config.ts` errors; `sail-one` suite exit
**0**, 4 files / 16 tests. The root suite **flaked on the first attempt** — exit 1, 72 files / 498
tests with 6 setup-time errors and zero assertion failures, the same load-related flake this plan
documents — and passed clean on an immediate re-run: exit **0**, 78 files / 523 tests.

**Lesson: a commit is not a checkpoint unless the tree it contains is the tree that was verified.**
Two commits in this delivery (`c0ea8a542` via a `vp check --fix` pre-commit hook, `98716f08c` via
an unrelated refactor) differed from what had been checked. Diff the commit against the verified
state, or re-verify, before marking anything done.

### `sail-one` IS NOT IN THE ROOT TEST RUN — found during slice 2

Root `vitest.config.ts` lists four projects: `sail-desktop-agent`, `sail-platform`,
`sail-finance`, `sail-conformance-harness`. **`packages/sail-one/vitest.config.ts` is absent.**

So `npx vp test run` at the repo root has never executed a single `sail-one` test — not
this plan's new ones, and not the pre-existing `client-state.test.ts` / `sail-host.test.ts`.
That is why the repo-level count stayed at 78 files / 523 tests across slice 2 while the
focused run went from 10 tests to 13.

**Consequences:**

- Slice 2's stated verify command (`npx vp test run`) does **not** exercise slice 2's tests.
  The real gate is `cd packages/sail-one && npx vp test run`. Same for slice 6.
- The repo-wide baseline of "76 files / 513 tests" in this plan excludes `sail-one` entirely.
- Whether this is deliberate or an oversight is unresolved — see Parked Follow-ups. Do not
  "fix" it inside a strictness slice; adding a project to the root run could surface unrelated
  failures and would contaminate the slice's diff.

---

## Review Notes

### Slice 1 — `agent-skills:code-reviewer`, verdict APPROVE

- **Required:** none.
- **Follow-up:** `use-sail-desktop-agent-hooks.test.tsx:19-32` casts its `fakeAgent` fixture
  through `as unknown as SailDesktopAgent`. Fine for a reproduction test; worth a shared
  fixture helper only if it gets reused.
- **Ignore for MVP:** none.

Reviewer independently confirmed: the four `if (!context)` guards and `useTheme`'s
`context === undefined` guard are all reachable from the type-value change alone with the hook
file untouched; no direct reader of either context exists outside the guarded hooks, so no
consumer silently receives `undefined`; the deleted `initialState` const had no other
references; and each test asserts the literal thrown message rather than "throws something" —
which was the plan's stated false-positive risk.

### Slice 2 — `agent-skills:code-reviewer`, no Required findings

- **Required:** none.
- **Follow-up:**
  - `resolver.test.ts:32` asserts `.not.toBeUndefined()`. The correct value here is
    specifically `null`; any string would also pass. Tighten to `.toBeNull()` and also assert
    `chosenApp` is `null`, since the acceptance calls out the two staying consistent.
  - `client-state.test.ts:102` is named "getActiveTab does not throw once every tab has been
    removed", which is now inaccurate — the `removeTab()` floor means one tab always survives,
    so `getActiveTab()`'s `if (!out)` branch is never reached by that test.
- **Ignore for MVP:** `client-state.ts:152` aliases the module-level `DEFAULT_TABS` rather than
  cloning it, so `addTab`'s `push` would mutate the shared default. Pre-existing, untouched by
  this diff, no test exercises `addTab`. Noted only because it sits beside changed code.

Reviewer independently confirmed: dropping the `tabs.length > 0` clause is correct because the
new guard already establishes it; the only `removeTab` caller (`config/tabs.tsx:78-96`) already
checks `getTabs().length == 1` and alerts first, and the `Promise<void>` signature never gave
callers a success signal, so the silent no-op regresses nothing; `chosenIntent` cannot be
`undefined` on any path and `chosenApp` is forced to `null` alongside it; and `ResolverPanel`
genuinely leaves the user a way out (`resolver.tsx:333` disables Go, `:342-347` always renders
Cancel).

### THE STAGING SHAPE — slices 4–6 copy this verbatim

Two entries in root `vite.config.ts`'s `lint.overrides` array: turn the rule on for the
package, then off again for its tests. Later entries win for the same rule, which is the same
mechanism the existing `max-lines` pair at `vite.config.ts:347` / `:360` already relies on.

```ts
{
  files: ["packages/sail-platform/**/*.{ts,tsx}"],
  rules: {
    "typescript/no-unnecessary-condition": "error",
  },
},
{
  files: [
    "packages/sail-platform/**/__tests__/**/*.{ts,tsx}",
    "packages/sail-platform/**/*.test.{ts,tsx}",
  ],
  rules: {
    "typescript/no-unnecessary-condition": "off",
  },
},
```

Plus `"noUncheckedIndexedAccess": true` in that package's `tsconfig.json` `compilerOptions`.

**On the extension set:** these entries use `*.{ts,tsx}` while the neighbouring `max-lines`
precedent at `vite.config.ts:347` uses bare `*.ts`. That difference is deliberate, not a typo.
`sail-platform/src` contains no `.tsx` at all, so it makes no difference there — but slices 4–6
copy this shape into `sail-one` and `sail-finance`, which are full of `.tsx`. Keep `{ts,tsx}`.

**This shape was proved live, not assumed.** All 19 of `sail-platform`'s findings landed in a
test file, so the lint override caught nothing on its own — a typo'd glob would have looked
identical to a working one. Verified by probe instead:

| Probe | Expected | Observed |
|---|---|---|
| `if (s !== undefined)` on a `string` param, in `src/workspace/store.ts` | rule fires | `store.ts:311 error typescript(no-unnecessary-condition)` |
| the same code in `src/workspace/__tests__/workspace-store.test.ts` | rule suppressed | no finding |

Both probes were reverted; `grep -rn "__probe" packages/sail-platform/` is empty.

**Do the same probe on every remaining config slice.** A silent lint override is
indistinguishable from a working one when the package has no production-code findings.

Note also: a `typeof s === "string"` probe did **not** trip the rule. It only flags conditions
whose *types* have no overlap or are constant — use a nullish/`undefined` comparison to test it.

### Prediction for slice 6, from slice 2's review

`removeTab()`'s floor now makes `tabs` provably non-empty at runtime — constructor default,
`load()`, `addTab` only appends, `removeTab` floors. **TypeScript cannot see that invariant.**
So when `noUncheckedIndexedAccess` lands on `sail-one` in slice 6,
`client-state.ts:215,219` (`this.tabs[0].id`, `return this.tabs[0]`) will still error, and
`getActiveTab()`'s `if (!out)` fallback may be flagged. That is **bucket A ceremony** — the
guard is upheld by an invariant the compiler cannot prove. Resolve it with a non-null assertion
or a destructure, and do not "fix" it by changing `removeTab`.

### Slice 3 — `agent-skills:code-reviewer`, verdict APPROVE, no Required findings

- **Required:** none.
- **Follow-up:** the new override uses `*.{ts,tsx}` where the neighbouring `max-lines`
  precedent uses bare `*.ts` — recorded above under "On the extension set" so slices 4–6 do not
  read it as a typo.
- **Ignore for MVP:** `workspace-store.test.ts` repeats `active(store).layout.tabs[0]!` at 8+
  sites; a destructure would drop some `!`s but each access is a single flat property read, so
  it does not materially improve clarity. The plan allows either form.

Reviewer traced all 19 assertions against `store.ts` mutation semantics rather than sampling:
`create()` always seeds `tabs[0]`; `addTab()` and `addPanel()` append rather than prepend or
reorder; `renameTab`/`removePanel`/`movePanel` use `.map()` and never `.filter()` on the tabs
array, so indices stay stable. Two sites (`workspace-store.test.ts:52`, `:222`) are additionally
preceded by a runtime `toHaveLength(1)` on the same array. **No assertion masks a path where the
array could legitimately be empty.** Confirmed no production file was touched, and no other
`lint.rules`/`overrides` entry references `no-unnecessary-condition`, so there is no conflicting
default.

### Slice 4a — no dedicated reviewer pass was ever run

Slice 4a went coder -> security-auditor -> main-agent verification, skipping
`agent-skills:code-reviewer`. The gap was closed incidentally: the slice 4b reviewer scoped
itself to the whole cumulative diff, read all 8 of 4a's suppressions plus the
`errors/fdc3-errors.ts:72` deletion, and reported each "follows the same sound reasoning pattern
as its classified siblings, and none look wrong". Recorded so nobody re-opens it — but the
process lapse is real, and slices 5–7 must not repeat it.

### Slice 4b — `agent-skills:code-reviewer`, verdict REQUEST CHANGES (one finding upheld)

- **Required — NOT UPHELD.** It counted 24 suppressions against the 20-site brief it was given
  and flagged 9 as unattested. Those 9 are slice 4a's, not 4b's; verified by per-file count off
  `git diff` (see the 4a/4b attribution above). A reviewer scoped to a cumulative worktree diff
  will keep making this mistake — brief slices 5–7 with the attribution up front.
- **Important — UPHELD, fixed.** The `intent-launch-helpers.ts:91` log/logic divergence. Site #2
  is now suppressed rather than deleted; see the slice 4b decision above.
- **Suggestion — partly right, fix applied by hand.** It found broken indentation at
  `intent-raise-intent-for-context.ts:165-167` (2 spaces where the block is 4) — real, and left
  over from slice 4a's `intentCandidates[0]!` edit. Its proposed remedy, `vp fmt`, is **banned**
  on this repo and would rewrite 190 files. Corrected manually; all four verify commands re-run
  green afterwards.
- **Praised, worth keeping:** the bucket B comments name the concrete boundary (MessagePort,
  DACP wire message, App Directory JSON) rather than "might be null", which is what makes them
  auditable later. Both bucket A drops were independently confirmed safe against the state types
  — `AppInstance.metadata` and `AppInstanceMetadata` are required fields, not wire data.

### Slice 5 — `agent-skills:security-auditor`, verdict: all three deletions safe, no Required

Briefed with the slice-4b lesson (reason about the code *after* the deletion, not with the check
intact). It did, and its evidence is a real trace rather than an assertion:

| Deletion | Why it is safe |
|---|---|
| `harness-browsing-context-close.ts:53` — `&& connection.source` | `AppConnectionMetadata.source: Window` (`wcp-types.ts:182`) is required, and its **only** construction site, `handleWCP1Hello` (`wcp1-3-handshake.ts:36-84`), returns early on `if (!event.source) return` before building the metadata object. `updateConnectionMetadata` never touches `.source`; `getConnections()` returns raw map values untransformed. |
| `harness-browsing-context-close.ts:133` — `if (!appConnection?.sendToAppInstance) return` | `SailDesktopAgent.appConnection` is `readonly`, assigned in the constructor (`sail-desktop-agent.ts:152`); every call site types `desktopAgent: SailDesktopAgent` with no generic, so `TEdge` defaults to `BrowserAppConnection`, whose `sendToAppInstance` (`browser-app-connection.ts:144`) is a plain prototype method, not a conditionally-attached property. Both halves were compile-time guaranteed. |
| `harness-bootstrap.ts:177` — `if (metadata.source)` | Same `source` fact. `popupWatcher.remapPopupByWindow` also declares `source: Window` non-optional (`popup-launcher.ts:27`), so the guard was not protecting the callee either. |

On the instance-conflation worry: `other.source === connection.source` is reference equality on
real `Window` objects, each captured from a distinct `event.source` per handshake, so two apps'
windows are never `===`. The only way it could wrongly group instances is two `undefined`
sources (`undefined === undefined`), which the handshake's early return already prevents.
**The deleted guard was never what prevented that failure mode.**

- **Required:** none.
- **Follow-up:** none.
- **Ignore for MVP — but worth recording:** `harness-browsing-context-close.ts:36` is filed as
  bucket B, yet it is **not a trust boundary** — it is a TypeScript *narrowing gap* (the compiler
  does not invalidate `.closed` across the `.close()` call that mutates it). The suppression
  comment says exactly that rather than mislabelling it as untrusted input, so the outcome is
  right. The taxonomy is what is imprecise: bucket B currently conflates "the value crosses a
  trust boundary" with "the compiler cannot model this mutation". Both mean *suppress, never
  delete*, so nothing in slices 1–6 turns on it — but slice 7's `AGENTS.md` rewrite should not
  claim bucket B is only about trust boundaries.

### Slice 5 — `agent-skills:code-reviewer`, verdict APPROVE, no Required findings

- **Required:** none.
- **Follow-up:** the plan named `src/__tests__/harness-open-with-context.harness.ts:54` as a
  bucket B site needing a suppression comment, and the diff has none — because the file is inside
  `**/__tests__/**` where the rule is off, so the finding never fires. A stronger outcome than a
  per-line suppression. Recorded in the slice 5 Verification Notes above so nobody hunts for a
  comment that was never needed.
- **Ignore for MVP:** none.

**The plan carried a second wrong boundary citation, and the coder caught it unprompted.** The
bucket C table cites `AgentAppConnection.sendToAppInstance` — **that interface has no such
member**, only a nested `connectionRegistry.sendToAppInstance(message)` with a different arity.
The real type is `BrowserAppConnection.sendToAppInstance(instanceId, message)`
(`browser-app-connection.ts:144`), reached because the function's parameter is a bare
`desktopAgent: SailDesktopAgent`, so `TEdge` defaults to `BrowserAppConnection`. The coder
re-derived it from the source instead of suppressing under a name that did not match the actual
type. **That is precisely the check this plan's headline risk exists to force**, and it is the
second boundary mis-citation found in slice 5 alone — treat the plan's remaining tables as
leads, not as facts.

Reviewer independently confirmed, running all four verify commands itself rather than taking
them from the brief: all 5 suppressions are single `//` lines immediately above the exact flagged
sub-expression (including the two consecutive ones in `harness-console-capture.ts`, which are
independent findings and each need their own); the `vite.config.ts` override pair uses the
`error`-then-`off` shape with `{ts,tsx}` and sits ahead of the generic `**/*.{jsx,tsx}`
catch-all; and all 13 non-null assertions are floored by a preceding `.length` check, a
single-element fixture, or a `toHaveBeenCalledWith` assertion — **none masks a path where the
value could legitimately be absent**.

### Slice 6 — `agent-skills:code-reviewer`, verdict REQUEST CHANGES (two Required, both upheld)

The reviewer was briefed up front that commit `c0ea8a542` carries slices **1–6**, and that slice 6
is only `packages/sail-one` + `packages/sail-finance` plus their two `vite.config.ts` override
pairs. That attribution note worked: unlike slice 4b's reviewer, this one did not miscount
cumulative artifacts against a single-slice brief.

- **Required 1 — a SECOND bucket D bug, in the same file, missed by the same session.**
  `custom-apps.tsx` `getAllContextTypes()` (line 60) discarded the return value of
  `allContexts.concat(...)` **six** times — `:66`, `:67`, `:71`, `:72`, `:77`, `:82`. Identical
  defect to the `getAllIntentNames()` bug fixed 25 lines below it in this same slice. The
  function had never returned a single app-declared context type, only the static
  `CONTEXT_TYPES` seed; it feeds the context-type picker at `custom-apps.tsx:219`. Confirmed by
  main agent reading the source before dispatching any fix.
  **Fixed** — all six converted to `allContexts.push(...X)`, matching the sibling fix. The four
  `?? []` fallbacks were **kept**: `userChannels.listensFor`, `userChannels.broadcasts`,
  `appChannels[].broadcasts` and `appChannels[].listensFor` are all declared optional on
  `DirectoryApp` (`packages/sail-desktop-agent/src/app-directory/types.ts:148-163`), so the
  fallbacks are not unnecessary conditions. `v.contexts` (`IntentDefinition.contexts: string[]`)
  and `raises[*]` (`Record<string, string[]>`) are required, and never had a fallback.
  `getAllContextTypes` was widened to `export` for testability — same accepted
  `only-export-components` trade as `getAllIntentNames` and `resolver.tsx:153`.
  **Lesson: when a bug shape is found, grep the whole file for the shape before moving on.** The
  first `concat` bug was found by reading around an unrelated bucket A/C site; its twin sat 25
  lines above and was still missed, because the search stopped at the first hit.

- **Required 2 — an undocumented suppression at `Layout.tsx:82`.** A third `no-unnecessary-condition`
  suppression (`typeof savedLayoutState !== "object"`) was landed by the earlier session with no
  entry in the slice 6 findings table and no main+user classification, which the slice 4b rule
  requires for every constant-condition finding. The reviewer isolated the flagged sub-line with
  a throwaway probe and confirmed the rationale holds — the content is right, only the paper
  trail was missing. **Recorded here; that closes it.**

- **Follow-up (accepted as a documented outlier, not fixed).** `Layout.tsx:82` is the only
  `oxlint-disable-line` (inline, same-line) suppression in the repo; the other 49 all use
  `oxlint-disable-next-line` on the line above, which is the shape this plan mandates. A coder
  attempted the conversion and **could not make it suppress**: `vp lint --format json` shows this
  diagnostic carries **two labels** — one on the `typeof ...` line, one on the `savedLayoutState
  === null` line below it. The `-next-line` directive was tried above every line in the chain,
  individually and in combination; all failed identically. Only the same-line form works.
  So: `oxlint-disable-next-line` cannot suppress a diagnostic whose span crosses lines. The
  file was reverted to its committed text. **The mandated shape now reads: a single `//` line
  immediately above the exact flagged sub-line, EXCEPT where the diagnostic spans multiple lines,
  in which case the trailing same-line `oxlint-disable-line` is the only form that works.**

- **Follow-up (deferred, pre-existing).** `resolver.test.ts:32` —
  `expect(state.chosenIntent).not.toBeUndefined()` should be `.toBeNull()`; any string passes
  today. Raised by slice 2's review, still open. Not introduced by slice 6. Parked.

- **Ignore for MVP:** the 17-vs-15 suppression count drift against the plan's estimate; and the
  reviewer's own independent re-derivations, which all agreed with the slice's classifications —
  `appd.tsx:173,184` bucket C (the `{app ? (` JSX guard at `:160` wraps both `onClick` handlers,
  so `chosen` is non-null in those closures at runtime, not just to the type checker);
  `resolver.tsx:118,313` bucket A (TS 5.9.3 does infer the predicate from `.filter(a => a != null)`);
  and all remaining bucket B suppressions, each a single `-next-line` above the exact sub-line
  with a concrete boundary named.

### Slice 7

- Required:
- Follow-up:
- Ignore for MVP:

---

## Parked Follow-ups

- **No retained `CLOSED` instance state — a spec SHOULD that Sail does not meet.**
  `browserResidentDesktopAgents.md` ("Disconnects") requires DAs to track close/navigate for
  accurate `findInstances` / `findIntent` / `findIntentsByContext`, and says instance details
  SHOULD be retained after close because navigation looks like a close. `removeInstance`
  (`src/state/mutators/instance.ts:62-68`) deletes the key instead, so a navigating app
  disappears from `findInstances` and reappears under a new `instanceId`. Fix is a third
  `AppInstanceState` member plus selector filtering — **not** dropping the delete, since
  `TargetInstanceUnavailable` currently depends on `getInstance` returning `undefined`. This is
  the change that makes the four slice-4b suppressions load-bearing. Sizeable; needs its own
  plan.
- **The readiness predicate is inlined eight times and never named.** Two distinct concepts,
  four spellings, six files: "alive" as `state !== PENDING && state !== CONNECTED`
  (`intent-delivery-helpers.ts:79`), as `=== CONNECTED || (=== PENDING && id === launcherId)`
  (`intent-launch-helpers.ts:92, 107`), and as `=== CONNECTED || === PENDING`
  (`intent-launch-helpers.ts:136`, `intent-raise-shared.ts:106`); "ready now" as `=== CONNECTED`
  alone (`state/selectors/instance.ts:24`, `intent-helpers.ts:59`, `intent-raise-shared.ts:110`,
  `intent-resolver-helpers.ts:137`). Nothing at a call site says which is intended. Extracting
  `isInstanceReceivable` / `isInstanceConnected` into `state/selectors/instance.ts` collapses
  the tautology to one function — one suppression instead of four, and the `CLOSED` work above
  becomes a one-line edit in a named place. Behaviour-preserving, but it is a refactor of intent
  routing; doing it inside a lint-enablement slice would make the diff unreviewable.
- **`intent-delivery-helpers.ts:77` gates delivery on the wrong axis.** The spec ties delivery
  to listener registration (`IntentDeliveryFailed` = "has not added an intent handler within a
  timeout"), not to connection state. Sail already has `isIntentListenerReady` at `:34`; the
  `PENDING || CONNECTED` test at `:77` duplicates the question more weakly. Related live gap:
  `wcp-host-instance-adoption.ts:66, 102, 113` hunts for lingering `PENDING` instances to adopt
  and `wcp-multi-pending-adoption.integration.test.ts` has a constant named `STALE_PENDING_ID`,
  so a half-finished WCP handshake **does** sit in the map indefinitely. `intent-raise-shared.ts`
  prefers `CONNECTED` over it (`:109-112`); `intent-delivery-helpers.ts:77` does not, and will
  deliver a pending intent to an instance that never completed WCP5. Exists today, independent
  of this plan.
- **`conformance-app-directory.ts:78` casts imported JSON with `as DirectoryApp[]` and never
  validates it.** This is the root cause behind three separate bucket B findings in the
  harness. Worth a schema check at import, but it is a validation task, not a strictness task.
- **The transport-logging flake** — `wcp-host-logger-threading.test.ts`, reproduced twice under
  parallel load, both times with inflated `environment` time. Self-inflicted by running Vitest
  alongside another heavy command.
- **`sail-one` is missing from root `vitest.config.ts`'s `projects` array**, so `npx vp test run`
  never runs its tests. Either add it (and deal with whatever that surfaces) or record that
  `sail-one` is deliberately focused-run-only. Out of scope for a strictness slice.
- **`@tailwindcss/vite` is declared but not installed**, so `packages/sail-finance/vite.config.ts`
  has two standing lint errors on an otherwise clean tree. Either install it or drop it from
  `package.json`. Out of scope here — it is a dependency-hygiene task, not a strictness task,
  and fixing it inside a strictness slice would muddy that slice's diff.
- **`website/`** was never measured. Decide separately whether it gets the same treatment.
- **Other type-aware rules** — `no-unnecessary-condition` was the only one evaluated. Others in
  oxlint's non-`correctness` categories may be worth the same treatment, or may not.

---

## Known Limitations

- The bucket A/B/C/D split for `sail-desktop-agent` outside `state/mutators` is a sample, not
  a complete audit. Slice 4 completes it.
- Seven of the nine bucket D findings rest on a classifier's report rather than direct reading.
  **Update:** all three `sail-one` findings (slice 2) and all five `sail-finance` findings
  (slice 1) were subsequently confirmed real by direct reading. Eight of the nine are now
  verified; none was a false positive.
- **Accepted lint warning:** `packages/sail-one/src/resolver/resolver.tsx:153`
  `react(only-export-components)`. `generateStartState` had to be exported to be testable, and
  exporting a non-component from a component file trips the fast-refresh rule. Resolving it
  properly means extracting a module, which this plan's Architecture line forbids. Four
  equivalent warnings already stand elsewhere in the repo (`index.tsx`,
  `channel-selector.tsx` x3).
