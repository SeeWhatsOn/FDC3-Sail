---
title: "WCP1Hello origin allowlist before handshake"
slug: wcp1-hello-origin-allowlist
merged_pr: "v3-pre@43a59510 #30"
type: enhancement
status: done
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/browser/wcp/wcp-connector.ts
  - packages/sail-desktop-agent/src/browser/wcp/wcp-types.ts
  - packages/sail-desktop-agent/src/browser/__tests__/wcp-connector.test.ts
  - packages/sail-platform-api/src/sail-browser-desktop-agent.ts
depends_on: []
integration_branch: ""
branch: feature/wcp-origin-allowlist
pr_url: https://github.com/SeeWhatsOn/FDC3-Sail/pull/30
external_tracker: ""
tags: [fdc3, security]
---

## Goal

Reject or ignore `WCP1Hello` from origins not on a host-supplied allowlist before creating MessageChannel and temp connections.

## User or system context

Today any origin can start handshake; WCP4 blocks DACP but handshake window allows resource exhaustion.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 4)

## Parent context

From `plans/prd-desktop-agent-conformance-gaps.md`: Close lifecycle cleanup, conformance evidence, validation boundaries, and test trust before P1 sign-off and v3 release.

## Behavior spec

Given `allowedOrigins: ["https://trusted.example.com"]`
When `postMessage` WCP1Hello from another origin
Then no channel created, optional `handshakeFailed` event, no temp instance in maps

Given empty allowlist / undefined
When configured as permissive mode for dev
Then document default: allow all (current behavior) vs. deny all — pick one for production composition in `sail-platform-api`

## Out of scope

- Replacing WCP4 identityUrl / MessageEvent.origin checks.

## TypeScript interfaces

none

## Test guidance

Vitest on `WCPConnector` with spy on `MessageChannel` constructor.

## Blocked decisions

~~Allowlist on `WCPConnectorOptions` vs. platform-only wrapper.~~ Resolved: `allowedOrigins` on `WCPConnectorOptions`; Sail docs note undefined = permissive dev default.

## RED evidence

- Test files changed: `packages/sail-desktop-agent/src/browser/__tests__/wcp-connector.test.ts`
- Command run: `nvm use 24 && npx vitest run packages/sail-desktop-agent/src/browser/__tests__/wcp-connector.test.ts`
- Failure summary: **2 failed / 39 passed** (41 total). Untrusted-origin tests fail because `handleWCP1Hello` still creates `MessageChannel`, stores temp connection, and never emits `handshakeFailed` — allowlist option is typed but not enforced.
- Expected reason: Origin check not yet implemented in `handleWindowMessage` / `handleWCP1Hello`; RED confirms spec gap before GREEN.
- Unrelated tests: healthy (all 37 pre-existing + 2 permissive/trusted allowlist tests pass).

## Loop history

- 2026-05-29: /ww-reconcile — shipped on v3-pre (43a59510 #30; feat(sail-desktop-agent): WCP1Hello origin allowlist before handshake)

- 2026-05-27: approved by human (validation gaps waived)
- 2026-05-28: RED — four tests in `wcp-connector.test.ts` (`WCP1Hello origin allowlist`). Vitest: **2 failed / 39 passed**. `allowedOrigins` added to `WCPConnectorOptions`; Sail platform JSDoc documents undefined = allow-all dev default.

## Learnings extracted

### Proposed (pending GREEN)

- **Check site:** Reject in `WCPConnector.handleWindowMessage` (before `handleWCP1Hello`) or at top of `handleWCP1Hello` in `wcp1-3-handshake.ts` — must run before `new MessageChannel()` (line 40). Connector-level check keeps handshake module origin-agnostic.
- **Permissive default:** `allowedOrigins === undefined` → skip check (current behavior). Do not default to `[]` in constructor `Required<>` merge — preserves dev ergonomics; production passes explicit list via `wcpOptions`.
- **Failure surface:** Emit `handshakeFailed(new Error('…origin…'), connectionAttemptUuid)` and return early; no temp entry in `connections` / `messagePortTransports` / `transportToInstanceId`.
- **Constructor wiring:** Add `allowedOrigins: options?.allowedOrigins` to `this.options` merge; consider `Required<Omit<WCPConnectorOptions, 'allowedOrigins'>> & Pick<WCPConnectorOptions, 'allowedOrigins'>` so internal type stays `string[] | undefined`.
- **Test harness:** `createMessageEvent(data, source, origin)` third arg; spy `MessageChannel` + `postMessage` for channel/WCP3 absence; trusted + permissive cases guard against over-blocking.
