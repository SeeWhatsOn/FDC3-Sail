# PRD: Browser-first Desktop Agent simplification

## Persona / user

- **Sail maintainer / integrator** who needs `@finos/sail-desktop-agent` to be easy to explain, reason about, and evolve for browser-hosted FDC3 applications.
- **Host shell developer** building channel chrome, app lifecycle UI, and intent resolver UI against a browser-resident Desktop Agent.
- **Future native-app integrator** who may need a WebSocket protocol adapter without inheriting a remote/server-hosted Desktop Agent architecture.

## Goal / outcome

Simplify Sail around a **browser-first Desktop Agent**: one browser-resident `DesktopAgent` owns authoritative FDC3 state for a host page, while web apps continue to connect through WCP and per-app `MessagePort` communication. Remove remote/worker/server-hosted Desktop Agent support from the default product architecture unless a concrete user workflow later justifies an explicit bridge, relay, or sync service.

Success means the architecture reads as:

```text
FDC3 web apps <-> WCP + MessagePort <-> browser app-connection adapter <-> browser DesktopAgent state
```

Native app connectivity remains a future adapter concern, not a reason for the core Desktop Agent to pretend it may live anywhere. Cross-tab or cross-device state sharing remains out of core until a real product workflow requires explicit distributed semantics.

## Relationship to other plans

| Prior plan | Status | This PRD |
|------------|--------|----------|
| `plans/prd-toolbox-conformance-v5-follow-up.md` | Active | **No duplicate**; preserve WCP instance routing and conformance behavior while simplifying architecture |
| `plans/prd-fdc3-3-0-dual-version-support.md` | Active | **No duplicate**; keep the single handler tree and browser preset direction compatible with incremental FDC3 3.0 work |
| Browser preset / desktop-agent state hardening PRDs | Delivered; PRDs deleted | **Extend** the same browser-first direction; do not resurrect removed remote/state-hardening shims |
| `website/docs/packages/desktop-agent/integrator-guide.md` and `composition.md` | Current docs | **Revise** to make browser-first the default and remote DA a deferred/non-goal path |

## In scope

| ID | Summary | MoSCoW | Kind | Work item slug |
|----|---------|--------|------|----------------|
| BFDA-00 | Coordinate browser-first simplification work | Must | epic | `epic-browser-first-desktop-agent-simplification` |
| BFDA-01 | Spike current transport usages and choose direct adapter vs tiny browser-local dispatcher | Must | spike | `spike-browser-first-transport-simplification` |
| BFDA-02 | Simplify the browser preset so `createBrowserDesktopAgent` is the canonical composition and remote DA support is removed or deferred | Must | task | `simplify-browser-desktop-agent-preset` |
| BFDA-03 | Refactor handler response plumbing away from generic remote-placement assumptions where the spike proves it is safe | Must | task | `simplify-dacp-handler-response-plumbing` |
| BFDA-04 | Make channel selector and intent resolver host UI use grouped browser controllers instead of raw connector/transport events | Should | task | `unify-browser-host-ui-controllers` |
| BFDA-05 | Preserve WCP `MessagePort` app connectivity and instance routing with focused regression coverage | Must | task | `preserve-wcp-messageport-connectivity` |
| BFDA-06 | Update desktop-agent docs to describe browser-first DA, WCP app adapters, future native WebSocket adapter, and deferred bridging | Must | task | `document-browser-first-desktop-agent` |
| BFDA-07 | Define lightweight middleware/logging/OTEL hook points at DA command/event and WCP adapter boundaries | Should | task | `define-browser-da-observability-hooks` |

## Out of scope

- Designing or implementing cross-tab, cross-device, or multi-agent distributed state sync.
- Implementing FDC3 Agent Bridging, Redis/Kafka/database persistence, or a server-side relay.
- Implementing the future native WebSocket protocol adapter.
- Preserving public remote/worker/server Desktop Agent deployment support unless BFDA-01 proves it is still required by current shipped behavior.
- Flattening WCP into `DesktopAgent`; browser-specific WCP and `MessagePort` logic stays under `app-connection/`.
- Adding executable tests for docs-only work items.

## Success criteria

- The primary docs and API examples describe one browser-resident Desktop Agent per host page.
- WCP `MessagePort` app connection still works for iframe/window apps, including WCP1-5 handshake, WCP6 cleanup, and routing by `instanceId`.
- Remote/worker/server-hosted Desktop Agent support is either removed from public docs/exports or explicitly marked deferred behind a spike decision.
- Host channel UI can read/write channel state through grouped controllers without waiting on a synthetic in-process transport round trip.
- Host intent resolver UI uses one canonical controller path (`intentResolver.onRequest/select/cancel`) rather than raw `WCPConnector` escape hatches in normal app code.
- Middleware, plugin, logging, and OTEL needs are represented by domain-level hook points, not blocked by removing generic transport as the public mental model.
- Existing FDC3 behavior and conformance-oriented tests remain the behavioral guardrail.

## BDD scenarios (candidates)

```gherkin
Scenario: Browser app connects through WCP to the browser Desktop Agent
  Given a browser host has created one browser Desktop Agent
  When an iframe app completes WCP1 through WCP5 over a MessagePort
  Then the Desktop Agent records the app instance as connected
  And DACP responses route back to that app by instanceId
```

```gherkin
Scenario: Host channel chrome changes an app channel directly
  Given an app instance is connected to the browser Desktop Agent
  When the host changes the app user channel through the grouped channels controller
  Then the Desktop Agent state records the new user channel
  And the host can read the new channel without waiting for a remote transport confirmation
```

```gherkin
Scenario: Intent resolver UI uses the grouped controller
  Given a raised intent has multiple matching handlers
  When the Desktop Agent requests host resolution
  Then the host receives one intent resolver request through the grouped controller
  And selecting a handler resumes delivery to the selected app
```

```gherkin
Scenario: Remote Desktop Agent support is not part of browser-first adoption
  Given an integrator reads the desktop-agent docs
  When they choose the default browser integration path
  Then the docs show createBrowserDesktopAgent and grouped controllers
  And remote worker/server Desktop Agent deployment is absent or explicitly deferred
```

## Architecture / implementation direction

1. **Browser-first mental model** — `DesktopAgent` is the local authoritative state owner for one host page. The default integration path is `createBrowserDesktopAgent`; `DesktopAgent` state includes app directory, connected instances, channels, private/app channels, pending intents, resolver state, and lifecycle.
2. **Preserve WCP and MessagePort** — web apps still connect through WCP. `MessagePortTransport` and per-app port routing remain necessary because iframe/window apps do not call `DesktopAgent` directly.
3. **Demote generic transport** — remove or hide the idea that `Transport` means "where the Desktop Agent lives" for server/worker/WebSocket deployment. If an internal adapter remains, name and scope it as browser-local app-connection plumbing, not a public remote runtime abstraction.
4. **Spike before deleting core plumbing** — BFDA-01 must map all current `Transport` dependencies, including handler context, `sendDACPResponse`, WCP routing, `InMemoryTransport` structured-clone behavior, Cucumber/Vitest harnesses, and `createWCPClient`.
5. **Handler simplification after evidence** — if BFDA-01 confirms it is safe, replace `context.transport` in DACP handlers with a narrow response dispatcher or return-based handler result. Preserve routing metadata semantics (`source.instanceId`, `destination.instanceId`) where WCP delivery requires them.
6. **Host UI through grouped controllers** — normal host UI should use `desktopAgent.intentResolver`, `desktopAgent.channels`, and `desktopAgent.apps`. `WCPConnector` stays an implementation detail or advanced test surface.
7. **Middleware and OTEL stay possible** — instrumentation should attach to domain operations: inbound app request, outbound app event/response, channel change, intent resolver request/selection/cancel, app connect/disconnect, open/close, and handler latency. Do not require generic transport wrapping for observability.
8. **Native and distributed futures are explicit adapters** — future native WebSocket protocol support belongs under app connection boundaries. Cross-tab/device coordination belongs to a future bridge/relay/sync PRD with ownership, liveness, ordering, and conflict semantics.
9. **Docs follow implementation** — update `website/docs/packages/desktop-agent/` and any package README links to explain the browser-first shape. Remove remote/server singleton examples unless BFDA-01 keeps them as explicitly deferred advanced material.
10. **No backward-compat shims by default** — on `v3-pre`, delete or replace old remote-placement APIs instead of layering migration facades unless the human explicitly asks for compatibility.

## Risks / unknowns

| Risk / unknown | Mitigation |
|----------------|------------|
| Removing generic `Transport` breaks tests that rely on injected I/O | BFDA-01 inventory first; keep or replace test harness seams deliberately |
| Direct calls lose structured-clone and async-delivery realism from `InMemoryTransport` | Preserve those semantics in focused WCP integration tests where they catch real browser issues |
| Handler refactor grows too large | Deliver one vertical slice first: WCP connect + channel join/broadcast |
| `createWCPClient` has unseen consumers | Treat `v3-pre` as pre-release; document acceptable removal unless a real consumer appears |
| Middleware/OTEL hook design becomes another abstraction layer | BFDA-07 defines only named domain events and minimal hook contracts after core simplification |
| Host UI controller refactor conflicts with platform/web state stores | Keep SailPlatform and sail-web changes in a separate slice after preset APIs are settled |

## Constraints

- Use Node.js >= 24 and npm >= 11 for validation commands.
- Preserve FDC3 2.2 behavior while incremental FDC3 3.0 work remains active.
- Do not split DACP handlers into v2/v3 trees.
- Do not add tests for markdown-only documentation work.
- Keep `host-contracts/`, `presets/`, `app-connection/`, and `core/handlers/` boundaries unless BFDA-01 proves a narrower replacement is safer.
- Avoid backward-compatibility shims on `v3-pre` unless explicitly requested.

## Suggested vertical slices

| ID | Suggested slice | Priority | Planned slug |
|----|-----------------|----------|--------------|
| BFDA-01 | Spike all transport usages and decide the smallest browser-local replacement shape | Must | `spike-browser-first-transport-simplification` |
| BFDA-02 | Make browser preset and exports/docs stop presenting remote DA as default architecture | Must | `simplify-browser-desktop-agent-preset` |
| BFDA-03 | Refactor one handler response path, then expand only if simpler and tests stay green | Must | `simplify-dacp-handler-response-plumbing` |
| BFDA-04 | Move channel selector and intent resolver consumers to grouped host controllers | Should | `unify-browser-host-ui-controllers` |
| BFDA-05 | Guard WCP MessagePort behavior across the refactor | Must | `preserve-wcp-messageport-connectivity` |
| BFDA-06 | Rewrite integrator/composition docs for browser-first adoption | Must | `document-browser-first-desktop-agent` |
| BFDA-07 | Define observability and middleware hooks after the core API shape is known | Should | `define-browser-da-observability-hooks` |

## Commands

```bash
nvm use 24
npm test -w @finos/sail-desktop-agent
npm run typecheck -w @finos/sail-desktop-agent
npm run docs:build -w @finos/sail-docs
```

Docs-only slices use human review plus optional docs build; do not add executable markdown contract tests.

## PRD accuracy gate (2026-06-21 / v3-pre)

| ID | Classification | Evidence | Work item slug |
|----|----------------|----------|----------------|
| BFDA-01 | investigate | `core/interfaces/transport.ts` states transport represents DA location across server/browser/worker; `handlers/types.ts` injects `transport` into every DACP handler; WCP routing and tests depend on this seam | `spike-browser-first-transport-simplification` |
| BFDA-02 | verified-gap | `presets/create-browser-desktop-agent.ts` builds the default browser DA through an `InMemoryTransport` pair; `presets/create-wcp-client.ts` exposes remote DA client mode as public preset | `simplify-browser-desktop-agent-preset` |
| BFDA-03 | verified-partial | `dacp-response-utils.ts` sends all responses through generic `Transport`; this centralizes routing but carries remote-placement assumptions into handler code | `simplify-dacp-handler-response-plumbing` |
| BFDA-04 | verified-partial | `browser-session.ts` exposes grouped `intentResolver`, `channels`, and `apps`; `sail-platform.ts` still exposes raw connector/session state and waits for `channelChanged` after local state mutation | `unify-browser-host-ui-controllers` |
| BFDA-05 | verified-gap | `wcp-message-routing.ts` owns app `MessagePortTransport` routing and WCP5 instance migration; this must be preserved before removing internal transport assumptions | `preserve-wcp-messageport-connectivity` |
| BFDA-06 | verified-gap | `integrator-guide.md` still documents Node/server singleton and `createWCPClient`; `composition.md` lists a remote DA pattern alongside the browser preset | `document-browser-first-desktop-agent` |
| BFDA-07 | investigate | Current logging exists in `MessagePortTransport`, WCP routing, connector, and handlers, but there is no domain-level middleware/OTEL hook contract | `define-browser-da-observability-hooks` |

## Parent context summary

Sail should be browser-first: one browser-resident `DesktopAgent` owns local FDC3 state for a host page. Web apps still communicate through WCP and per-app `MessagePort`; that is not the complexity being removed. The complexity to remove is the public/default assumption that the Desktop Agent itself may live in a worker, server, WebSocket runtime, or other remote location. Cross-tab/device synchronization is a future bridge/relay/sync problem, not core DA behavior. Native apps can be added later through a WebSocket protocol adapter at the app-connection boundary. The work should proceed as a spike plus vertical slices, preserving FDC3 behavior and WCP routing while simplifying handler plumbing, host UI controllers, docs, and observability hooks.

## Work item retention

Delivered work item `.md` files are **deleted** after delivery. This section and `plans/project-docs.md` are the durable record for completed work.

