---
title: "DACP/WCP metadata-only log redaction"
slug: dacp-wcp-log-redaction
kind: task
type: chore
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/dacp-protocol/dacp-utils.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/index.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/wcp-handlers.ts
  - packages/sail-desktop-agent/src/browser/wcp/message-port-transport.ts
  - packages/sail-desktop-agent/src/browser/wcp/wcp-message-routing.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-raise-intent.ts
depends_on: []
integration_branch: ""
branch: chore/dacp-wcp-log-redaction
external_tracker: ""
tags: [security, fdc3]
---

## Goal

Redact DACP/WCP logging so full context payloads and raw messages are not emitted by default (remediation Task 4 / P2-01).

## User or system context

Production Desktop Agents must not log sensitive financial context fields from untrusted apps. Reviewers flagged `fullMessage: JSON.stringify` and context payload stringification.

## Reference docs

- `plans/prd-desktop-agent-release-p2.md` (P2-01)
- `FDC3_2_2_REMEDIATION_PLAN.MD` Task 4

## Parent context

From `plans/prd-desktop-agent-release-p2.md`: Post-P1 hardening — logging redaction, README/package alignment, metadata defaults, and test hygiene.

## Behavior spec

Given a DACP message with context containing a sensitive field
When the router or transport logs the message at info/debug
Then logs contain only metadata (type, ids, contextType, flags) and never the sensitive field value

## Out of scope

- Platform-api logging
- Repo-wide log policy outside sail-desktop-agent

## TypeScript interfaces

none

## Test guidance

Add logger tests with fake `accountNumber: "SECRET-123"` in context; assert captured log output excludes that string.

## Blocked decisions

Whether debug-level full payload logging is allowed behind an explicit opt-in flag.
