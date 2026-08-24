# AGENTS.md

FDC3 Sail v3 — an npm workspaces monorepo implementing the FDC3 financial desktop
interoperability standard in the browser.

This file holds what you **cannot** work out by reading the repo: boundaries, decided
architecture, and traps that cost real time. Commands, scripts, versions and the package
layout are in `package.json` and the config files, which cannot go stale — read them there.

Deeper, area-specific rules live in nested files that load when you work in that tree:

- `packages/sail-desktop-agent/AGENTS.md` — FDC3 engine architecture, test conventions, WCP/DACP traps
- `packages/sail-conformance-harness/AGENTS.md` — FINOS toolbox host, conformance triage

## Package boundaries

These are decided. Changing one is a design conversation, not an implementation detail.

- **`@finos/sail-desktop-agent` is headless and pure FDC3.** FDC3 host contracts
  (`AppLauncher`, `IntentResolver`, `ChannelControl`, app directory, lifecycle events,
  host-id resolution) belong in it. FINOS toolbox orchestration and Sail product chrome
  stay out of its `src/`.
- **`@finos/sail-platform` is a peer, not a layer.** Workspaces, layouts and storage,
  zero dependencies, no FDC3 in it. A host composes the two packages directly.
- **A pure Desktop Agent adopter must not need `sail-platform`** to run the engine.
- **There is no top-level wrapper.** The 2026-08-04 cull deleted `SailPlatform`,
  `createSailBrowserDesktopAgent`, `SailAppLauncher` and `SailPlatformClient` because
  they only re-narrated the agent's own surface. Keep it that way — no meta-package,
  no `Sail` / `FDC3Sail` facade class.
- **Sail-specific policy** (origin allowlists, entitlements, telemetry) belongs in
  `sail-platform`, never in the core library.

## FDC3 fidelity

- Align with FDC3 2.2 spec behaviour. Prefer `@finos/fdc3` exports — `ResolveError`,
  `OpenError`, `ChannelError`, `BrowserTypes` — over hand-rolled duplicates. Sail may
  still own local `Error` subclasses and wire-only codes the npm package doesn't ship.
- Prepare 3.0 incrementally on **one** DACP handler tree: optional wire fields plus
  `@fdc3_3.0` BDD. Keep a single handler tree rather than `handlers/v2` and `handlers/v3`.
- npm semver (`3.0.0-pre.x`) is independent of `getInfo().fdc3Version` (`"2.2"` until 3.0
  conformance is intentionally green).
- **Check the spec before "fixing a security hole."** Private channels are granted by
  creation or by intent result — grant the creator on `createPrivateChannel`, and grant
  the intent raiser when an intent result returns that channel. The recipient's normal
  next step after `getResult()` is `addContextListener`, so the grant must already be
  recorded. Knowing a channel id alone must never auto-join, and
  `getOrCreateChannel(privateId)` on an ungranted party is `AccessDenied`. Blanket-denying
  first listen for an already-granted party breaks the FDC3 intent-result flow.
- **When the FDC3 API reference and the conformance oracle disagree** without a clear
  normative rule, stop and seek FINOS clarification rather than changing agent behaviour.

## Configuration

- Product defaults live in `packages/sail-desktop-agent/src/agent/default-config.ts`.
- **A config value is defaulted exactly once, at the boundary where user input enters.**
  Every type downstream of that boundary declares the value as required. This is a rule
  about where defaulting happens, not a ban on `??` — a `??` on a genuinely optional field
  is correct, and `const { x = "default" } = params` is the same defect with no `??` in it.
- `noUncheckedIndexedAccess` and `typescript/no-unnecessary-condition` are on repo-wide,
  so a second default on an already-required field is a lint error, not a review comment.
- Construction does not start the agent. `.start()` is explicit, and calling it twice throws.
- Defaults are data: override through typed constructor options, read back through getters.
  `DEFAULT_FDC3_USER_CHANNELS` is the one deliberate export, so hosts can extend the
  standard set rather than redeclare it.

## Traps

Each of these has cost real time. None of them is discoverable from config.

- **`import ... with { type: "json" }` breaks module parsing.** The TypeScript parser
  treats `with` as a legacy statement, cascading into false module-not-found errors and
  `error`-typed imports. Use `import pkg from "../../package.json"` with
  `resolveJsonModule`, or `readFileSync(new URL(..., import.meta.url))` in tests.

- **`npm run lint` is oxlint + `oxlint-tsgolint`, not ESLint and not `tsc`.** A clean
  typecheck is not evidence that lint passes: type-aware rules like `await-thenable` and
  `require-await` fire on code `tsc` accepts. Run `npm run lint` alongside
  `npm run typecheck` in every verification step — never just one of them.
  Always go through the npm scripts: the `vp` binary is a local devDependency, and
  `npx vp` resolves to an unrelated package on the public registry.

- **Git hooks are a Vite+ feature, and they break across worktrees.** `.git/config` is
  shared by every worktree, but `.vite-hooks/` is untracked and generated per directory,
  and `vp config` skips the whole hook install when `core.hooksPath` is already set. The
  first checkout wins; every later worktree points at a directory it doesn't have, and git
  treats a missing `hooksPath` as *no hooks, silently, with no error*. After
  `git worktree add`, run `npx vp config` from the new worktree root and verify with
  `git config --get core.hooksPath` and `ls .vite-hooks/_`. If a commit reports
  `lint-staged could not find any staged files matching configured tasks` on a change that
  should match, suspect a dead hooks directory before you suspect the globs.

- **Keep root `vite` and `vite-plus` on the same version.** Skew crashes Vitest with an
  unknown `builtin:vite-wasm-fallback` against Rolldown.

- **Vitest does not build workspace packages.** `@finos/sail-*` `exports` point at `dist/`;
  prefer dist resolution over source aliases.

## Resolving a `typescript/no-unnecessary-condition` finding

Never autofix it, and never delete a guard because the tool called it redundant. Across
this rollout the suggested fixes were confidently wrong **21 times**, with the test suite
green either way. Classify first:

| | Case | Action |
|---|---|---|
| **A** | Ceremony — the value really is non-optional | Fix the call site (`!`, destructure, narrow) |
| **B** | The tool is wrong | Suppress, never delete |
| **C** | Genuinely dead | Delete |
| **D** | A real bug the flag exposed | Fix it, and add a test that fails without the fix |

Bucket B is not only about trust boundaries (unvalidated wire data, persisted state,
third-party return types). It equally covers *the compiler cannot model this mutation*.

Suppress with a single line carrying
`oxlint-disable-next-line typescript/no-unnecessary-condition -- <the concrete reason>`,
placed immediately above the flagged sub-line — the directive covers the literal next line
only. Where the diagnostic's span crosses lines, `-next-line` cannot suppress it and the
trailing same-line `oxlint-disable-line` is the only form that works;
`packages/sail-finance/src/components/layout-grid/Layout.tsx:82` is the sole instance.
Test files are exempt by an override in root `vite.config.ts` — leave that alone, and
don't silence a finding by widening `ignorePatterns`.

## Documentation

- **`website/docs/` (Docusaurus) is canonical** for all package documentation. Package
  `README.md` files are brief summaries linking to
  `https://finos.github.io/FDC3-Sail/docs/...`. Edit `website/docs/packages/` only.
- When migrating docs off a package, delete the old file. Documentation needs no backward
  compatibility, so "Moved" redirect stubs are not wanted.
- `website/docs/architecture/` is cross-package system maps only; package APIs live under
  `website/docs/packages/`.
- **Documentation gets no executable tests.** No Vitest or Cucumber that reads `.md` or
  Docusaurus docs as a contract. `npm test` covers FDC3 behaviour and library code.

## Working agreements

- **No backward-compatibility shims** on v3 refactor work unless explicitly asked. Delete
  legacy classes, `@deprecated` re-exports and migration facades outright.
- **Name things for what they are.** Prefer direct imports from owning modules over
  internal barrels. Don't publicly export types that only have internal consumers.
  Colocate single-use helpers with their only consumer.
- **Comments explain behaviour for future readers.** Plan slice labels, finding numbers
  and agent-to-human decision notes don't belong in code — plans are ephemeral.
- **Intentional RED stays red.** Fix the fixture or the implementation, or tag `@failing`
  until the work lands. Relaxing an assertion to get green is not a fix.
- **Before any review gate**, format, lint, typecheck and `npm run validate` must pass.
- **Ship one slice at a time** and pause for review before the next.
- **Commit messages carry no AI-tool attribution** — no `Co-authored-by` for an agent, no
  "Generated by" trailers, unless explicitly asked.

## Release

Changesets on `main`. Maintainers add ephemeral `.changeset/*.md`; `release.yml` opens a
Version Packages PR, and merging it runs `release:publish`. Contributors do not add
changesets. Desktop Agent is in Changesets pre mode (`3.0.0-pre.x`) — `changeset pre exit`
comes before stable `3.0.0`. Release infrastructure changes land on `main`, separately
from v3 feature work.
