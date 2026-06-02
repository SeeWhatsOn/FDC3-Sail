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
| `packages/sail-desktop-agent/README.md` | Current package docs reference `/browser` and `/transports` subpaths | Update to top-level package API and the new internal structure. |
| `.cursor/skills/consume-sail-desktop-agent/SKILL.md` | Current skill teaches `/browser` and `/transports` package surface | Update after the new public package surface lands. |

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
- **Presets**: consumers call a factory such as `createBrowserDesktopAgent(...)` and get a composed controller object with lifecycle methods and access to the underlying core agent and connector.

The desired browser preset example is:

```typescript
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent"

const agent = createBrowserDesktopAgent({
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

## PRD accuracy gate (2026-06-02 / v3-pre)

| ID | Classification | Evidence | Work item slug (planned) |
|---|---|---|---|
| PKG-01 | task | verified-partial: `packages/sail-desktop-agent/README.md` documents `/browser` and `/transports`; `src/index.ts` says browser-specific code is not top-level exported. | `define-desktop-agent-package-architecture` |
| PKG-02 | task | verified-partial: `AppLauncher` exists under `src/core/interfaces/app-launcher.ts`; `IntentResolver` and `ChannelSelector` are defined in `packages/sail-platform-api/src/interfaces/*`, creating parallel package ownership. | `promote-desktop-agent-host-contracts` |
| PKG-03 | task | verified-partial: `src/browser/browser-desktop-agent.ts` has `createBrowserDesktopAgent`, but options expose `appLauncher`/`userChannels` and `appDirectories`, not direct `apps` or a friendly `intentResolver` contract. | `add-top-level-browser-desktop-agent-preset` |
| PKG-04 | task | verified-gap: WCP runtime files are under `src/browser/wcp/*`; DACP protocol files are under `src/core/dacp-protocol/*`; the current layout blurs protocol, connector, and preset responsibilities. | `reorganize-desktop-agent-runtime-folders` |
| PKG-05 | task | verified-partial: `packages/sail-platform-api/src/sail-platform.ts` manually creates `DesktopAgent`, `WCPConnector`, and an in-memory transport pair rather than wrapping the package preset. | `align-sail-platform-wrapper-with-desktop-agent-preset` |
| PKG-06 | task | verified-gap: `packages/sail-conformance-harness/src/main.tsx` imports `createBrowserDesktopAgent` from `@finos/sail-desktop-agent/browser` and manually adds apps after construction. | `update-conformance-harness-desktop-agent-api` |
| PKG-07 | task | verified-gap: `.cursor/skills/consume-sail-desktop-agent/SKILL.md` teaches `/browser` and `/transports` as primary import paths. | `update-consume-sail-desktop-agent-skill` |

## Parent context summary

`@finos/sail-desktop-agent` should be the platform-builder package for FDC3 Desktop Agent construction. It should remain UI-free but expose the host contracts needed to complete FDC3 behaviors, including launch, intent resolution, App Directory population, channel configuration, transports, and connectors. Consumers need both manual composition primitives and high-level presets. `@finos/sail-platform-api` remains the Sail product wrapper for layout, workspaces, configuration, storage, and shell-level APIs.
