---
title: "Promote browser intent resolver controller"
slug: promote-browser-intent-resolver-controller
kind: task
type: feature
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/host-contracts/intent-resolver.ts
  - packages/sail-desktop-agent/src/presets/create-browser-desktop-agent.ts
  - packages/sail-desktop-agent/src/presets/browser-session.ts
  - packages/sail-desktop-agent/src/presets/__tests__/browser-desktop-agent-preset.test.ts
depends_on:
  - add-browser-host-controller-composition
integration_branch: v3-pre
branch: cursor/promote-browser-intent-resolver-controller
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - api
  - fdc3
---

## Goal

Make `desktopAgent.intentResolver` the canonical host resolver controller while preserving existing resolver behavior for ambiguous FDC3 intent requests.

## User or system context

Host UIs need a framework-neutral way to show resolver choices only when the Desktop Agent asks for a user decision. The existing `intentResolverUI` methods are close to the target API, but the public browser preset surface should use the agreed grouped controller name and keep compatibility during the transition.

## Reference docs

- `plans/prd-browser-preset-host-api.md` (BHA-02, BHA-03)
- `plans/work-items/epic-browser-preset-host-api.md`
- `plans/work-items/add-browser-host-controller-composition.md`
- `packages/sail-desktop-agent/src/host-contracts/intent-resolver.ts`

## Parent context

The new host API should be additive and should not change FDC3 app-facing intent semantics. The resolver UI returns a selected choice or cancellation; the Desktop Agent remains responsible for launching the selected app if needed and delivering the intent through the normal path.

## Behavior spec

Scenario: Host subscribes to resolver requests
  Given a browser host has subscribed through `desktopAgent.intentResolver.onRequest`
  When an FDC3 app raises an ambiguous intent
  Then the host receives a typed resolver request with available choices

Scenario: Host selects a resolver choice
  Given a resolver request is pending
  When the host calls `desktopAgent.intentResolver.select` with a valid choice
  Then the Desktop Agent continues normal intent delivery to the selected target

Scenario: Host cancels a resolver request
  Given a resolver request is pending
  When the host calls `desktopAgent.intentResolver.cancel`
  Then the raising app receives the standard user-cancelled resolution behavior

Scenario: Existing alias remains usable
  Given a host still uses `desktopAgent.intentResolverUI`
  When the host subscribes and resolves through that alias
  Then resolver behavior remains compatible with the new controller

## Out of scope

- Adding host-visible final intent result/success events
- Changing `raiseIntent` or `raiseIntentForContext` selection semantics
- Building an injected WCP3 resolver iframe page

## TypeScript interfaces

```typescript
interface BrowserIntentResolverController {
  onRequest(listener: (request: IntentResolutionRequest) => void): () => void
  getPendingRequests(): IntentResolutionRequest[]
  select(requestId: string, choice: IntentResolutionChoice | IntentHandler): void
  cancel(requestId: string): void
}
```

## Test guidance

RED: Extend preset resolver tests so `desktopAgent.intentResolver` must expose the same request/select/cancel behavior as the current `intentResolverUI` path. Include an unsubscribe assertion and a compatibility assertion for `intentResolverUI` if the alias is retained.

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
