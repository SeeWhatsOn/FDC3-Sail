---
title: "DACP/WCP metadata-only log redaction"
slug: dacp-wcp-log-redaction
merged_pr: "v3-pre@cabeb3c2 #36"
kind: task
type: chore
status: done
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/interfaces/logger.ts
  - packages/sail-desktop-agent/src/core/desktop-agent.ts
  - packages/sail-desktop-agent/src/browser/browser-desktop-agent.ts
  - packages/sail-desktop-agent/src/core/dacp-protocol/dacp-utils.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/index.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/wcp-handlers.ts
  - packages/sail-desktop-agent/src/browser/wcp/message-port-transport.ts
  - packages/sail-desktop-agent/src/browser/wcp/wcp-message-routing.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-raise-intent.ts
  - packages/sail-desktop-agent/README.md
depends_on: []
integration_branch: ""
branch: chore/dacp-wcp-log-redaction
external_tracker: ""
tags: [security, fdc3]
---

## Goal

Make DACP/WCP structured logging **metadata-only by default**, with an explicit **agent config opt-in** for full payloads — while keeping the existing **injectable `Logger`** as the sink (P2-01).

## User or system context

Production hosts must not leak financial context in logs. Today:

- `DesktopAgentConfig.logger` and `createBrowserDesktopAgent({ logger })` already accept an injectable `Logger` (controls whether `debug` is emitted at all).
- There is **no** `logPayloadDetail` (or similar) on config yet — redaction policy is not config-driven.
- DACP handlers use `context.logger`, but **`intent-raise-intent.ts` logs `JSON.stringify(contextPayload)` at `info`** (always visible with default `consoleLogger`).
- **`MessagePortTransport` and `dacp-utils` use hardcoded `consoleLogger`**, bypassing the injected logger; `fullMessage` is only at `debug` (no-op on default logger).

Hosts that need full payloads for local debugging should opt in via config, not by forking handler code.

## Reference docs

- `plans/prd-desktop-agent-release-p2.md` (P2-01)
- `FDC3_2_2_REMEDIATION_PLAN.MD` Task 4
- `packages/sail-desktop-agent/src/core/interfaces/logger.ts`
- `packages/sail-desktop-agent/src/core/desktop-agent.ts` (`logger?: Logger`)

## Parent context

Release P2 hardening: safe defaults for production, without removing the ability for integrators to debug. Complements P2-02 (README) — document the new config flag alongside injectable logger.

## Parent context

From `plans/prd-desktop-agent-release-p2.md`: Post-P1 hardening — logging redaction, README/package alignment, metadata defaults, and test hygiene.

## Behavior spec

**Default — metadata only**

Given a Desktop Agent constructed with default logging config (`logPayloadDetail` omitted or `'metadata'`)
And a DACP message whose context contains `accountNumber: "SECRET-123"`
When handlers or transport emit structured logs at `info` / `warn` / `error`
Then log objects include only metadata (message `type`, `requestUuid`, `contextType`, `contextKeys`, channel/instance ids, flags)
And the string `SECRET-123` never appears in those log lines

**Opt-in — full payloads**

Given `logPayloadDetail: 'full'` on `DesktopAgentConfig` (and the same option threaded through `createBrowserDesktopAgent` / browser factory options)
And the host injects a `Logger` whose `debug` implementation captures output (or uses a test fake logger)
When a sensitive DACP/WCP message is processed
Then full payload JSON may appear **only** at `logger.debug` (never at `info`/`warn`/`error` by default)
And metadata-only shape is still used at `info`/`warn`/`error`

**Injectable logger (unchanged contract)**

Given a host passes `logger: myLogger` into Desktop Agent construction
When any DACP handler logs via `context.logger`
Then output goes to `myLogger`, not a hardcoded `consoleLogger`
And transport/WCP paths that today call `consoleLogger` directly are wired to the same `logger` + `logPayloadDetail` policy

**Edge — default consoleLogger**

Given default `consoleLogger` and `logPayloadDetail: 'metadata'`
When `debug` would include full payloads
Then default `consoleLogger.debug` remains a no-op (no console noise in production)
And integrators who enable `logPayloadDetail: 'full'` **and** a custom logger with active `debug` see full payloads

**Public API documentation (TSDoc / JSDoc)**

Given `logPayloadDetail` and related logging options are added to exported config types
When a maintainer or doc generator (future Docusaurus / TypeDoc) reads the package API
Then every **exported** surface documents logging behavior with TSDoc blocks that include:
  - default (`metadata`) and security rationale (no sensitive context at info/warn/error by default)
  - opt-in `full` and that full payloads are emitted at `debug` only
  - relationship to injectable `logger` (sink vs payload policy)
And `Logger` in `logger.ts` has a short `@remarks` on how `debug` interacts with `logPayloadDetail`
And `packages/sail-desktop-agent/README.md` has a **Logging** subsection (or extends existing config docs) with the same facts in prose — suitable to lift into Docusaurus later without re-reading source

## Out of scope

- Platform-api logging
- Repo-wide log policy outside sail-desktop-agent
- Replacing the `Logger` interface or requiring hosts to implement redaction themselves (agent owns payload shaping before calling `logger`)
- New Docusaurus pages or website build wiring (only in-package TSDoc + README; website import is a follow-up)

## TypeScript interfaces

Add to `DesktopAgentConfig` (and mirror on browser factory options):

```ts
/**
 * How much message/context detail agent-internal structured logs include.
 *
 * @defaultValue `'metadata'`
 *
 * - `'metadata'` — log type, ids, contextType, key names only; never full context JSON at info/warn/error.
 * - `'full'` — may include serialized payloads on {@link Logger.debug} only; requires a logger that implements `debug`.
 *
 * @remarks Use with {@link DesktopAgentConfig.logger} (or browser factory `logger`): config selects *what* to log; the logger selects *where* it goes.
 */
logPayloadDetail?: "metadata" | "full"
```

Thread through handler `DACPHandlerContext` (or a small `LoggingOptions` on context) so handlers and shared helpers (`logDACPMessage`, transport) read the same flag.

**TSDoc targets (minimum):** `DesktopAgentConfig.logPayloadDetail`, `DesktopAgentConfig.logger`, browser `createBrowserDesktopAgent` options mirror, exported `Logger` / `consoleLogger` if behavior changes.

## TypeScript interfaces

none

## Test guidance

- Vitest with a capturing fake `Logger`: assert `info` output excludes sensitive values under default config.
- Same fake logger + `logPayloadDetail: 'full'`: assert full payload appears only on `debug` calls.
- Regression: `MessagePortTransport` broadcast path must not log `fullMessage` at `info` when using defaults.
- Doc check: exported config types include `@defaultValue` / `@remarks`; README **Logging** subsection mentions `logger` + `logPayloadDetail` (manual review — no website build required in this item).

## Blocked decisions

**Resolved (2026-05-27 revise):** Policy is **config-driven**, not permanently redacted. Default `metadata`; opt-in `full` at `debug` only. Injectable `logger` remains the sink; config controls *what* is passed to it.

## Loop history

- 2026-05-29: /ww-reconcile — shipped on v3-pre (cabeb3c2 #36; feat(sail-desktop-agent): ww-deliver batch — log redaction, intents contract tests)

- 2026-05-27: revised per human — clarify config opt-in vs always-on redaction; wire transport to injected logger
- 2026-05-27: revised per human — require TSDoc on exported config + README Logging section for future Docusaurus
- 2026-05-27: approved by human
