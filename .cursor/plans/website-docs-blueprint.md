# Minimal Viable Delivery Plan: Website & Docs Blueprint

> **Partly superseded by the 2026-08-04 `sail-platform` cull.** The docs this blueprint produced have
> been rewritten: `sail-platform` no longer has "two entry points", host chrome, or a lifecycle — it
> holds workspaces, layouts and storage with zero dependencies, and hosts construct
> `SailDesktopAgent` directly. `architecture/security.md` is now "App admission and origin trust"
> rather than a page about the (parked) WCP4 origin allowlist. The blueprint's *method* — status
> markers, standalone package framing, one source of truth per claim — is unchanged and still applies.

Status: planning
Current slice: 0 (layering + middleware/observability decision) — decisions recorded; the description is
**drafted** in `.cursor/plans/sail-platform-design.md`, rewritten 2026-08-03 as a **standalone package
description** (see the framing rule below). **The only thing left for slice 0 is the maintainer
source-check** (that doc's §9, now 4 items). Slice 1 (truth pass) is **committed** (`ffdd94f5b`).
Review/fix loops: 0
Updated 2026-07-31 (`06476be62`): `sail-one` landed as a real `SailPlatform` consumer. This resolves the
"middle layer with zero consumers" premise and reframes slice 0 from a green-field design session to
documenting **two supported entry points** (`createSailBrowserDesktopAgent` vs `SailPlatform`). See
Product Positioning, Constraint, Slice 0, Slice 3, and Risks. Companion register §A/A12/G2 updated to match.

Updated 2026-07-31 (maintainer direction): two decisions recorded. **(1) The middleware question is
closed.** "Middleware" is dropped as a concept; the mechanism is the **agent observability seam** — a
typed `AgentEvent` stream surfaced on the `SailDesktopAgent` controller surface (like the logging,
channels and intent controllers), mapped to OpenTelemetry in `@finos/sail-platform`, with plain `Logger`
diagnostics as the second, separable half. It is fully designed at
`.cursor/plans/agent-observability-seam.md` and is `planned` (not yet landed). Docs describe its shape and
mark it `planned`; they do not document an unbuilt API. **(2) Audience re-ranked newcomer-first** and a
**front-door narrative + unified "how to consume"** slice added (Slice 2b), because the largest audience
is people new to the project deciding whether and how to adopt it. **(3) All documentation lives in the
Docusaurus site** — including building and contributing, like [fdc3.finos.org](https://fdc3.finos.org) —
and the repo keeps only the files GitHub/npm resolve by path, as stubs. See the revised Intent, Product
Positioning, Documentation homes, Slice 0, Slice 2b, Slice 4b, and Risks.

Updated 2026-08-03 (maintainer direction — **framing rule for all package pages**): **package
documentation is written standalone.** A package page says what the package **is**, what it **does**, why
it **needs to be what it is**, and **how** to use it. It does **not** justify the package by who consumes
it, and it does **not** downgrade an API's status because no in-repo shell drives it — "no consumer" is a
fact about the shells, not a limitation of the package. Consumers appear only as *reference
implementations* in an appendix. Consequence already applied: `workspaces`/`layouts`/`sailConfig` flip from
`planned` to **`implemented`** (they delegate to a working `LocalStorageBackend`); the honest caveats are
`unknown`-typed payloads and `storage: "remote"` throwing. This rule binds Slice 3 (per-package pages) and
the package sections of Slice 2.

Source reviews feeding this plan:
- `ARCHITECTURE-REMEDIATION-PLAN.md` (2026-07-30) — docs audit, 40+ defects across 13 `website/docs/` pages
- `FDC3-SAIL-REVIEW.md` (2026-07-28, `4dddd88f7`) — BLOCK-B/C/D and D-1…D-10; partly drifted, see Risks
- `.cursor/plans/sail-desktop-agent-review-remediation.md` — in flight, slices 0–6 landed. **Do not interleave.**

---

## Intent

- **Outcome:** the website becomes **the face of Sail for people who want to use the packages** — a
  reader arrives, works out which package solves their problem, and gets started. Underneath that,
  it is the single authoritative description of how the packages compose, with every claim marked
  **implemented** or **planned** so the docs can lead the code without becoming fiction again.
- **Users — five audiences, newcomer-first (re-ranked 2026-07-31).** The current docs serve none of them
  cleanly because they are organised by repository layout rather than by what a reader is trying to do.
  The **largest and highest-priority** audience is the newcomer/evaluator, whom the old ranking buried
  under package-specific adopters:
  1. **Newcomers and evaluators (primary)** — arrive knowing little. They need, in order: what FDC3 is
     (and a link out to the FINOS spec), what Sail is (a standards-compliant FDC3 **Desktop Agent**), what
     it grows into (an **interoperability platform**), what its **composite parts** are (one architecture
     diagram), and **how to consume it**. They must reach a path decision without first knowing which
     package they want.
  2. **Desktop Agent adopters** — want `@finos/sail-desktop-agent` standalone from npm, as an FDC3 Desktop
     Agent inside their own host. One of the three "how to consume" paths (compose it yourself).
  3. **App deployers** — want to **serve a shell** (`sail-one` or `sail-finance`) as a deployable,
     customisable interop platform, and need to know which one fits and how to customise it. The second
     "how to consume" path. (A **hosted** version is intended but has no address yet — `planned`.)
  4. **Platform integrators** — want `@finos/sail-platform` for the business-readiness layer: workspaces,
     layouts, telemetry, auth, entitlements, persistent storage, connectors.
  5. **Contributors, maintainers and FINOS reviewers** — need the architecture, the boundaries, and how to
     build on and maintain Sail. Served **on the site** like every other audience (`development.md` + a
     Contributing page); the repo keeps only GitHub/npm path-resolved files as stubs — see **Documentation
     homes** below.
- **Success:**
  1. No page contains a verifiably false statement about the code as it exists.
  2. Every architectural claim is marked `implemented` or `planned`; nothing is unmarked.
  3. Each audience has a discoverable path from the landing page to a first success without reading the
     others; the newcomer/evaluator (primary) reaches a "how to consume" decision without first knowing
     which package they want.
  4. A reader can state which package owns what, which entry point to construct, what a host must
     implement, and how an app connects.
  5. `npm run docs:build` green, all internal links resolve, all code snippets compile.
- **Constraint (resolved 2026-07-31):** the docs describe a three-layer stack whose middle layer *had*
  zero consumers when this plan was written. `sail-one` is now that consumer, so the layer's
  right-to-exist is settled by working code rather than by a design session. What remains is a
  **documentation** problem, not a product decision: the stack has **two supported entry points**
  (`createSailBrowserDesktopAgent` for `sail-finance`, `SailPlatform` for `sail-one`) and the docs must
  explain both and when each applies. The one genuinely open mechanism question — middleware — is now
  **also closed**: it becomes the observability seam (`planned`), not a doc-blocking decision. Slice 0 is
  therefore a description task, not a design session — see its rewrite below.
- **Out of scope:**
  - Code changes to make the docs true. Where code and blueprint disagree, the doc records the gap as
    `planned` and the fix goes to the remediation plan. **This delivery writes docs, not product code.**
    The observability seam is product code and stays in its own plan; here it is documented as `planned`.
  - Building the **hosted** offering. A hosted `sail-one`/`sail-finance` is intended but has no address
    today; the "how to consume" surface (Slice 2b) names it as `planned` and stops there.
  - An **expansive** rewrite of README prose. Per **Documentation homes**, contributing/building/governance
    are now authored on the site (Slice 4b) and the repo files are reduced to **stubs that link there** —
    that shrink is in scope and cheap. Slice 1 still fixes the false mechanism in the root `README`
    validation section (`FDC3-SAIL-REVIEW.md` BLOCK-B). What stays parked is writing *new* long-form README
    content — there won't be any; the site holds it.
  - Publishing the packages, re-baselining conformance, iframe sandboxing. Those are product work
    (BLOCK-A/D/E). Docs stop *claiming* them; they don't fix them.
  - New doc tooling, a new site theme, versioned docs, or i18n.

---

## Product Positioning

Maintainer statement, 2026-07-30. **This is the intended shape and the thing the docs must
communicate.** Everything below is the target; the `implemented` / `planned` marker carries how much
of it exists today. All four packages are designed to work together, and each is independently
consumable.

| Package | What it is for | Consumed as | Today |
|---|---|---|---|
| `@finos/sail-desktop-agent` | A standalone FDC3 Desktop Agent you can drop into your own host | npm | Substantially implemented. **Not published** — see register §C |
| `@finos/sail-platform` | The business-readiness layer: **workspaces, layouts, telemetry, auth, entitlements, persistent storage, and connectors** | npm | `SailPlatform` + `SailAppLauncher` + `SailPlatformClient` persistence now have a **real consumer** — `sail-one` (below). Telemetry, auth, entitlements, connectors: **not started**. Observability is the planned home for telemetry — the collected-but-unwired middleware pipeline is **superseded by the observability seam** (`.cursor/plans/agent-observability-seam.md`, `planned`) |
| `sail-one` | **Example UI** for the platform — **domain-neutral**, for general use. Tab-and-grid canvas with channel wiring | deploy + customise | **Landed 2026-07-31** (`06476be62`). Real shell built on `SailPlatform`; `private`/`v0.0.0`, not published. Interim gaps: structural channel/directory edits restart the agent, `embeddable-ui/` carried but unwired. Port brief: `.cursor/plans/sail-one-port.md` (its "no code written" status is now stale) |
| `sail-finance` | **Example UI** for the platform — **finance-specific**. Workspace-and-panel dashboard | deploy + customise | Shipping. **Not** "the reference host" — corrected 2026-08-03; both shells are examples, neither is canonical |

Two things follow that the docs must get right:

- **`sail-one` and `sail-finance` are two example UIs for the platform, split by domain, not maturity**
  (maintainer correction, 2026-08-03). `sail-finance` is finance-specific; `sail-one` is domain-neutral,
  for more general use. Layout (dashboard vs canvas) is a secondary detail — do **not** lead with it, and
  do **not** call either one "the reference host". A reader choosing between them needs the domain
  framing, not a feature table. This is the
  clearest single argument for `sail-platform` existing as a shared layer — two shells, one services tier —
  and as of 2026-07-31 it is **demonstrated, not hypothetical**: `sail-one` is the second shell and it
  composes the stack for real.
- **But the two shells compose the stack differently, and that tension is now a first-class doc topic.**
  `sail-finance` constructs `createSailBrowserDesktopAgent` (the lower entry, bypassing `SailPlatform`) and
  persists via Zustand + raw `localStorage`; `sail-one` constructs `new SailPlatform({...})` with
  `SailAppLauncher` and persists via `SailPlatformClient`. So the docs must explain **two supported entry
  points and when to reach for each**, and must stop presenting `SailPlatform` as unexercised — `sail-one`
  exercises `SailPlatform`, `SailAppLauncher`, `SailPlatformClient`, `platform.apps.*`,
  `platform.intentResolver.*`, and `platform.changeAppChannel` in a shipping shell.
- **Most of `sail-platform`'s stated purpose is still `planned`.** Telemetry, auth, entitlements and
  connectors do not exist in any form, and the middleware pipeline remains collected-but-unwired. This is
  where the marker convention earns its keep: the docs may describe the intended platform, but a reader must
  never mistake the `planned` services for something they can install today. The *composition spine*
  (construct → launch → resolve → persist) is `implemented`; the services tier is what stays `planned`.
  **Status is decided by the code, not by consumer count** (2026-08-03 framing rule): `workspaces`,
  `layouts` and `sailConfig` are `implemented` — backed by a working `LocalStorageBackend` — even though
  neither shell drives them. Their real caveats are `unknown`-typed payloads and a `"remote"` backend that
  throws.

**Middleware / extensions — decided 2026-07-31 (no longer open).** The mechanism is **not** middleware.
It is the **agent observability seam**: a typed `AgentEvent` stream (broadcast delivered, intent resolved
*including who the user picked*, channel joined/left, app connected/disconnected, …) surfaced on the
`SailDesktopAgent` controller surface exactly like the logging, channels and intent controllers, emitted
**after** each operation and never able to block or alter it. It has two separable halves that match the
intended telemetry story: (1) **event tracking** — events mapped to OpenTelemetry in `@finos/sail-platform`
(the agent takes no OTEL dependency); (2) **logging** — the existing `Logger` stays plain diagnostics,
which a host may map to OTEL Logs. This is fully designed at `.cursor/plans/agent-observability-seam.md`
and is `planned`. The collected-but-unwired middleware pipeline is superseded. Docs describe the seam's
shape and mark it `planned`; they do not document an unbuilt API.

## Documentation homes — the site is the single home (decided 2026-07-31)

**The maintainer's call is that all documentation lives in the Docusaurus site** — including building,
contributing and governance — the way [fdc3.finos.org](https://fdc3.finos.org) does. (This supersedes an
earlier split-by-audience draft; the site-single-home model is the cleaner one.) It is the plainest
possible expression of this plan's core rule, **every fact has exactly one home**: that home is the site,
always. Building and contributing are a *main part* of an OSS project, so they are first-class site content,
not repo afterthoughts.

The only files that stay in the repo are the ones **GitHub and npm resolve by path** — they cannot move, so
they become **thin stubs that link to the site**, not content:

| File | Why it must exist in-repo | Becomes |
|---|---|---|
| root `README.md` | GitHub repo landing + npm root | 1-paragraph pitch + links to the site |
| per-package `README.md` | npm renders it on each package page once published | short summary + link |
| `CONTRIBUTING.md` | GitHub surfaces it in the issue/PR flow | pointer to the site's Contributing page |
| `CODE_OF_CONDUCT.md`, `SECURITY.md`, `LICENSE` | GitHub community profile / Security tab / license detection; FINOS requires them | short canonical files, linked from the site |
| `.github/` issue & PR templates | GitHub reads them by path | unchanged |
| `AGENTS.md` *(may not exist — maintainer to decide)* | *if kept:* read by AI agents working **in the tree**, offline from the site | *if kept:* the one real in-repo operational doc, linking the spine for architecture, never restating it. If dropped, its build/contribute content moves to the site regardless |

Everything else — build-from-source, contributing, conventions, how to maintain or extend a shell,
architecture — is authored **once, on the site**. `development.md` is already the contributor/build home in
the sidebar; it becomes canonical and `CONTRIBUTING.md` points to it. This consolidation is **Slice 4b**.

- **Action for Slice 1:** `intro.md:112` already says "the site is the single source of truth for package
  documentation." Widen *package* to *all* documentation, and keep the "READMEs are brief summaries that
  link here" line — it is now the whole policy, not an exception.

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

### 0. Reconcile the layering story to two real entry points

- **Reframed 2026-07-31 — this is now mostly a docs task, not a design session.** The original slice
  asked "what should `SailPlatform` be, and does it deserve to exist" because it had no consumers.
  `sail-one` answered the existence question in code: it constructs `new SailPlatform({...})` with
  `SailAppLauncher` and `SailPlatformClient` persistence and drives the full composition spine
  (construct → launch → resolve → persist). The layer is validated. The remaining work is to describe
  the stack **as it now actually composes**, which has one genuinely new shape the old docs never
  anticipated: **two supported entry points.**
- **Purpose settled (2026-07-30), boundary settled by `sail-one` (2026-07-31), middleware settled by
  maintainer direction (2026-07-31).** See Product Positioning. The last open item — the
  **middleware/extensions mechanism** — is now **decided**: it becomes the **observability seam**
  (`.cursor/plans/agent-observability-seam.md`, `planned`), not middleware. Nothing in slice 0 remains a
  green-field decision; it is now purely a description task.
- **Goal:** an agreed description (not a from-scratch design) of the two-entry-point model —
  `createSailBrowserDesktopAgent` (what `sail-finance` calls) vs `SailPlatform` (what `sail-one`
  calls), the boundary each draws against `sail-desktop-agent`, what a host calls in each, and where
  the `planned` services tier plugs in. Plus the still-open middleware call.
- **Why first:** the spine page (slice 2) and four package pages (slice 3) all describe the layering,
  and they must describe **both** entry points consistently or they will contradict each other the way
  the current three-layer diagram already does across three pages. Get the two-entry-point framing
  agreed once, here.
- **Expected outputs:**
  - A component diagram showing **both** composition paths side by side —
    `sail-finance → createSailBrowserDesktopAgent → SailDesktopAgent` and
    `sail-one → SailPlatform → (SailAppLauncher, SailPlatformClient, SailDesktopAgent)` — so a reader
    sees the shared engine and the divergent entry.
  - A lifecycle sequence diagram stated as a **package contract**, not a shell walkthrough: platform
    storage is async while `apps`/`userChannels` are constructor data and `start()` is synchronous, so a
    host seeding from persisted state must `await` its reads **before** constructing. `sail-one`'s boot is
    the worked example of this rule, not its justification.
  - The decision rule: **when does a host reach for `SailPlatform` vs `createSailBrowserDesktopAgent`?**
    Framed by **what the host wants the package to own** (agent only vs agent + seams + storage +
    lifecycle), not by which shell picked which and not as a maturity gradient.
  - The middleware decision, now **recorded rather than made**: middleware is dropped in favour of the
    **observability seam** — a typed `AgentEvent` stream surfaced on the `SailDesktopAgent` controllers,
    mapped to OpenTelemetry in `@finos/sail-platform`, with plain `Logger` diagnostics as the second half.
    It observes **after** each operation and can never block or alter FDC3. Fully specified at
    `.cursor/plans/agent-observability-seam.md`; docs mark it `planned` and describe only its shape.
  - The gap between target and today, written as the `planned` set (telemetry/auth/entitlements/
    connectors + middleware + the remote storage backend + typed storage payloads). Status is read off
    the code, never off consumer count — see the 2026-08-03 framing rule.
- **Context, now grounded in a real consumer:** `sail-one/src/state/sail-host.ts` is the worked
  example of `SailPlatform` composition; `sail-one/src/state/client-state.ts` is the worked example of
  `SailPlatformClient` persistence (`sail_one_` prefix); `sail-finance/src/main.tsx:110` remains the
  `createSailBrowserDesktopAgent` reference. `.cursor/plans/sail-platform-extensibility.md` previously
  landed on "build nothing yet, fix defects" — still holds for the services tier.
- **Acceptance:** the two-entry-point diagram and the boot sequence diagram exist and are agreed; the
  when-to-use-which rule is written; the middleware question has a named answer; the `planned` gap is
  recorded. Only then does prose reach `website/docs/`.
- **Verify:** maintainer confirms the two-entry-point description matches `sail-one` and `sail-finance`
  source. No build step.
- **Likely files:** new `.cursor/plans/sail-platform-design.md` (now a description, not a green-field
  design), then `website/docs/architecture/overview.md`

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

### 2b. The front door — newcomer narrative and one "how to consume" decision

- **Why it exists (added 2026-07-31):** the largest audience is newcomers/evaluators (Intent audience 1),
  and no slice owned their path. This slice does. It is placed right after the spine (Slice 2) because its
  "composite parts" section **links** the spine diagram rather than inventing its own — per Documentation
  homes, architecture has one home.
- **Goal:** reshape `intro.md` into the newcomer funnel and add a single **How to consume Sail** decision
  page. No new architectural claims — it links the spine (Slice 2) and the package pages (Slice 3).
- **The funnel (progressive disclosure, in this order):**
  1. **What FDC3 is** — kept short, with a link out to the FINOS spec (`intro.md` already does this well;
     preserve it).
  2. **What Sail is** — a standards-compliant FDC3 **Desktop Agent**. Frame it as what Sail *does*, not
     "production-ready" (this also resolves register C5, the `README` ↔ `intro.md` contradiction).
  3. **What it grows into** — an **interoperability platform** (the `sail-platform` layer + shells).
  4. **Composite parts** — one architecture diagram, **linked from the spine**, not restated.
  5. **How to consume it** — hand off to the decision page below.
- **The "How to consume Sail" decision page — three paths, honestly marked:**
  1. **Compose the pieces yourself** — the two-entry-point model (`createSailBrowserDesktopAgent` vs
     `SailPlatform`); links to Slice 4's entry-point pages and getting-started.
  2. **Serve an example shell** — deploy `sail-finance` (finance-specific) or `sail-one` (domain-neutral);
     links to their Slice 3 package pages, framed as a **domain** choice between two example UIs, not a
     maturity one.
  3. **Use a hosted version** — intended, **`planned`, no address yet.** State this and stop; do not imply
     it is available.
- **Acceptance:** `intro.md` reads as the five-step funnel; a cold reader reaches a path decision without
  first knowing which package they want (Success criterion 3). The "how to consume" page presents all three
  paths with the hosted one marked `planned`. No architecture diagram is duplicated — the parts section
  links the spine. `intro.md:65`'s "production-ready product" claim is reconciled with the `README`.
- **Verify:** `npm run docs:build`; the manual cold-start read-through from the Test Plan is run against
  *this* slice specifically (it is the audience-1 surface). `grep` shows no second copy of the layer diagram.
- **Likely files:** `website/docs/intro.md`, a new "how to consume" page (or a section of `run-sail.md`),
  `website/sidebars.ts`.

### 3. Package pages reconciled to the spine

- **Framing rule (2026-08-03) governs this slice.** Every package page is written **standalone**: what the
  package is, what it does, why it needs to be what it is, how to use it. No page justifies a package by
  naming its consumers, and no API is marked down for lacking one. Where a worked example helps, put it in
  an appendix section clearly labelled as a reference implementation.
  `.cursor/plans/sail-platform-design.md` is the model to follow for `packages/platform/overview.md`.
- **Goal:** each package page describes what that package actually owns and links to the spine for
  layering. Rewrite `packages/sail-finance/overview.md` (every substantive claim is currently wrong)
  and `packages/platform/overview.md` (blocked on slice 0). Patch `composition.md` and
  `integrator-guide.md` — but **do not excise the `SailPlatform` sections wholesale as originally
  planned**: `SailPlatform` is a real, documentable path. Instead rewrite those sections to describe the
  supported call sequence (construct → `start()` → `apps.open` → `intentResolver` → `changeAppChannel`),
  and correct the manual `new DesktopAgent()` composition path (still `@internal` — see register §B).
- **Carry the source defects from the design doc's §3:** the `SailPlatform` JSDoc example
  (`sail-platform.ts:178,189`) shows `await platform.start()` / `await platform.stop()` when both are
  `void`, and `platform.config.get()` when the property is `sailConfig`. Docs must not copy it; fixing the
  JSDoc itself is a product change, so log it rather than doing it in this docs delivery.
- **New: add `packages/sail-one/overview.md`.** `sail-one` had no doc page because it did not exist
  when this plan was drafted. It now does, and it is the reference consumer for `SailPlatform`. The
  page names: its `SailPlatform` construction (`src/state/sail-host.ts`), its `SailPlatformClient`
  persistence (`src/state/client-state.ts`, `sail_one_` prefix), its role as the **domain-neutral example
  UI** (vs `sail-finance`'s finance-specific one) with tab-and-grid canvas as a secondary layout detail,
  and its interim gaps marked `planned` — restart-on-structural-edit,
  `embeddable-ui/` unwired. Reuse `packages/sail-one/README.md`, which is already accurate.
- **Acceptance:** no page re-describes the layering. `sail-finance`'s page names its real
  construction path (`createSailBrowserDesktopAgent`), its real persistence (Zustand + `localStorage`),
  and its real host-contract implementations. `sail-one`'s page names *its* different construction
  path (`SailPlatform`) and persistence (`SailPlatformClient`), so the two-entry-point model from
  slice 0 is visible where a reader chooses between shells. Both pages appear in `website/sidebars.ts`.
- **Verify:** docs build; snippets compile (see Test Plan).
- **Likely files:** `website/docs/packages/**` (incl. new `packages/sail-one/overview.md`),
  `website/sidebars.ts`

### 4. Document the load-bearing pieces that appear nowhere

- **Goal:** the parts a new reader most needs and cannot currently find. One short page or section
  each, no speculation.
- **Scope:** the **two** production entry points — `createSailBrowserDesktopAgent` (`sail-finance`) and
  `SailPlatform` (`sail-one`) — not one; `SailAppLauncher` and its `onLaunchApp`/`onCloseApp` contract
  (the real host seam, used by **both** shells — every current page teaches the raw `AppLauncher`
  interface instead); `SailPlatformClient` config-backed persistence (`sail-one` uses it; `sail-finance`
  does not — this is the concrete difference between the two persistence stories); the WCP4 origin
  allowlist **including that
  it currently fails open and ships unwired** (`FDC3-SAIL-REVIEW.md` Security #2 — document the gap,
  don't fix it here); the dockview panel/popout-relay shell and the Zustand store family;
  `@finos/sail-theme`; `toolbox-local` / `VITE_CONFORMANCE_TOOLBOX`.
- **Acceptance:** each item has a home and is reachable from the sidebar. Security gaps are stated,
  not glossed.
- **Verify:** every new page appears in `website/sidebars.ts` (the conformance-harness page is
  currently orphaned — fix that here). Docs build green.
- **Likely files:** `website/docs/architecture/`, `website/docs/packages/`, `website/sidebars.ts`

### 4b. Consolidate contributor / build / governance docs onto the site

- **Why (added 2026-07-31):** the Documentation-homes decision makes the site the single home for *all*
  docs, including building and contributing. This slice moves that content home and reduces the repo files
  to stubs. Independent of the consumer-facing slices; can land late.
- **Goal:** `development.md` is the canonical build-and-contribute home; a Contributing/governance page
  exists on the site; the repo convention files become thin pointers.
- **Scope:**
  - Fold the accurate build/contribute guidance from the root `README` and `AGENTS.md` into `development.md`
    (add a `contributing.md` if `development.md` grows too long). Do not duplicate architecture — link the
    spine (Slice 2).
  - Reduce root `README.md` to a pitch + links; point `CONTRIBUTING.md` at the site; keep
    `CODE_OF_CONDUCT`/`SECURITY`/`LICENSE` as the short canonical files, linked from the site.
  - `AGENTS.md`'s existence is an **open maintainer decision** — it may not survive. Either way its
    build/contribute content moves to the site. *If kept*, leave it as the one real in-tree operational doc
    (reader is an agent offline from the site) that links the spine rather than restating it; *if dropped*,
    nothing else in this slice depends on it.
- **Acceptance:** no build/contribute fact lives in two places; the repo stubs link to the site; the site's
  Development/Contributing page is reachable from the sidebar.
- **Verify:** `npm run docs:build`; `grep` shows build/contribute prose isn't duplicated between `README`/
  `AGENTS.md` and the site.
- **Likely files:** `website/docs/development.md` (+ optional `contributing.md`), `README.md`,
  `CONTRIBUTING.md`, `AGENTS.md`, `website/sidebars.ts`.

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
  rewrites), slice 2 (the spine — everything else links to it), and slice 2b (the front door — the
  primary-audience surface, where a cold read is the only check that catches "compelling but false").
  For slices 1 and 5 the mechanical checks are the review.
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
- **The front-door funnel can become a brochure (new 2026-07-31).** The newcomer narrative (Slice 2b) is
  the one place tempted to sell rather than state. It obeys the **same** marker convention as everything
  else: "what Sail is" describes what exists; "interoperability platform" and "hosted version" carry
  `planned` where they are aspiration. The failure mode is a compelling front page that a first `docs:build`
  or a returning maintainer discovers is half-fiction — the exact defect this whole plan exists to kill.
- **Middleware is no longer a risk (closed 2026-07-31).** Previously "the one genuinely open mechanism
  question." It is decided — the observability seam, `planned` — so it is now a documentation task with a
  reference design (`.cursor/plans/agent-observability-seam.md`), not a decision that can go wrong here.
- **The two-entry-point model is the new sharp edge (2026-07-31).** With `sail-one` landed, the docs
  must describe `createSailBrowserDesktopAgent` *and* `SailPlatform` and, harder, **when to use which**
  without making one look second-class. The failure mode is a reader who copies `sail-finance`'s
  `createSailBrowserDesktopAgent` path when they wanted `sail-one`'s `SailPlatformClient` persistence,
  or vice versa. Mitigation: slice 0 produces the decision rule *before* any package page is written,
  and the spine page (slice 2) presents both paths from one diagram rather than each package page
  inventing its own framing.
- **The `planned` surface is still large, though smaller than when this plan was drafted.** The
  composition spine (`SailPlatform` construct/launch/resolve/persist) moved from `planned` to
  `implemented` when `sail-one` landed. But four of `sail-platform`'s seven stated capabilities —
  telemetry, auth, entitlements, connectors — still do not exist in any form, and the middleware
  pipeline stays collected-but-unwired (neither shell uses it). That is still a lot of aspiration on a
  site whose stated job is helping people *use* the packages. Two mitigations, both cheap:
  **(a)** never let a `planned` capability appear in a getting-started or install path — aspiration
  lives in architecture and roadmap pages, never in a quickstart;
  **(b)** if a page is more `planned` than `implemented`, say so at the top rather than per-claim, so
  a reader can leave immediately. Note the existing docs failed exactly here: `platform/overview.md`
  reads as a shipped API and cost this review a full audit to disprove.
- **Slice 0 is a genuine product decision, not a docs task.** It may need more than one conversation.
  Slice 1 is deliberately independent so work isn't blocked meanwhile.
- **Collision with in-flight remediation — largely resolved.** Verified in source 2026-07-30: slices
  **7, 8, 10 and 11 have landed** (logger threaded into `MessagePortTransport` and the directory
  functions; `directoriesLoaded` present; `HANDLER_MAP` hoisted and the channel-change timeout is now
  an option; all six dead-code symbols gone, including `intentResolverUI` and
  `BrowserIntentResolverController`). The public surface slice 3 documents is therefore settled.
  Slice 9 / finding #14 is **closed by decision** — there will never be more than one Desktop Agent
  per browsing context, so the module-scoped timer registries are correct and the tests were changed
  instead. #12 not re-verified. Nothing outstanding affects the documented API surface, so docs work
  is unblocked.
  **Note:** the checkpoint list in that plan file was stale at the time of this check — verify against
  source, not checkboxes.

- **A load-bearing invariant is currently unwritten: one Desktop Agent per browsing context.** It is
  what makes the module-scoped registries correct, and it shapes what a host may legitimately do.
  Slice 2 must state it explicitly as an architectural constraint —
  `packages/desktop-agent/integrator-guide.md` already has a "One Desktop Agent per context" section
  to build on. This is a good example of the general problem: the constraint is real and enforced in
  practice, but a reader cannot currently discover it.
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

- [x] 0 — Layering + middleware/observability decision recorded (`063553212`, reframed standalone `457a0896c`)
- [x] 1 — Truth pass (done 2026-07-31, committed `ffdd94f5b`; sonnet writer + orchestrator spot-review, `docs:build` green)
- [x] 2 — Spine page + status marker convention (`bf71283d1`; build gate still owed — see Verification Notes)
- [x] 2b — Front door: newcomer funnel + "how to consume" (`d01a3d31a`; framing corrected `9897b48ac`)
- [x] 3 — Package pages reconciled (`d86f26642`; build gate still owed)
- [x] 4 — Undocumented load-bearing pieces (`7e6f38993`)
- [x] 4b — Contributor/build/governance docs consolidated onto the site (`7e6f38993`; README done independently in `b11126123`)
- [x] 5 — Generated conformance inventory (`7e6f38993`)
- [ ] 6 — Snippet + link guardrails in CI **— last remaining slice**

## Verification Notes

- **Slice 1 (2026-07-31):** truth pass executed across `README.md` + 11 `website/docs` pages (44 ins /
  85 del — deletion-heavy, as intended). `npm run docs:build` green with `onBrokenLinks: "throw"`, so links
  resolve. Removed strings grep-clean. Orchestrator spot-verified: `start(): void` @ `sail-platform.ts:222`;
  `validateDACPMessage`/`safeParseDACPMessage` absent from `packages/`; package-page diffs minimal (no
  slice-3 rewrite); `intro.md` corrected without narrative reshaping. Deferred (correctly) to slice 2:
  A5/A6/A7 three-layer framing, A12 SailPlatform-as-the-answer. **Open for slice 2:** add a `planned`/
  superseded caveat to `platform/overview.md`'s `MiddlewarePipeline` bullet. Committed as `ffdd94f5b`.

- **Slice 0 (2026-08-03):** `.cursor/plans/sail-platform-design.md` drafted (`063553212`), then rewritten
  as a **standalone package description** on maintainer direction (`457a0896c`) — see the framing rule in
  this plan's header. Two substantive corrections came out of that rewrite: `workspaces`/`layouts`/
  `sailConfig` flip `planned` → `implemented` (they delegate to a working `LocalStorageBackend`), and the
  async-storage-before-construct ordering is stated as a package contract rather than a shell anecdote.
  **Still unconfirmed (non-blocking, design doc §9):** the scope-boundary charter, the ordering rule as
  intent-not-accident, the ownership-framed decision rule, and observability-as-the-middleware-answer.
  Slice 2 built on these without contradiction, but they have not been explicitly signed off.

- **Slice 2 (2026-08-03, `bf71283d1`):** `architecture/overview.md` rewritten as the spine (213 ins /
  60 del across 2 files); `deployment-targets.md` ASCII layer diagram replaced by a link, native-shell
  content untouched. Status-marker convention established on the page. Orchestrator verified against
  source, not taken on the writer's word: `MiddlewarePipeline` collected-but-unwired
  (`sail-browser-desktop-agent.ts:81-88`); **both** entry points disable injected resolver/selector UI
  (`:64-65`, `sail-platform.ts:239-241`); `SailAppLauncher` generates instance ids
  (`sail-app-launcher.ts:60`); boundary rules as stated (`.oxlintrc.json:8-54`). Layer language grep-clean
  to one file. All link targets, anchors, and heading slugs verified (slugs computed with the site's own
  `github-slugger`).
  **Two defects fixed in review:** a link to `.cursor/plans/` on GitHub `main` that would 404 for every
  reader (the path is not on `main`, and `onBrokenLinks: "throw"` does not check external links); and an
  internal-note tone left in `deployment-targets.md`.
  Also closed slice 1's deferred item: `platform/overview.md`'s `MiddlewarePipeline` bullet now marked
  superseded, and the page's lede no longer advertises "middleware".
  **⚠️ Owed: `npm run docs:build` has NOT completed successfully in this environment.** Four attempts were
  killed past the 10-minute mark; the cause was orphaned `docusaurus build` processes from earlier killed
  runs competing over the same output dir (since cleaned up). MDX hazards were hand-scanned instead
  (JSX-like tags and braces all inside mermaid fences; fence counts balanced). **Run the build before
  trusting slice 2 as fully verified** — it is the only check covering MDX/mermaid parse errors, and this
  slice added two mermaid blocks.

- **Slice 2b (2026-08-03, `d01a3d31a`):** `intro.md` reshaped into the five-step funnel; new
  `how-to-consume.md` with three paths (hosted marked `planned`, no address invented); stale
  finance-only routing flowchart fixed. Orchestrator caught five fabrications before commit: a `./intro`
  link that would break (`intro.md` sets `slug: /`, so extensionless links resolve to a non-existent
  `/intro`); an invented "FINOS-run" attribution for the hosted version; an embellished `sail-one`
  description; an unverified `sail-one` deployment recipe; and a `README#status` anchor that is wrong on
  `origin/main` (heading there is "Status / Disclaimer").

- **Shell framing corrected (2026-08-03, `9897b48ac`):** maintainer direction — `sail-finance` and
  `sail-one` are two **example UIs**, split by **domain** (finance-specific vs domain-neutral), not by UX
  model or maturity. The canvas/dashboard framing was demoted to a secondary detail and "the reference
  host" removed. Note the blueprint had already recorded `sail-one` as "domain-neutral"; the miss was not
  pairing it with `sail-finance` being finance-specific.

- **Slice 3 (2026-08-03, `d86f26642`):** `platform/overview.md` and `sail-finance/overview.md` rewritten,
  new `packages/sail-one/overview.md` (+ `_category_.json`, sidebar entry), surgical patches to
  `composition.md`/`integrator-guide.md`. 428 ins / 95 del.
  **Real bug fixed:** the old platform page told readers to call `desktopAgent.start()` after
  `createSailBrowserDesktopAgent(...)`, but the agent auto-starts unless `autoStart: false`
  (`sail-desktop-agent.ts:280`), so that throws `"DesktopAgent is already started"`
  (`desktop-agent.ts:218`). The documented example crashed on its second line.
  **Verification:** all 94 relative links and every internal anchor across all 17 doc pages checked
  programmatically against target headings using the site's own `github-slugger` — not by eye.
  **Care taken:** `sail-finance` citations avoid `main.tsx` line numbers and the `appDirectories`
  parameter, which are mid-change in an uncommitted working tree (maintainer's own WIP, left untouched).
  **Noted, not fixed (out of slice):** `architecture/channel-selection.md` shows
  `platform.start({ onChannelChanged: ... })` — config goes to the constructor, not `start()`. Assign it.

- **Slices 4 / 4b / 5 (2026-08-03, `7e6f38993`):** run as three parallel sonnet writers partitioned by
  file ownership, with `sidebars.ts` reserved to the orchestrator so they could not collide. 790 ins /
  52 del across 16 files.
  - **4:** new `architecture/security.md` (WCP4 allowlist — documented as **failing open** when
    `allowedOrigins` is unset, set by neither shell, and absent from `SailPlatform` entirely),
    `packages/sail-theme/overview.md`, `packages/sail-finance/panel-architecture.md` (Dockview model +
    popout relay). `SailAppLauncher` promoted as the host seam.
  - **4b:** `development.md`, `CONTRIBUTING.md`, `.github/CODE_OF_CONDUCT.md` (D-8 stale name).
  - **5:** generator at `website/scripts/generate-conformance-inventory.mjs`, `--check` wired into both
    `validate` scripts so the inventory cannot drift.
  - **Counts independently re-verified by the orchestrator, not taken on the writer's word:** 154
    scenarios / 17 feature files; 11 files tagged `@fdc3_2.2`; 116 scenario-level `@fdc3_2.0`; no
    `Scenario Outline`. The old page claimed 103 across 12 files and cited three non-existent features.
  - **Verification:** all 111 links + 44 anchors across 20 pages resolve (programmatic, `github-slugger`);
    generator `--check` run for real; fences and MDX hazards clean on every new page.

- **Mid-delivery collision (2026-08-03):** a parallel session merged `b11126123` into `wip/v3-local`
  while these writers were running. It committed the maintainer's `sail-finance` WIP, added
  `MAINTAINERS.md` and `.cursor/plans/draft-pr-readiness.md`, and **independently rewrote `README.md`
  into a site-linking stub — the same goal as slice 4b**, overwriting 4b's version. Duplicated effort,
  not lost work. Two lessons recorded: (1) `sail-finance/src/main.tsx` shifted by one line, invalidating
  every `main.tsx:NN` citation — those are now dropped repo-wide rather than re-pinned; (2) that merge's
  own plan opens with a **`BLOCKER`: the branch is ~9 months stale, 22 upstream commits missing.** That
  is outside this docs delivery but sits above it in priority.

## Review Notes

- Required: _(none yet)_
- Follow-up: _(none yet)_
- Ignore for MVP: _(none yet)_

## Parked Follow-ups

- ~~Full `README.md` rewrite beyond the validation section.~~ **Reframed 2026-07-31:** the README becomes a
  thin stub linking to the site (Slice 4b), so there is no expansive rewrite to park — the site holds the
  content.
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
