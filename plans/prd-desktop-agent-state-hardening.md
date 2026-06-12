# PRD: Desktop Agent state hardening (Option A lifecycle)

**Slug:** `desktop-agent-state-hardening`  
**Integration branch:** `v3-pre`  
**Date:** 2026-06-11

---

## PRD-01 — Persona / user

Maintainers and integrators of `@finos/sail-desktop-agent` who need a single, spec-aligned runtime state model: correct WCP lifecycle, optional heartbeat liveness, predictable host UI updates (channel selector), and no dead denormalized fields.

## PRD-02 — Goal / outcome

Harden `AgentState` as the single source of truth for FDC3 runtime data with **Option A** instance lifecycle (`PENDING` → `CONNECTED` → removed), consolidate temp→canonical instance id resolution, remove dead state fields, align user-channel reads with `state.channels.user`, collapse `AppDirectoryManager` into queries + Immer mutators, and document singleton + host reactivity patterns — without preemptive FIFO locking.

## PRD-03 — Relationship to other plans

| Existing plan / item | Status on `v3-pre` | This PRD action |
|----------------------|-------------------|-----------------|
| `move-app-directory-into-agent-state` | Landed (`state.appDirectory`) | **extend** — prerequisite done |
| `collapse-app-directory-to-functions` | Draft WI exists | **extend** — same epic |
| `audit-heartbeat-disconnect-cleanup` | completed-work-items | **no duplicate** — reference only |
| `bind-host-instance-id-at-wcp4` | completed-work-items | **no duplicate** — adoption stays |
| Conformance / toolbox PRDs | separate | **defer** — unless regression found |
| FIFO message queue | n/a | **won't-have** (YAGNI) |

## PRD-04 — In scope (MoSCoW)

| ID | Priority | Capability |
|----|----------|------------|
| PRD-04a | **Must** | Option A lifecycle: `PENDING` (host pre-register / pre-WCP5) → `CONNECTED` (WCP5 success) → remove on WCP6 / heartbeat timeout / `disconnectInstance` |
| PRD-04b | **Must** | `heartbeatEnabled` gates liveness only; when off, no heartbeat timers or timeout cleanup; when on, timeout → same cleanup as WCP6 (FDC3-aligned) |
| PRD-04c | **Must** | RED tests on WCP integration path before fixing lifecycle (no manual `CONNECTED` in production-path fixtures) |
| PRD-04d | **Must** | Single temp→canonical instance id **contract** (browser connector + DA bindings) |
| PRD-04e | **Must** | Remove `AppInstance.intentListeners`; derive from `intents.listeners` |
| PRD-04f | **Must** | Remove unused `AppInstanceState` values (`NOT_RESPONDING`, `DISCONNECTING`, `TERMINATED`); migrate `TERMINATED` checks to presence |
| PRD-04g | **Should** | `state.channels.user` as runtime SSOT; config seeds once at init |
| PRD-04h | **Should** | Host reactivity audit: `channelChanged` + granular getters (`getAppUserChannelId`); restrict public `getState()` to tests/debug |
| PRD-04i | **Must** | `collapse-app-directory-to-functions` — queries + mutators; drop manager from handler context |
| PRD-04j | **Should** | Integrator docs: singleton pattern (browser `window`, Node module) + channel UI consumption |

## PRD-05 — Out of scope

- FIFO / per-DA message queue (unless a reproducible lost-update bug is filed)
- Full state subscription / `onStateChange` on `DesktopAgent`
- FDC3 conformance toolbox burn-down (separate PRDs)
- `sail-web` UI redesign beyond verifying existing `connection-store` / `ChannelSelector` wiring
- Directory polling, refresh scheduling, or AppD REST protocol changes

## PRD-06 — Success criteria

1. WCP5 success sets `CONNECTED`; WCP6 removes instance; heartbeat timeout (when enabled) removes instance via same cleanup path.
2. Cucumber + `wcp-desktop-agent.integration.test.ts` assert lifecycle without manual `updateInstanceState(CONNECTED)` on production paths.
3. Temp→canonical resolution documented and implemented through one module/contract; no new ad-hoc maps in handlers.
4. `AppInstance.intentListeners` removed; intent discovery unchanged.
5. Handlers read app catalog from `getState().appDirectory` + query helpers after collapse.
6. `website/docs/` documents singleton + host channel reactivity pattern.

## PRD-07 — BDD scenarios (candidates)

**Lifecycle**

- Given a host pre-registers an instance on `open`  
  When WCP5 succeeds for that instance  
  Then the instance state is `connected` and DACP delivery is allowed.

- Given an instance is connected  
  When the app sends WCP6Goodbye  
  Then the instance is removed from agent state and listeners are cleaned up.

**Heartbeat**

- Given heartbeat is disabled  
  When WCP5 succeeds  
  Then no heartbeat timers run and the instance remains until WCP6 or explicit disconnect.

- Given heartbeat is enabled  
  When the app stops acknowledging heartbeats beyond the configured timeout  
  Then the instance is removed via the same cleanup path as WCP6.

**Channels (host)**

- Given host chrome changes an app's user channel via platform API  
  When the change completes  
  Then `channelChanged` fires and `getAppUserChannel` returns the new channel id.

## PRD-08 — Architecture / implementation direction

**Option A lifecycle (agreed)**

- `PENDING` — only host launcher pre-register before WCP5 completes (Sail extension).
- `CONNECTED` — set in `wcp-handlers.ts` on successful WCP4/WCP5 path (adopt, reconnect, or new instance).
- Teardown — `removeInstance` only; no tombstone enum states.

**Heartbeat (FDC3 2.2)**

- DACP heartbeat is optional DA policy ([DACP — Checking apps are alive](https://fdc3.finos.org/docs/api/specs/desktopAgentCommunicationProtocol#checking-apps-are-alive)).
- Browser-resident DAs should combine WCP6, window checks, and heartbeat ([Browser-Resident DAs — Disconnects](https://fdc3.finos.org/docs/api/specs/browserResidentDesktopAgents#disconnects)).
- Timeout → treat as closed → `cleanupDACPHandlers` (current Sail behavior).

**Temp ids**

- FDC3 assigns canonical `instanceId` at WCP5; `temp-{connectionAttemptUuid}` is Sail routing only.
- One resolver **contract** with browser (`WCPConnector`) and DA (`heartbeat-runtime` / transport) implementations.

**Host reactivity**

- Push: WCP connector `channelChanged` (already in `wcp-message-routing.ts`).
- Pull: `getAppUserChannelId` / `SailPlatform.getAppUserChannel`.
- Do not expose mutable `getState()` to host integrators.

**App directory**

- `AgentState.appDirectory` is SSOT (landed on `v3-pre`).
- Collapse `AppDirectoryManager` to `app-directory-queries.ts` + `mutators/app-directory.ts`.

**ARCH REVIEW:** PASS (2026-06-11). Recommend ADR `docs/decisions/001-agent-instance-lifecycle-option-a.md` during delivery.

## PRD-09 — Risks / unknowns

| Risk | Mitigation |
|------|------------|
| `PENDING` conflated with “ready for all DACP” | Document: host pre-register only; WCP5 sets `CONNECTED` before general delivery |
| Remote DA (`createWCPClient`) lacks WCPConnector map | Transport-level resolver contract, MockTransport mapping in tests |
| `findInstances` including `PENDING` | Document; filter to `CONNECTED` if conformance requires |

## PRD-10 — Constraints

- FDC3 2.2 alignment; no backward-compat shims required on `v3-pre`.
- Tests: production APIs in BDD; no test-only methods on `DesktopAgent`.
- Docs canonical in `website/docs/`.
- Node >= 24, npm workspaces from repo root.

## PRD-11 — Commands

```bash
nvm use 24
npm test -w @finos/sail-desktop-agent
npm run typecheck
```

## PRD-12 — Suggested vertical slices

| ID | Kind | MoSCoW | Planned slug |
|----|------|--------|--------------|
| PRD-04a–c | task | Must | `wire-wcp5-connected-instance-lifecycle` |
| PRD-04d | task | Must | `consolidate-temp-instance-id-resolver` |
| PRD-04e–f | task | Must | `remove-dead-instance-state-denormalization` |
| PRD-04g | task | Should | `user-channels-runtime-ssot` |
| PRD-04h | task | Should | `audit-host-channel-reactivity-read-apis` |
| PRD-04i | task | Must | `collapse-app-directory-to-functions` |
| PRD-04j | task | Should | `document-desktop-agent-singleton-and-reactivity` |
| — | epic | — | `epic-desktop-agent-state-hardening` |

## PRD-13 — Parent context summary

`@finos/sail-desktop-agent` already uses a unified `AgentState` with Immer mutators. Production gaps: `CONNECTED` never set after WCP5; dead `intentListeners` on instances; temp→canonical id logic scattered; dual user-channel config read paths; `AppDirectoryManager` still bound beside `state.appDirectory`. This workload wires spec-aligned lifecycle (Option A), consolidates identity routing, prunes dead fields, collapses app-directory access to functions, audits host read paths for channel UI, and documents singleton + reactivity — without a preemptive message queue.

---

## PRD accuracy gate (2026-06-11 / v3-pre @ 2e5f992f)

| ID | Classification | Evidence | Work item slug |
|----|----------------|----------|----------------|
| PRD-04a | task | verified-gap: `wcp-handlers.ts` calls `connectInstance` (PENDING) but never `updateInstanceState(CONNECTED)` in `src/core/handlers/` (only `__tests__`) | `wire-wcp5-connected-instance-lifecycle` |
| PRD-04b | task | verified-partial: `heartbeatEnabled` gated in `wcp-handlers.ts:262`; timeout → `cleanupDACPHandlers` in `heartbeat-handlers.ts:61-64` | `wire-wcp5-connected-instance-lifecycle` |
| PRD-04c | task | verified-gap: Cucumber `start-app.steps` / Vitest manually set `CONNECTED` | `wire-wcp5-connected-instance-lifecycle` |
| PRD-04d | task | verified-gap: maps in `heartbeat-runtime.ts`, `cleanup.ts`, `resolve-context-listener-instance-id.ts`, `wcp-connector.ts` | `consolidate-temp-instance-id-resolver` |
| PRD-04e | task | verified-gap: `addIntentListener` on instance mutator unused; handlers use `registerIntentListener` only | `remove-dead-instance-state-denormalization` |
| PRD-04f | task | verified-gap: `NOT_RESPONDING`/`DISCONNECTING`/`TERMINATED` never assigned in production `src/` | `remove-dead-instance-state-denormalization` |
| PRD-04g | task | verified-partial: `state.channels.user` at init; `DesktopAgent.getUserChannels()` reads `this.userChannels` config field | `user-channels-runtime-ssot` |
| PRD-04h | task | verified-partial: `getState()` returns live ref; sail-web uses `channelChanged` + platform APIs (`connection-store.ts`) | `audit-host-channel-reactivity-read-apis` |
| PRD-04i | task | verified-partial: `state.appDirectory` on AgentState; manager still on `DACPHandlerContext` | `collapse-app-directory-to-functions` |
| PRD-04j | task | verified-gap: no singleton doc section in integrator guide | `document-desktop-agent-singleton-and-reactivity` |

**Gate result:** PASS — all rows classified; no blockers.
