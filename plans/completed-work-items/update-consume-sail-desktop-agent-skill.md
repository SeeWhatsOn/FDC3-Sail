---
title: "Update consume-sail-desktop-agent skill"
slug: update-consume-sail-desktop-agent-skill
kind: task
type: chore
status: done
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

Update the Cursor skill that teaches agents how to consume `@finos/sail-desktop-agent` so it matches the website integrator guide, facade API, and `/presets` canonical import.

## User or system context

Agents use `.cursor/skills/consume-sail-desktop-agent/SKILL.md` when helping integrators build a Desktop Agent from the published package. The skill must align with `website/docs/packages/desktop-agent/integrator-guide.md`.

## Reference docs

- `plans/prd-desktop-agent-composable-package.md`
- `website/docs/packages/desktop-agent/integrator-guide.md`
- `.cursor/skills/consume-sail-desktop-agent/SKILL.md`

## Parent context

The package supports manual composition and presets. The consume skill is a durable agent-facing guide and must match the facade API (`DesktopAgent` return, coupled lifecycle, `getBrowserDesktopAgentSession` for edge internals).

## Behavior spec

Given an agent uses the `consume-sail-desktop-agent` skill
When it explains package imports
Then it describes `@finos/sail-desktop-agent/presets` as the canonical application entry.

Given an integrator wants fine-grained control
When the skill presents manual composition
Then it shows `DesktopAgent`, connector, transport, and host contracts as composable primitives.

Given an integrator wants a ready-made browser setup
When the skill presents the preset path
Then it uses `const desktopAgent = createBrowserDesktopAgent({ appLauncher, intentResolver, apps, userChannels })` with no session destructuring.

## Out of scope

- Changing the `fdc3-expert` skill.
- Writing production code.

## TypeScript interfaces

None.

## Test guidance

Compare skill examples against website integrator guide; no executable RED phase.

## Blocked decisions

None.

## Loop history

- 2026-06-10: Archived done — skill updated for `/presets`, facade return type, coupled lifecycle, website doc link.

## Staged for review

None.

## Escalation notes

None.

## Learnings extracted

None.
