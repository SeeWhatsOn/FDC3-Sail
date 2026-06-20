---
title: "Configurable fdc3Version advertisement and WCP3 alignment"
slug: configurable-fdc3-version-advertisement
kind: task
type: feature
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/sail-default-config.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/app-handlers.ts
  - packages/sail-desktop-agent/src/app-connection/wcp/wcp-types.ts
  - packages/sail-desktop-agent/src/app-connection/wcp/wcp1-3-handshake.ts
  - packages/sail-desktop-agent/src/presets/create-browser-desktop-agent.ts
  - packages/sail-desktop-agent/src/core/__tests__/sail-default-config.test.ts
  - packages/sail-desktop-agent/src/app-connection/__tests__/wcp-connector.test.ts
depends_on:
  - audit-fdc3-3-0-handler-delta
integration_branch: v3-pre
branch: cursor/configurable-fdc3-version-advertisement-8a9f
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Ensure `implementationMetadata.fdc3Version`, `getInfo`, and WCP3 handshake advertise the same configurable spec level, defaulting to `"2.2"` until maintainers intentionally opt into `"3.0"`.

## User or system context

Integrators embedding `createBrowserDesktopAgent` or `new DesktopAgent({ implementationMetadata })` must control advertised FDC3 version without forking code. WCP and getInfo must not drift (both read same config slice).

## Reference docs

- `plans/prd-fdc3-3-0-dual-version-support.md` (F30-09)
- `packages/sail-desktop-agent/src/core/sail-default-config.ts`
- `packages/sail-desktop-agent/src/app-connection/wcp-connector.ts`

## Parent context

Child of `epic-fdc3-3-0-dual-version`. **Do not change default to `"3.0"`** in this task unless PRD Phase C is explicitly approved later. This task is wiring + tests for override path.

## Behavior spec

Scenario: Default remains 2.2
  Given no implementationMetadata override
  When getInfo and WCP3Handshake run
  Then fdc3Version is `"2.2"`

Scenario: Integrator override to 3.0
  Given DesktopAgent constructed with `implementationMetadata.fdc3Version: "3.0"`
  When getInfoResponse is sent
  Then payload reports `"3.0"` and WCP3Handshake matches

Scenario: Browser preset passes through config
  Given createBrowserDesktopAgent options include fdc3Version
  When WCP connector starts
  Then handshake payload uses the same value as getInfo

Scenario: Invalid version string
  Given non-spec version in config
  When agent starts
  Then behavior is documented (accept string vs validate) per audit recommendation

## Out of scope

- Flipping product default to `"3.0"` (Phase C product decision)
- Per-connection version negotiation
- npm package semver rename

## TypeScript interfaces

`SailImplementationMetadata.fdc3Version` and `WCPConnectorOptions.fdc3Version` stay string; document allowed values in integrator doc (F30-11).

## Test guidance

RED: extend `sail-default-config.test.ts` and `wcp-connector.test.ts` for override path. Vitest only; no toolbox run required.

## Blocked decisions

_(empty)_

## Loop history

_(empty)_

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
