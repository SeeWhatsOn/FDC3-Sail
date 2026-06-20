# PRD: Desktop Agent state hardening (Option A lifecycle)

**Slug:** `desktop-agent-state-hardening`  
**Integration branch:** `v3-pre`  
**Date:** 2026-06-11

---

## PRD-01 — Persona / user

Maintainers and integrators of `@finos/sail-desktop-agent` who need a single, spec-aligned runtime state model: correct WCP lifecycle, optional heartbeat liveness, predictable host UI updates (channel selector), and no dead denormalized fields.

## PRD-02 — Goal / outcome

Harden `AgentState` as the single source of truth for FDC3 runtime data with **Option A** instance lifecycle (`PENDING` → `CONNECTED` → removed), consolidate temp→canonical instance id resolution, remove dead state fields, align user-channel reads with `state.channels.user`, collapse `AppDirectoryManager` into queries + Immer mutators, and document singleton + host reactivity patterns — without preemptive FIFO locking.

**Delivery status (2026-06-20):** Must-have lifecycle, identity, denormalization, user-channel SSOT, and app-directory collapse **landed on `v3-pre`**. Remaining: host reactivity audit (PRD-04h) and integrator docs (PRD-04j). Optional: `reorganize-core-handlers-colocate-state` (folder hygiene).

## PRD-03 — Relationship to other plans

| Existing plan / item | Status on `v3-pre` | This PRD action |
|----------------------|-------------------|-----------------|
| `move-app-directory-into-agent-state` | **done** — prerequisite; work item deleted | **extend** — prerequisite done |
| `collapse-app-directory-to-functions` | **done** — work item deleted | **extend** — same epic |
| `audit-heartbeat-disconnect-cleanup` | **done** — work item deleted | **no duplicate** — reference only |
| `bind-host-instance-id-at-wcp4` | **done** — work item deleted | **no duplicate** — adoption stays |
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

`@finos/sail-desktop-agent` uses unified `AgentState` with Immer mutators. **Delivered:** Option A lifecycle (`CONNECTED` at WCP5), temp→canonical id contract, dead field removal, `state.channels.user` SSOT, app-directory queries/mutators. **Remaining:** host channel reactivity audit, singleton/reactivity docs; optional handler folder hygiene.

---

## PRD accuracy gate (2026-06-20 / v3-pre)

| ID | Status | Work item slug |
|----|--------|----------------|
| PRD-04a–c | **done** — work item deleted | `wire-wcp5-connected-instance-lifecycle` |
| PRD-04d | **done** — work item deleted | `consolidate-temp-instance-id-resolver` |
| PRD-04e–f | **done** — work item deleted | `remove-dead-instance-state-denormalization` |
| PRD-04g | **done** — work item deleted | `user-channels-runtime-ssot` |
| PRD-04h | **active** | `audit-host-channel-reactivity-read-apis` |
| PRD-04i | **done** — work item deleted | `collapse-app-directory-to-functions` |
| PRD-04j | **active** | `document-desktop-agent-singleton-and-reactivity` |
| — | **optional** | `reorganize-core-handlers-colocate-state` |

**Gate result:** PASS — delivered rows verified on branch; active rows remain in `plans/work-items/`.

## Work item retention

**Policy (2026-06-20):** Delivered slices below are recorded here only; work item files **deleted**:

| Slug | Status |
|------|--------|
| `wire-wcp5-connected-instance-lifecycle` | done — work item deleted |
| `consolidate-temp-instance-id-resolver` | done — work item deleted |
| `remove-dead-instance-state-denormalization` | done — work item deleted |
| `user-channels-runtime-ssot` | done — work item deleted |
| `collapse-app-directory-to-functions` | done — work item deleted |
| `move-wcp-temp-id-alias-to-agent-state` | done — work item deleted |

Active queue (`audit-host-channel-reactivity-read-apis`, `document-desktop-agent-singleton-and-reactivity`, `reorganize-core-handlers-colocate-state`) remains in `plans/work-items/`.
