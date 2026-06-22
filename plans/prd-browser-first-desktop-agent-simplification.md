# PRD: Browser-first Desktop Agent simplification

## Persona / user

- **Sail maintainer / integrator** who needs `@finos/sail-desktop-agent` to be easy to explain, reason about, and evolve for browser-hosted FDC3 applications.
- **Host shell developer** building channel chrome, app lifecycle UI, and intent resolver UI against a browser-resident Desktop Agent.
- **Future native-app integrator** who may need a WebSocket protocol adapter without inheriting a remote/server-hosted Desktop Agent architecture.

## Goal / outcome

Simplify Sail around a **browser-first Desktop Agent**: one browser-resident `DesktopAgent` owns authoritative FDC3 state for a host page, while web apps continue to connect through WCP and per-app `MessagePort` communication. Remove remote/worker/server-hosted Desktop Agent support from the default product architecture unless a concrete user workflow later justifies an explicit bridge, relay, or sync service.

Success now means the architecture reads as:

```text
FDC3 web apps <-> WCP + per-app MessagePort <-> DesktopAgent browser runtime <-> DA core handlers/state
```

## Delivery status (updated 2026-06-22)

| ID | Status |
|----|--------|
| BFDA-01–BFDA-05 | **Delivered** — see **Work item retention** |
| BFDA-06 | **Open** — docs must follow DA-owned browser runtime direction |
| BFDA-07 | **Open** — observability hook contract not defined |
| BFDA-08 | **Open** — browser app connection still composed through `WCPConnector` + `BrowserDaEdgeLink` |

Native app connectivity remains a future adapter concern, not a reason for the core Desktop Agent to pretend it may live anywhere. Cross-tab or cross-device state sharing remains out of core until a real product workflow requires explicit distributed semantics.

## Relationship to other plans

| Prior plan | Status | This PRD |
|------------|--------|----------|
| `plans/prd-toolbox-conformance-v5-follow-up.md` | Active | **No duplicate**; preserve WCP instance routing and conformance behavior while simplifying architecture |
| `plans/prd-fdc3-3-0-dual-version-support.md` | Active | **No duplicate**; keep the single handler tree and DA-owned browser runtime compatible with incremental FDC3 3.0 work |
| Browser preset / desktop-agent state hardening PRDs | Delivered; PRDs deleted | **Extend** the same browser-first direction; do not resurrect removed remote/state-hardening shims |
| `website/docs/packages/desktop-agent/integrator-guide.md` and `composition.md` | Current docs | **Revise** to make `DesktopAgent` the browser-resident runtime and remove preset/manual connector composition as the default story |

## In scope

| ID | Summary | MoSCoW | Kind | Status | Work item slug |
|----|---------|--------|------|--------|----------------|
| BFDA-00 | Coordinate browser-first simplification work | Must | epic | in progress | `epic-browser-first-desktop-agent-simplification` |
| BFDA-01 | Spike current transport usages and choose direct adapter vs tiny browser-local dispatcher | Must | spike | **done** | `spike-browser-first-transport-simplification` |
| BFDA-02 | Interim browser preset simplification: remove remote DA support and replace in-memory pair with edge link | Must | task | **done** | `simplify-browser-desktop-agent-preset` |
| BFDA-03 | Refactor handler response plumbing away from generic remote-placement assumptions where the spike proves it is safe | Must | task | **done** | `simplify-dacp-handler-response-plumbing` |
| BFDA-04 | Make channel selector and intent resolver host UI use grouped browser controllers instead of raw connector/transport events | Should | task | **done** | `unify-browser-host-ui-controllers` |
| BFDA-05 | Preserve WCP `MessagePort` app connectivity and instance routing with focused regression coverage | Must | task | **done** | `preserve-wcp-messageport-connectivity` |
| BFDA-08 | Collapse browser app connection into `DesktopAgent` runtime; remove browser-path `Transport` / edge-link composition | Must | task | approved | `collapse-browser-app-connection-into-desktop-agent` |
| BFDA-06 | Update desktop-agent docs to describe `DesktopAgent` as the browser-resident DA runtime with WCP/MessagePort as the app boundary | Must | task | open | `document-browser-first-desktop-agent` |
| BFDA-07 | Define lightweight middleware/logging/OTEL hook points at DA command/event and DA-owned browser app connection boundaries | Should | task | open | `define-browser-da-observability-hooks` |

## Out of scope

- Designing or implementing cross-tab, cross-device, or multi-agent distributed state sync.
- Implementing FDC3 Agent Bridging, Redis/Kafka/database persistence, or a server-side relay.
- Implementing the future native WebSocket protocol adapter.
- Preserving public remote/worker/server Desktop Agent deployment support unless BFDA-01 proves it is still required by current shipped behavior.
- Dumping all browser/WCP code into one large `desktop-agent.ts` file. Ownership folds into `DesktopAgent`; helper modules can remain internal.
- Adding executable tests for docs-only work items.

## Success criteria

- [x] WCP `MessagePort` app connection still works for iframe/window apps, including WCP1-5 handshake, WCP6 cleanup, and routing by `instanceId` (BFDA-05).
- [x] Remote/worker/server-hosted Desktop Agent support removed from public presets (`createWCPClient` deleted); docs update deferred to BFDA-06.
- [x] Host channel UI reads/writes through grouped controllers (`SailPlatform.channels`, sail-web `ChannelSelector`) — BFDA-04.
- [x] Host intent resolver UI uses grouped controller path (`intentResolver.onRequest/select/cancel`) — BFDA-04.
- [ ] Browser app connection is owned by `DesktopAgent.start()` / `stop()` with no `BrowserDaEdgeLink` or browser-path `Transport` hop (BFDA-08).
- [ ] The primary docs and API examples describe `DesktopAgent` as the browser-resident DA runtime, not a browser preset plus connector composition (BFDA-06).
- [ ] Middleware, plugin, logging, and OTEL needs represented by domain-level hook points on DA-owned browser app connection and core operations (BFDA-07).
- [x] Existing FDC3 behavior and conformance-oriented tests remain the behavioral guardrail (targeted tests green for delivered slices).

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
  Then the docs show DesktopAgent as the browser-resident runtime
  And remote worker/server Desktop Agent deployment is absent or explicitly deferred
```

```gherkin
Scenario: Browser app connection is owned by DesktopAgent
  Given a host creates a browser-resident DesktopAgent
  When the host starts the DesktopAgent
  Then WCP1Hello listeners and per-app MessagePort routing are attached as part of the DesktopAgent lifecycle
  And inbound WCP4 and DACP messages are handled by DA core handlers and state
  And outbound WCP and DACP responses are delivered to the correct app MessagePort
```

## Architecture / implementation direction

1. **Browser-first mental model** — `DesktopAgent` is the local authoritative browser-resident runtime for one host page. It owns state, handlers, host controllers, app connection lifecycle, and browser app connection resources.
2. **Preserve WCP and MessagePort** — web apps still connect through WCP. Per-app `MessagePort` routing remains necessary because iframe/window apps do not call `DesktopAgent` directly.
3. **Fold browser app connection ownership into `DesktopAgent` (BFDA-08)** — `WCPConnector` behavior becomes DA-owned browser app connection plumbing. Helper modules may remain, but product/API shape should no longer be `createBrowserDesktopAgent` + `WCPConnector` + `BrowserDaEdgeLink` + `Transport`.
4. **Handler response dispatcher (delivered BFDA-03)** — `DACPHandlerContext.responses: DacpResponseDispatcher` replaces `context.transport` for handler response/event delivery. `edgeTransport` on the dispatcher is only for WCP handshake registries (pending source window, instance identity).
5. **Grouped host controllers (delivered BFDA-04)** — normal host UI uses `desktopAgent.channels`, `desktopAgent.intentResolver`, and `desktopAgent.apps`. `SailPlatform` exposes the same grouped surfaces; sail-web reference stores subscribe through them.
6. **Spike outcome superseded by BFDA-08** — BFDA-01/BFDA-02 delivered an interim edge-link simplification. The next direction is to remove that final browser-path `Transport` hop and make the browser app connection DA-owned.
7. **Middleware and OTEL stay possible** — instrumentation should attach to domain operations: inbound app request, outbound app event/response, channel change, intent resolver request/selection/cancel, app connect/disconnect, open/close, WCP handshake, app-port delivery, and handler latency. Do not require generic transport wrapping for observability (BFDA-07).
8. **Native and distributed futures are explicit adapters** — future native WebSocket protocol support belongs under app connection boundaries. Cross-tab/device coordination belongs to a future bridge/relay/sync PRD.
9. **Docs follow implementation** — BFDA-06 rewrites `website/docs/packages/desktop-agent/` for browser-first adoption (still open).
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
| Folding browser app connection into `DesktopAgent` bloats core files | Fold lifecycle ownership, not file bulk; keep WCP/MessagePort mechanics in internal helper modules |
| Removing `BrowserDaEdgeLink` changes async delivery and source-window registry behavior | Preserve async/message ordering expectations and source-window tracking with focused WCP integration tests |

## Constraints

- Use Node.js >= 24 and npm >= 11 for validation commands.
- Preserve FDC3 2.2 behavior while incremental FDC3 3.0 work remains active.
- Do not split DACP handlers into v2/v3 trees.
- Do not add tests for markdown-only documentation work.
- Keep handler/state modules focused; change ownership and public API shape without creating a monolithic `desktop-agent.ts`.
- Avoid backward-compatibility shims on `v3-pre` unless explicitly requested.

## Suggested vertical slices

| ID | Suggested slice | Priority | Status |
|----|-----------------|----------|--------|
| BFDA-01 | Spike all transport usages and decide the smallest browser-local replacement shape | Must | **done** |
| BFDA-02 | Make browser preset and exports stop presenting remote DA as default architecture (interim step before BFDA-08) | Must | **done** |
| BFDA-03 | Refactor handler response path to `DacpResponseDispatcher` | Must | **done** |
| BFDA-04 | Move channel selector and intent resolver consumers to grouped host controllers | Should | **done** |
| BFDA-05 | Guard WCP MessagePort behavior across the refactor | Must | **done** |
| BFDA-08 | Collapse browser app connection into `DesktopAgent` runtime | Must | open |
| BFDA-06 | Rewrite integrator/composition docs for DA-owned browser runtime | Must | open |
| BFDA-07 | Define observability and middleware hooks after the DA-owned browser runtime shape is known | Should | open |

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
| BFDA-01 | **done** (2026-06-21) | Spike decision: in-tab `BrowserDaEdgeLink` + `DacpResponseDispatcher`; keep per-app `MessagePort`; remove `createWCPClient` from presets | `spike-browser-first-transport-simplification` |
| BFDA-02 | **done** (2026-06-21) | `createBrowserDesktopAgent` uses edge link; `createWCPClient` deleted; `connectorTransport` removed from session/API | `simplify-browser-desktop-agent-preset` |
| BFDA-03 | **done** (2026-06-21) | `DACPHandlerContext.responses: DacpResponseDispatcher`; handlers use `sendToInstance` / `sendOutbound` | `simplify-dacp-handler-response-plumbing` |
| BFDA-04 | **done** (2026-06-21) | `SailPlatform.channels` / `intentResolver` / `apps`; sail-web stores use grouped controllers; `BrowserChannelsController.changeAppChannel` waits for confirmation | `unify-browser-host-ui-controllers` |
| BFDA-05 | **done** (2026-06-21) | WCP MessagePort routing guard integration tests added | `preserve-wcp-messageport-connectivity` |
| BFDA-08 | verified-gap | Browser path still composes `createBrowserDesktopAgent` + `WCPConnector` + `BrowserDaEdgeLink` + `Transport` rather than DA-owned browser runtime | `collapse-browser-app-connection-into-desktop-agent` |
| BFDA-06 | verified-gap | Docs must be revised from browser preset / edge-link composition to DA-owned browser runtime | `document-browser-first-desktop-agent` |
| BFDA-07 | investigate | No domain-level middleware/OTEL hook contract yet; should follow BFDA-08 surface | `define-browser-da-observability-hooks` |

## Parent context summary

Sail should be browser-first: one browser-resident `DesktopAgent` owns local FDC3 state and app connection lifecycle for a host page. Web apps still communicate through WCP and per-app `MessagePort`; that is the app boundary, not a separate connector product. The complexity to remove is the public/default assumption that the Desktop Agent itself may live in a worker, server, WebSocket runtime, or other remote location, plus the remaining internal browser-path `Transport` hop between WCP edge and DA. Cross-tab/device synchronization is a future bridge/relay/sync problem, not core DA behavior. Native apps can be added later through an explicit app-connection adapter. Preserve FDC3 behavior and WCP routing while simplifying handler plumbing, host UI controllers, docs, observability hooks, and DA-owned app connection lifecycle.

## Work item retention

Delivered work item `.md` files are **deleted** after delivery. This section and `plans/project-docs.md` are the durable record for completed work.

| Slug | Status | Delivered | Notes |
|------|--------|-----------|-------|
| `spike-browser-first-transport-simplification` | done — work item deleted | 2026-06-21 | Decision: `BrowserDaEdgeLink` for in-tab DA↔WCP; `DacpResponseDispatcher` for handlers; keep `MessagePortTransport`; remove `createWCPClient` |
| `preserve-wcp-messageport-connectivity` | done — work item deleted | 2026-06-21 | `WCP MessagePort routing guard` integration tests (targeted routing, WCP6 cleanup, host disconnect with two apps) |
| `simplify-browser-desktop-agent-preset` | done — work item deleted | 2026-06-21 | Edge link in preset; deleted `create-wcp-client.ts`; dropped `connectorTransport` from session; updated `SailPlatform` wiring |
| `simplify-dacp-handler-response-plumbing` | done — work item deleted | 2026-06-21 | `DacpResponseDispatcher` on `DACPHandlerContext`; all DACP handlers migrated; `withResponseDispatcher` test helper |
| `unify-browser-host-ui-controllers` | done — work item deleted | 2026-06-21 | `SailPlatform` grouped getters; sail-web `connection-store`, `intent-resolver-store`, `ChannelSelector`, `Layout` use controllers; `changeAppChannel` confirmation on channels controller |

