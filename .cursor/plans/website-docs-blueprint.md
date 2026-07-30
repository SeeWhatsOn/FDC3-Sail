# Minimal Viable Delivery Plan: Website & Docs Blueprint

Status: planning
Current slice: 0 (layering decision) — not started
Review/fix loops: 0

Source reviews feeding this plan:
- `ARCHITECTURE-REMEDIATION-PLAN.md` (2026-07-30) — docs audit, 40+ defects across 13 `website/docs/` pages
- `FDC3-SAIL-REVIEW.md` (2026-07-28, `4dddd88f7`) — BLOCK-B/C/D and D-1…D-10; partly drifted, see Risks
- `.cursor/plans/sail-desktop-agent-review-remediation.md` — in flight, slices 0–6 landed. **Do not interleave.**

---

## Intent

- **Outcome:** `website/docs/` becomes the single authoritative description of how the monorepo is
  composed, what each package owns, and how a host wires them together — with every claim marked as
  either **implemented** or **planned**, so the docs can lead the code without becoming fiction again.
- **User:** Sail maintainers first (the docs become the reference they reconcile code against), then
  external integrators and FINOS reviewers.
- **Success:**
  1. No page contains a verifiably false statement about the code as it exists.
  2. Every architectural claim is marked `implemented` or `planned`; nothing is unmarked.
  3A new reader can answer, from the docs alone: which package owns what, which entry point to
     construct, what a host must implement, and how an app connects.
  4. `npm run docs:build` green, all internal links resolve, all code snippets compile.
- **Constraint:** the docs currently describe a three-layer stack whose middle layer has **zero
  consumers**. That single unresolved decision blocks four pages. Slice 0 is a decision, not prose.
- **Out of scope:**
  - Code changes to make the docs true. Where code and blueprint disagree, the doc records the gap as
    `planned` and the fix goes to the remediation plan. **This delivery writes docs, not product code.**
  - `README.md` beyond the validation section (`FDC3-SAIL-REVIEW.md` BLOCK-B) — it is the worst single
    page but it is a separate audience. Slice 1 fixes the false mechanism; a full README rewrite is
    parked.
  - Publishing the packages, re-baselining conformance, iframe sandboxing. Those are product work
    (BLOCK-A/D/E). Docs stop *claiming* them; they don't fix them.
  - New doc tooling, a new site theme, versioned docs, or i18n.

---

## Simplicity Bias

- **Reuse:** two pages are already accurate and become the spine —
  `packages/desktop-agent/overview.md` and `packages/desktop-agent/composition.md`. `lint:boundaries`
  (`.oxlintrc.json`) **already encodes the layering rules** as a CI gate; the docs should cite it as the
  executable contract rather than restate the rules in prose. Docusaurus already builds in CI.
- **Avoid:** a new ADR directory, per-claim frontmatter schemas, a docs linter, or generated API
  reference. The status marker is an admonition, not a system.
- **Architecture:** one spine page owns the layering truth. Every other page links to it instead of
  re-describing it. That is the fix for the actual failure mode — the three-layer diagram is currently
  duplicated across three pages, so it went stale in three places at once.

---

## Slices

### 0. Decide and record the layering contract

- **Goal:** one short decision, written down, that the rest of the docs can be authored against:
  does `SailPlatform` compose `SailDesktopAgent`, or is the factory the supported entry point and
  `SailPlatform` withdrawn? Recorded as a section in the spine page, not a separate ADR file.
- **Why first:** four pages are wrong *because* this is open. Authoring them now guarantees a second
  rewrite.
- **Inputs already gathered:** `SailPlatform` has zero consumers outside its own two tests;
  `sail-finance` uses `createSailBrowserDesktopAgent`; workspaces/layouts are Zustand + `localStorage`;
  the middleware pipeline collects handlers that are never applied; the agent deliberately exposes no
  transport seam. `.cursor/plans/sail-platform-extensibility.md` already landed on "build nothing yet."
- **Acceptance:** the decision names the supported construction path, states what `sail-platform`
  keeps, and says whether `sail-finance` migrating is `planned` or not happening. One paragraph is
  enough.
- **Verify:** maintainer confirms. No build step.
- **Likely files:** `website/docs/architecture/overview.md`

### 1. Truth pass — delete every false statement

- **Goal:** no new content. Remove or correct only what is verifiably wrong. Independent of slice 0
  and safe to land immediately.
- **Scope (each verified against source):** the `new DesktopAgent()` samples in 5 places (type-only
  `@internal` export — cannot compile); `npm install` instructions for unpublished packages;
  `npm run dev:harness` → `dev:conformance`; `npm run generate:schemas` (no such script);
  `sail-server/` in the repo tree; Socket.IO; `plans/work-items/`;
  `message-port-transport.ts` → `message-port.ts`; `validateDACPMessage`/`safeParseDACPMessage` and
  the `DesktopAgent` re-export in `platform/overview.md` (neither exists); `await platform.start()`
  (returns `void`); the README validation section (Zod → `@finos/fdc3-schema`, `warn` default);
  the production-readiness contradiction between `README.md` and `intro.md`.
- **Acceptance:** every item above corrected or deleted. No claim added that isn't already true.
  Docs build green, links resolve.
- **Verify:** `npm run docs:build`; grep for each removed string returns zero hits outside this plan.
- **Likely files:** `website/docs/getting-started.md`, `intro.md`, `run-sail.md`, `development.md`,
  `packages/desktop-agent/integrator-guide.md`, `packages/platform/overview.md`,
  `packages/conformance-harness/overview.md`, `README.md` (validation section only)

### 2. The spine — one architecture page that owns the layering truth

- **Goal:** rewrite `architecture/overview.md` as the single source for package ownership, the
  supported entry point, the host-contract surface, and the app-connection model. Establish the
  **status marker convention** here and use it: every architectural claim carries `implemented` or
  `planned`.
- **Acceptance:** the layering diagram exists in exactly **one** place in the docs; the other pages
  link to it. Reflects slice 0's decision. Every claim marked. Cites `lint:boundaries` as the
  enforced version of the rules.
- **Verify:** `grep -rc "three-layer\|Layer 2" website/docs` returns 1 file. Docs build green.
- **Likely files:** `website/docs/architecture/overview.md`, `architecture/deployment-targets.md`
  (layer diagram removed, native-shell section kept verbatim)

### 3. Package pages reconciled to the spine

- **Goal:** each package page describes what that package actually owns and links to the spine for
  layering. Rewrite `packages/sail-finance/overview.md` (every substantive claim is currently wrong)
  and `packages/platform/overview.md` (blocked on slice 0). Patch `composition.md` and
  `integrator-guide.md` — excise the `SailPlatform` sections and the manual-composition path.
- **Acceptance:** no page re-describes the layering. `sail-finance`'s page names its real
  construction path, its real persistence mechanism, and its real host-contract implementations.
- **Verify:** docs build; snippets compile (see Test Plan).
- **Likely files:** `website/docs/packages/**`

### 4. Document the load-bearing pieces that appear nowhere

- **Goal:** the parts a new reader most needs and cannot currently find. One short page or section
  each, no speculation.
- **Scope:** `createSailBrowserDesktopAgent` as the actual production entry point;
  `SailAppLauncher` and its `onLaunchApp`/`onCloseApp` contract (the real host seam — every current
  page teaches the raw `AppLauncher` interface instead); the WCP4 origin allowlist **including that
  it currently fails open and ships unwired** (`FDC3-SAIL-REVIEW.md` Security #2 — document the gap,
  don't fix it here); the dockview panel/popout-relay shell and the Zustand store family;
  `@finos/sail-theme`; `toolbox-local` / `VITE_CONFORMANCE_TOOLBOX`.
- **Acceptance:** each item has a home and is reachable from the sidebar. Security gaps are stated,
  not glossed.
- **Verify:** every new page appears in `website/sidebars.ts` (the conformance-harness page is
  currently orphaned — fix that here). Docs build green.
- **Likely files:** `website/docs/architecture/`, `website/docs/packages/`, `website/sidebars.ts`

### 5. Generate the conformance page instead of maintaining it

- **Goal:** `packages/desktop-agent/conformance.md`'s feature/scenario inventory becomes generated
  from `packages/sail-desktop-agent/test/features/`. It currently cites three feature files that do
  not exist, gets 10 of 12 counts wrong, states 103 against an actual ~136 `@fdc3_2.2`, and omits six
  `@fdc3_3.0` files. **It is wrong because it is hand-maintained.**
- **Acceptance:** counts and file lists come from the tree. Narrative sections stay hand-written. The
  page states the conformance baseline is unmeasured (`FDC3-SAIL-REVIEW.md` BLOCK-E) rather than
  implying a figure. Retire the dead work-item slugs.
- **Verify:** run the generator; diff is empty on a clean tree. Add it to `npm run validate`.
- **Likely files:** `website/docs/packages/desktop-agent/conformance.md`, one small script,
  `package.json`

### 6. Guardrails so it cannot rot the same way

- **Goal:** the two cheap checks that would have caught most of this audit.
- **Scope:** typecheck the doc code snippets (a `new DesktopAgent()` sample that cannot compile is
  the single most embarrassing class of defect here, and it is mechanically detectable); internal link
  check. Both into `npm run validate` / CI.
- **Acceptance:** a snippet referencing a non-existent export fails CI. A dead internal link fails CI.
- **Verify:** deliberately break one of each; confirm CI fails; revert.
- **Likely files:** `package.json`, `.github/workflows/ci.yml`, `website/`

---

## Test Plan

Docs, so "tests" means mechanical checks. Risk-based, not exhaustive.

- **Unit-equivalent:** snippet compilation (slice 6). This is the highest-value check — it catches the
  `new DesktopAgent()` class of error and every future API drift in examples.
- **Integration-equivalent:** `npm run docs:build` after every slice; internal link resolution;
  conformance generator produces an empty diff on a clean tree.
- **Manual:** one read-through of slices 2–4 answering the four Success questions from a cold start.
  This is the only check that catches "technically true but unusable", which is the actual current
  failure mode of `integrator-guide.md`.
- **Not testing:** prose style, external link liveness (flaky), Docusaurus rendering, accessibility of
  the docs site.

---

## Review Plan

- **Main-agent checks after each slice:** does the diff contain only that slice? Docs build green? Did
  any *new* unverified claim get introduced — and if so, is it marked `planned`?
- **Fresh-context review required for:** slice 0 (the decision — a wrong call here costs two
  rewrites) and slice 2 (the spine — everything else links to it). For slices 1 and 5 the mechanical
  checks are the review.
- **Verification discipline carried over from the remediation plan:** for slice 1, each deletion must
  be justified by a grep showing the referenced thing does not exist. Do not delete a claim because it
  *looks* stale.
- **Loop limit:** 3. Then return to the user with: reduce scope, change the approach, or accept a
  documented gap.

---

## Risks

- **Target-state drift — the main risk, and the one that created this mess.** The docs are meant to
  lead the code. Without the status marker convention from slice 2 applied consistently, this delivery
  reproduces the exact defect it is fixing: a plausible architecture nobody implemented. If markers
  start feeling like overhead, that is the signal to write less aspiration, not fewer markers.
- **Slice 0 is a genuine product decision, not a docs task.** It may need more than one conversation.
  Slice 1 is deliberately independent so work isn't blocked meanwhile.
- **Collision with in-flight remediation.** Slices 7–11 of
  `sail-desktop-agent-review-remediation.md` touch logger threading, timer registries, dead code, and
  public API (`intentResolverUI`, `BrowserIntentResolverController` are being removed). Slice 3 of
  this plan documents that surface. **Land the remediation slices first**, or slice 3 documents an API
  about to change.
- **`FDC3-SAIL-REVIEW.md` is itself partly stale** (2026-07-28, `4dddd88f7`; ~10 commits behind, counts
  93 source files vs 103 today). Re-verify before citing it in a doc. Its documentation findings
  D-1…D-7 were independently re-confirmed 2026-07-30 and are safe to act on; its code-level findings
  (C-5, C-6, NEW-2, NEW-4, BLOCK-A, Security #2) were **not** re-verified for this plan and belong to
  product work, not docs.
- **Documenting known security gaps in public docs** (slice 4: allowlist fails open, no iframe
  sandbox). This is the right call for an incubating project and matches the existing honest framing
  in `deployment-targets.md` — but confirm the maintainers agree before publishing, and pair each with
  its remediation status.
- **Scope creep into a README rewrite.** The README is the worst page but a different audience. Slice 1
  fixes only the false validation mechanism. Resist the rest.

---

## Slice Checkpoints

- [ ] 0 — Layering decision recorded
- [ ] 1 — Truth pass
- [ ] 2 — Spine page + status marker convention
- [ ] 3 — Package pages reconciled
- [ ] 4 — Undocumented load-bearing pieces
- [ ] 5 — Generated conformance inventory
- [ ] 6 — Snippet + link guardrails in CI

## Verification Notes

- _(none yet — planning only)_

## Review Notes

- Required: _(none yet)_
- Follow-up: _(none yet)_
- Ignore for MVP: _(none yet)_

## Parked Follow-ups

- Full `README.md` rewrite beyond the validation section.
- OSS hygiene docs from `FDC3-SAIL-REVIEW.md`: stale CoC project name (D-8), boilerplate `SECURITY.md`
  routing vulnerabilities to public issues (D-9), missing PR template. Cheap and high-credibility for
  FINOS, but a different surface from `website/docs/`.
- `AGENTS.md` branch references (D-10) — already modified in the working tree; confirm before touching.
- Generated API reference from TSDoc. Only worth it once the public surface settles.
- Versioned docs. Not until the packages actually publish.

## Known Limitations

- The docs will state an **unmeasured** conformance position until the FINOS toolbox is re-run
  (`FDC3-SAIL-REVIEW.md` BLOCK-E). Slice 5 makes that honest rather than resolving it.
- Pages marked `planned` are, by construction, not yet true. That is the tradeoff of a
  blueprint-first approach and the reason the marker convention is non-negotiable.
