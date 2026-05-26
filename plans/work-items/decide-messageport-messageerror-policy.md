---
title: "Define and implement MessagePort messageerror policy"
slug: decide-messageport-messageerror-policy
type: chore
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/browser/wcp/message-port-transport.ts
  - packages/sail-desktop-agent/README.md
depends_on:
  - fix-messageport-error-disconnect-cleanup
  - fix-messageport-bound-listeners
integration_branch: ""
branch: chore/messageport-messageerror-policy
external_tracker: ""
tags: [fdc3, security]
---

## Goal

Document and implement whether a single `messageerror` (deserialization failure) should tear down the app connection or be logged and ignored.

## User or system context

Today `messageerror` triggers full transport disconnect, which may drop an otherwise healthy app due to one bad payload. Review suggests logging vs. fatal disconnect needs an explicit product decision.

## Reference docs

- `plans/project-docs.md`
- `.cursor/issues-discovered.md`

## Behavior spec

Given an active MessagePort app connection
When a malformed or uncloneable message triggers `messageerror`
Then behavior matches the documented policy (either: log + continue, or: disconnect with full cleanup per error-disconnect work item)

Given the policy is fatal disconnect
When messageerror fires
Then port close and listener removal run (same as other disconnect paths)

## Out of scope

- Changing WCP message validation for well-formed messages.
- Platform API changes.

## TypeScript interfaces

none

## Test guidance

RED: one test per chosen policy; update README or inline doc with rationale (security vs. resilience).

## Blocked decisions

- Human must choose: **fatal disconnect** (strict) vs. **log and ignore** (lenient) before implementation if not decided at approve time.

## Loop history

## Staged for review

## Escalation notes

## Learnings extracted
