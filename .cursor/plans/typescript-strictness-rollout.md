# Minimal Viable Delivery Plan: TypeScript strictness rollout

Status: planning
Current slice: 1 (not started)

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

**Model guidance.** Slices 1 and 2 are real bug fixes with subtle reachability reasoning —
use **opus**. Slices 3–7 are mechanical once each finding is classified — **sonnet** is
sufficient, except slice 4, where the unclassified tail needs judgement; use opus there.

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

- [ ] 1. `sail-finance` provider guards: not started (failures: 0)
- [ ] 2. `sail-one` array indexing: not started (failures: 0)
- [ ] 3. Enable on `sail-platform`: not started (failures: 0)
- [ ] 4. Enable on `sail-desktop-agent`: not started (failures: 0)
- [ ] 5. Enable on `sail-conformance-harness`: not started (failures: 0)
- [ ] 6. Enable on `sail-one` + `sail-finance`: not started (failures: 0)
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

---

## Review Notes

- Required:
- Follow-up:
- Ignore for MVP:

---

## Parked Follow-ups

- **`conformance-app-directory.ts:78` casts imported JSON with `as DirectoryApp[]` and never
  validates it.** This is the root cause behind three separate bucket B findings in the
  harness. Worth a schema check at import, but it is a validation task, not a strictness task.
- **The transport-logging flake** — `wcp-host-logger-threading.test.ts`, reproduced twice under
  parallel load, both times with inflated `environment` time. Self-inflicted by running Vitest
  alongside another heavy command.
- **`website/`** was never measured. Decide separately whether it gets the same treatment.
- **Other type-aware rules** — `no-unnecessary-condition` was the only one evaluated. Others in
  oxlint's non-`correctness` categories may be worth the same treatment, or may not.

---

## Known Limitations

- The bucket A/B/C/D split for `sail-desktop-agent` outside `state/mutators` is a sample, not
  a complete audit. Slice 4 completes it.
- Seven of the nine bucket D findings rest on a classifier's report rather than direct reading.
