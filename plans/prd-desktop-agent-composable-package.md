# PRD: Composable Desktop Agent package

## Persona / user

- **Platform builders** who want to consume `@finos/sail-desktop-agent` directly to build a custom FDC3 Desktop Agent with their own host shell, transport topology, app launch behavior, channel chrome, and intent resolver UI.
- **Sail product engineers** who want `@finos/sail-platform-api` to wrap the lower-level Desktop Agent package for Sail-specific layout, workspace, storage, and configuration features.
- **Agent implementers** delivering Watson work items who need an explicit source tree, package boundary, and import target rather than inferring architecture from current folders.

## Goal / outcome

Refactor and document `@finos/sail-desktop-agent` as the primary platform-builder package with both manual composition primitives and ready-made presets, allowing breaking export and folder changes so the package surface is clear.

## Relationship to other plans

| Existing plan / artifact | Current status | This PRD action |
|---|---|---|
| `plans/prd-transport-platform-hardening.md` | Existing transport/platform hardening PRD | Extend concepts around typed platform APIs; do not duplicate transport bug fixes already planned or completed. |
| `plans/prd-desktop-agent-conformance-gaps.md` | Existing conformance gap PRD | Defer conformance behavior gaps unless import/API changes affect the harness. |
| `plans/prd-desktop-agent-release-p2.md` | Existing release planning artifact | No duplicate; this PRD narrows to package architecture and consumer API. |
| `packages/sail-desktop-agent/README.md` | Brief summary linking to Docusaurus | **done** — points to `website/docs/packages/desktop-agent/`. |
| `.cursor/skills/consume-sail-desktop-agent/SKILL.md` | Stale facade/session examples vs website integrator guide | **done** — aligned to integrator guide. |

## In scope

1. **PKG-01 Package architecture docs**: define `core`, `host-contracts`, `protocols`, `transports`, `connectors`, and `presets`; document manual composition vs presets.
2. **PKG-02 Host contracts**: promote app launch, intent resolver, and host channel-control contracts into `@finos/sail-desktop-agent` as UI-free FDC3 host integration points.
3. **PKG-03 Browser preset API**: support `createBrowserDesktopAgent({ appLauncher, intentResolver, apps, userChannels })` from the top-level package export.
4. **PKG-04 Runtime folder reorganization**: move WCP/DACP/protocol/runtime files into the new source tree and update imports/tests.
5. **PKG-05 Sail platform wrapper alignment**: make `@finos/sail-platform-api` wrap the new desktop-agent API for Sail product shell features.
6. **PKG-06 Conformance harness update**: update `@finos/sail-conformance-harness` to consume the new top-level preset and host contracts.
7. **PKG-07 Consumer skill update**: update `.cursor/skills/consume-sail-desktop-agent/SKILL.md` to teach the new top-level package surface.

## Out of scope

- Preserving backwards compatibility for `@finos/sail-desktop-agent/browser` or `@finos/sail-desktop-agent/transports` imports.
- Implementing a new Sail `LayoutManager` or workspace storage redesign.
- Changing FDC3 2.2 protocol semantics, conformance assertions, or App Directory schema behavior.
- Moving Sail-specific layout, workspace, storage, or configuration features into `@finos/sail-desktop-agent`.
- Writing production code or executable tests during this planning phase.

## Success criteria

- Consumers can import the intended public API from `@finos/sail-desktop-agent` top level.
- Consumers can choose between documented **manual composition** and **preset** modes.
- The browser preset accepts `appLauncher`, `intentResolver`, `apps`, and `userChannels`.
- Internal folders communicate responsibility: FDC3 core, host contracts, protocols, transports, connectors, and presets are not blurred by a generic `browser` implementation folder.
- `@finos/sail-platform-api` wraps the desktop-agent package rather than duplicating core WCP/DesktopAgent wiring, while retaining Sail-only product shell features.
- The conformance harness and consume skill both use the new package surface.

## BDD scenarios

```text
Given a platform builder wants full control over their Desktop Agent host
When they read the package docs
Then they can identify the core agent, host contracts, transports, connectors, and protocols required for manual composition

Given a platform builder wants a ready-made browser Desktop Agent
When they call createBrowserDesktopAgent with appLauncher, intentResolver, apps, and userChannels
Then the preset wires the Desktop Agent, browser connector, WCP flow, App Directory, and intent resolution without requiring manual transport setup

Given a Sail product engineer needs layout, workspace, storage, or configuration features
When they inspect package responsibilities
Then those concerns are routed to @finos/sail-platform-api rather than @finos/sail-desktop-agent

Given the conformance harness imports Sail desktop-agent APIs
When the top-level package API changes
Then the harness uses the new preset and host contracts without changing conformance behavior

Given an agent uses the consume-sail-desktop-agent skill
When it explains package usage
Then it teaches the new top-level exports, manual composition path, and browser preset path
```

## Architecture / implementation direction

The target source tree is:

```text
packages/sail-desktop-agent/src/
  core/
  host-contracts/
  protocols/
    dacp/
    wcp/
  transports/
  connectors/
    browser/
  presets/
    browser-desktop-agent.ts
  index.ts
```

`@finos/sail-desktop-agent` should expose both supported consumption modes:

- **Manual composition**: consumers wire `DesktopAgent`, host contracts, transports, connectors, App Directory data, channel configuration, and resolver behavior themselves.
- **Presets**: consumers call `createBrowserDesktopAgent(...)` and receive a `DesktopAgent` with the browser edge coupled to `start()` / `stop()`. Advanced edge access uses `getBrowserDesktopAgentSession` from `/browser`.

The desired browser preset example is:

```typescript
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent"

const desktopAgent = createBrowserDesktopAgent({
  appLauncher,
  intentResolver,
  apps,
  userChannels,
})
```

`@finos/sail-platform-api` may wrap this package to add Sail-specific layout manager, workspace, storage, configuration, and product shell APIs. It should not own core FDC3 host contracts that a non-Sail platform builder also needs.

## Risks / unknowns

- The exact naming of the browser connector result (`browserConnector`, `wcpConnector`, or both) may need final API review during delivery.
- File moves may create noisy imports and test updates; work items should keep behavior changes separate from path-only changes where practical.
- Some docs and local skills currently teach `/browser` and `/transports`; those must be updated after top-level exports land.
- The existing intent resolver flow has both direct `WCPConnector` event usage and `SailPlatform.intentResolver` wrapping; delivery must avoid introducing a third parallel pattern.

## Constraints

- Node.js `>=24` and npm `>=11`; use repo commands from `AGENTS.md`.
- FDC3 2.2 behavior remains authoritative for app-facing Desktop Agent semantics.
- Backward compatibility with current package subpath exports is not required.
- Planning artifacts are versioned in git for this repo (`plans.version_in_git: true`), but delivery automation is `stage_only`.

## Commands

- Focus package typecheck: `npm run typecheck -w @finos/sail-desktop-agent`
- Focus package tests: `npm test -w @finos/sail-desktop-agent`
- Platform wrapper typecheck/tests when touched: `npm run typecheck -w @finos/sail-platform-api` and relevant Vitest tests
- Conformance harness typecheck/build when touched: workspace package commands as defined in `package.json`

## Suggested vertical slices

| ID | Slice | Kind | Work item slug |
|---|---|---|---|
| PKG-01 | Define package architecture docs | task | `define-desktop-agent-package-architecture` |
| PKG-02 | Promote host contracts into desktop-agent | task | `promote-desktop-agent-host-contracts` |
| PKG-03 | Add top-level browser preset API | task | `add-top-level-browser-desktop-agent-preset` |
| PKG-04 | Reorganize protocols, transports, and browser connector folders | task | `reorganize-desktop-agent-runtime-folders` |
| PKG-05 | Align sail-platform-api wrapper with new desktop-agent API | task | `align-sail-platform-wrapper-with-desktop-agent-preset` |
| PKG-06 | Update conformance harness for desktop-agent top-level API | task | `update-conformance-harness-desktop-agent-api` |
| PKG-07 | Update consume-sail-desktop-agent skill | task | `update-consume-sail-desktop-agent-skill` |
| PKG-08 | Browser edge + DA integrator guide | — | **Cancelled** — superseded by `website/docs/packages/desktop-agent/integrator-guide.md` |
| PKG-09 | Facade API: return `DesktopAgent`, session registry, coupled lifecycle | task | `simplify-browser-desktop-agent-facade-api` |
| PKG-10 | README / JSDoc examples for facade API | chore | `align-package-readme-browser-facade-examples` |
| PKG-11 | Platform + harness facade consumer reconciliation | task | `reconcile-downstream-browser-facade-consumers` |

## PRD accuracy gate (2026-06-10 / v3-pre)

| ID | Classification | Status | Work item slug |
|---|---|---|---|
| PKG-01 | task | **done** — Docusaurus package docs; no Vitest coverage of markdown/website docs. | `define-desktop-agent-package-architecture` |
| PKG-02 | task | **done** — `host-contracts/` promoted; top-level export. | `promote-desktop-agent-host-contracts` |
| PKG-03 | task | **done** — preset accepts `apps`, `intentResolver`, `userChannels`; exported top-level and `/presets`. | `add-top-level-browser-desktop-agent-preset` |
| PKG-04 | chore | **done** — `protocols/`, `connectors/browser/`, `presets/` tree on disk. | `reorganize-desktop-agent-runtime-folders` |
| PKG-05 | task | **done** — `SailPlatform` wraps `createBrowserDesktopAgent`. | `align-sail-platform-wrapper-with-desktop-agent-preset` |
| PKG-06 | task | **done** — harness uses top-level preset API. | `update-conformance-harness-desktop-agent-api` |
| PKG-07 | task | **done** — skill aligned to integrator guide and `/presets` canonical import. | `update-consume-sail-desktop-agent-skill` |
| PKG-08 | — | **cancelled** — integrator guide lives on Docusaurus, not package-local `docs/`. | — |
| PKG-09 | task | **done** — facade returns `DesktopAgent`; coupled lifecycle. | `simplify-browser-desktop-agent-facade-api` |
| PKG-10 | chore | **done** — README links to website; facade example in place. | `align-package-readme-browser-facade-examples` |
| PKG-11 | task | **done** — platform + harness reconciled to facade API. | `reconcile-downstream-browser-facade-consumers` |

## Parent context summary

`@finos/sail-desktop-agent` should be the platform-builder package for FDC3 Desktop Agent construction. It should remain UI-free but expose the host contracts needed to complete FDC3 behaviors, including launch, intent resolution, App Directory population, channel configuration, transports, and connectors. Consumers need both manual composition primitives and high-level presets. `@finos/sail-platform-api` remains the Sail product wrapper for layout, workspaces, configuration, storage, and shell-level APIs.
