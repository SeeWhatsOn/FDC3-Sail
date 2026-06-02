---
title: "Update consume-sail-desktop-agent skill"
slug: update-consume-sail-desktop-agent-skill
kind: task
type: chore
status: pr_awaiting
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - .cursor/skills/consume-sail-desktop-agent/SKILL.md
depends_on:
  - add-top-level-browser-desktop-agent-preset
  - promote-desktop-agent-host-contracts
  - define-desktop-agent-package-architecture
integration_branch: v3-pre
branch: cursor/update-consume-sail-desktop-agent-skill-ade5
pr_url: "https://github.com/SeeWhatsOn/FDC3-Sail/pull/67"
merged_pr: ""
external_tracker: ""
tags: []
---

## Goal

Update the Cursor skill that teaches agents how to consume `@finos/sail-desktop-agent` so it matches the new top-level exports, manual composition mode, and preset mode.

## User or system context

Agents use `.cursor/skills/consume-sail-desktop-agent/SKILL.md` when helping integrators build a Desktop Agent from the published package. After this refactor, the skill must stop teaching `/browser` and `/transports` as the primary package surface and instead explain top-level imports, host contracts, manual composition, and presets.

## Reference docs

- `plans/prd-desktop-agent-composable-package.md`
- `plans/work-items/define-desktop-agent-package-architecture.md`
- `plans/work-items/promote-desktop-agent-host-contracts.md`
- `plans/work-items/add-top-level-browser-desktop-agent-preset.md`
- `.cursor/skills/consume-sail-desktop-agent/SKILL.md`

## Parent context

The package should support two public consumption modes: manual composition and ready-made presets. The consume skill is a durable agent-facing guide and must match the final package API so future agents do not recommend stale subpath imports or old WCP event wiring patterns.

## Behavior spec

Given an agent uses the `consume-sail-desktop-agent` skill
When it explains package imports
Then it describes top-level exports instead of `/browser` and `/transports` as the primary API.

Given an integrator wants fine-grained control
When the skill presents manual composition
Then it shows `DesktopAgent`, connector, transport, `appLauncher`, `intentResolver`, `apps`, and `userChannels` as composable primitives.

Given an integrator wants a ready-made browser setup
When the skill presents the preset path
Then it uses `createBrowserDesktopAgent({ appLauncher, intentResolver, apps, userChannels })`.

## Out of scope

- Changing the `fdc3-expert` skill.
- Updating unrelated Cursor skills.
- Writing production code.

## TypeScript interfaces

None.

## Test guidance

RED phase should compare the current skill against the new package docs and API. Verification should ensure examples use the final top-level imports and do not reference obsolete primary subpaths.

## Blocked decisions

None.

## Loop history

None.

## Staged for review

None.

## Escalation notes

None.

## Learnings extracted

None.
