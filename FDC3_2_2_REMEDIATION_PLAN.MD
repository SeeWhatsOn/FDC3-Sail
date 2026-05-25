# FDC3 2.2 Remediation Plan: Sail Desktop Agent

This implementation plan follows the review in `packages/sail-desktop-agent/FDC3_2_2_COMPLIANCE_REVIEW.md`.

## Completion Rule

When every task below is complete and verified, update the review artifact's **Linked Remediation Plan** section and mark the blocker status as complete there.

## Phase 1: Channel Semantics

### Scope correction: app-channel clear context

`Channel.clearContext()` and `contextCleared` are omitted from this FDC3 2.2 remediation plan. They appear in newer/next FDC3 docs, but not in the exact FDC3 `v2.2` `Channel.md` or `App-Channel-Tests.md`. Do not implement them as a 2.2 conformance blocker unless Sail explicitly chooses to support newer API behavior as an extension.

### Task 1: Separate user-channel membership from app-channel participation

**Description:** Split the current single-channel state model so `getCurrentChannel()`, `leaveCurrentChannel()`, and default `broadcast()` operate only on the current user channel, while app-channel context listeners still participate in app-channel routing.

**Acceptance criteria:**
- [ ] `getCurrentChannel()` reports only the current user channel.
- [ ] Adding a listener on an app channel does not replace the current user channel.
- [ ] Default `broadcast()` still targets the joined user channel after app-channel listener registration.

**Verification:**
- [ ] Add regression tests for user-channel plus app-channel interaction.
- [ ] Run `npm run test -w @finos/sail-desktop-agent`.

**Dependencies:** None

**Files likely touched:**
- `packages/sail-desktop-agent/src/core/state/types.ts`
- `packages/sail-desktop-agent/src/core/state/mutators/instance.ts`
- `packages/sail-desktop-agent/src/core/state/selectors/instance.ts`
- `packages/sail-desktop-agent/src/core/handlers/dacp/channel-handlers.ts`
- `packages/sail-desktop-agent/src/core/handlers/dacp/context-handlers.ts`
- `packages/sail-desktop-agent/test/features/channels/user-channels.feature`
- `packages/sail-desktop-agent/test/features/channels/app-channels.feature`

**Detailed implementation notes:**
- Add a new field to `AppInstance` named `currentUserChannel: string | null`.
- Keep the existing `currentChannel` field only temporarily if needed for migration inside the branch, but the end state should not use it for app-channel listener routing. Prefer replacing it with `currentUserChannel` and app-channel listener-derived routing.
- Update `connectInstance()` so new instances initialize `currentUserChannel: null`.
- Rename or replace `joinChannel()` with user-channel-specific helpers:
  - `joinUserChannel(state, instanceId, channelId)`
  - `leaveUserChannel(state, instanceId)`
- Update `handleJoinUserChannelRequest()` to call `joinUserChannel()`.
- Update `handleLeaveCurrentChannelRequest()` to call `leaveUserChannel()`.
- Update `handleGetCurrentChannelRequest()` to read `instance.currentUserChannel` only.
- Update `handleBroadcastRequest()` so when `payload.channelId` is absent it uses `instance.currentUserChannel`.
- Do not call user-channel join logic from `handleAddContextListener()` when `channelId` is an app channel.
- Replace `getInstancesOnChannel()` or add a new selector for app-channel fan-out. Recommended selector:
  - `getInstancesWithContextListenerOnChannel(state, channelId, contextType)`
  - It should derive app-channel recipients from context listeners registered with that channel, not from user-channel membership.
- Keep user-channel current-context replay behavior only for user channels. App-channel listener registration must not auto-deliver prior context.

**Test scenarios to add before changing implementation:**
- `Scenario: App channel listener does not change current user channel`
  - App1 joins user channel `one`.
  - App1 creates/gets app channel `workflow`.
  - App1 adds a context listener on `workflow`.
  - App1 calls `getCurrentChannel`.
  - Expect channel `one`, not `workflow`.
- `Scenario: Default broadcast still uses joined user channel after app channel listener registration`
  - App1 joins user channel `one`.
  - App2 joins user channel `one` and listens for `fdc3.instrument`.
  - App1 adds an app-channel listener on `workflow`.
  - App1 broadcasts without `channelId`.
  - Expect App2 receives the user-channel broadcast.
- `Scenario: App channel broadcast still reaches app channel listeners`
  - App2 listens on app channel `workflow`.
  - App1 broadcasts on `workflow`.
  - Expect App2 receives the broadcast.

**Estimated scope:** Medium

## Checkpoint: Channel Semantics

- [ ] App-channel and user-channel features pass.
- [ ] No regression in broadcast/current-context behavior.
- [ ] Review `FDC3_2_2_COMPLIANCE_REVIEW.md` and mark channel blockers complete if satisfied.

## Phase 2: Private Channels And Cleanup

### Task 2: Implement PrivateChannel catch-all lifecycle listeners

**Description:** Support FDC3 2.2 `PrivateChannel.addEventListener(null, handler)` so one listener receives all private-channel lifecycle events.

**Acceptance criteria:**
- [ ] Null listener receives `addContextListener`, `unsubscribe`, and `disconnect` lifecycle events.
- [ ] Explicit lifecycle listeners still behave as before.
- [ ] Unsupported private-channel event types still return an error.

**Verification:**
- [ ] Add Cucumber scenarios in `private-channel.feature`.
- [ ] Run `npm run test -w @finos/sail-desktop-agent`.

**Dependencies:** None

**Files likely touched:**
- `packages/sail-desktop-agent/src/core/handlers/dacp/private-channel-handlers.ts`
- `packages/sail-desktop-agent/src/core/state/types.ts`
- `packages/sail-desktop-agent/src/core/state/mutators/private-channel.ts`
- `packages/sail-desktop-agent/test/features/channels/private-channel.feature`
- `packages/sail-desktop-agent/test/step-definitions/private-channel.steps.ts`

**Detailed implementation notes:**
- Add explicit catch-all lifecycle listener storage to `PrivateChannel`, recommended:
  - `lifecycleListeners: Record<string, PrivateChannelLifecycleListener>`
- A catch-all listener must be created only when `message.payload.listenerType` is `null` or `undefined`.
- Do not continue resolving null to `"addContextListener"`.
- Add mutators:
  - `addPrivateChannelLifecycleListener(state, channelId, listenerId, instanceId)`
  - `removePrivateChannelLifecycleListener(state, channelId, listenerId)`
- Update notification helpers so catch-all listeners receive:
  - `privateChannelOnAddContextListenerEvent`
  - `privateChannelOnUnsubscribeEvent`
  - `privateChannelOnDisconnectEvent`
- Update unsubscribe logic to search and remove catch-all listener IDs as well as typed listener IDs.
- Keep typed listener behavior unchanged.

**Test scenarios to add before implementation:**
- `Scenario: Null PrivateChannel event listener receives all lifecycle events`
  - App2 adds a null event listener on private channel.
  - App1 adds a private-channel context listener.
  - App1 unsubscribes that context listener.
  - App1 disconnects from the private channel.
  - Expect App2 receives addContextListener, unsubscribe, and disconnect lifecycle events.
- `Scenario: Explicit PrivateChannel event listeners still receive only their event type`

**Estimated scope:** Small

### Task 3: Route heartbeat timeout through full cleanup

**Description:** Align heartbeat timeout cleanup with WCP6Goodbye and transport disconnect cleanup to prevent leaked listeners, pending intents, private-channel state, and heartbeat timers.

**Acceptance criteria:**
- [ ] Heartbeat timeout clears instance state, event listeners, context listeners, private-channel connections, pending intents, and heartbeat state.
- [ ] Cleanup does not introduce circular import initialization risk.
- [ ] Cucumber no longer needs process-level forced exit for heartbeat timers.

**Verification:**
- [ ] Add focused Vitest cleanup coverage.
- [ ] Run `npm run test -w @finos/sail-desktop-agent`.

**Dependencies:** None

**Files likely touched:**
- `packages/sail-desktop-agent/src/core/handlers/dacp/heartbeat-handlers.ts`
- `packages/sail-desktop-agent/src/core/handlers/dacp/index.ts`
- `packages/sail-desktop-agent/src/core/handlers/dacp/wcp-handlers.ts`
- `packages/sail-desktop-agent/test/features/infrastructure/heartbeat.feature`
- `packages/sail-desktop-agent/test/support/hooks.ts`

**Detailed implementation notes:**
- First extract cleanup out of `handlers/dacp/index.ts` to remove the circular import with `wcp-handlers.ts`.
- Recommended new file: `packages/sail-desktop-agent/src/core/handlers/dacp/cleanup.ts`.
- Move `cleanupDACPHandlers()` to `cleanup.ts`.
- Export it from `handlers/dacp/index.ts` only as a re-export, not as the owning implementation.
- Update `wcp-handlers.ts` to import cleanup from `./cleanup`.
- Update heartbeat timeout to call shared cleanup instead of `removeInstance()` directly.
- Because `heartbeat-handlers.ts` currently does not have enough context to call cleanup safely, choose one of these explicit designs:
  - Preferred: pass a cleanup callback into `startHeartbeat(instanceId, context)` through the existing `DACPHandlerContext`, e.g. `cleanupInstance(instanceId)`.
  - Acceptable: import `cleanupDACPHandlers` from `./cleanup` and call it with the existing context if doing so does not create a cycle.
- Ensure cleanup stops the heartbeat exactly once. Avoid recursive cleanup if `cleanupDACPHandlers()` calls `stopHeartbeat()`.
- Remove or replace `test/support/hooks.ts` forced `process.exit(0)` only after tests prove heartbeat intervals are cleared.

**Vitest cleanup test shape:**
- Arrange a `DesktopAgent` with short heartbeat interval/timeout.
- Seed a connected instance with:
  - a context listener
  - a DA event listener
  - a private channel connection/listener
  - a pending intent entry if practical
  - heartbeat state
- Let heartbeat timeout fire or invoke the timeout path through a test hook.
- Assert all state associated with the instance is gone.

**Estimated scope:** Medium

## Checkpoint: Lifecycle Safety

- [ ] Private-channel features pass.
- [ ] Heartbeat features pass.
- [ ] No forced process exit is needed to complete Cucumber.
- [ ] Review `FDC3_2_2_COMPLIANCE_REVIEW.md` and mark lifecycle blockers complete if satisfied.

## Phase 3: Hardening And Documentation

### Task 4: Harden untrusted payload logging

**Description:** Redact DACP/WCP logging so full context payloads and raw messages are not logged by default.

**Acceptance criteria:**
- [ ] Logs include only safe metadata: message type, request/event IDs, instance IDs, context type, and boolean flags.
- [ ] Full `payload.context` and raw invalid messages are not stringified by default.
- [ ] Comments accurately describe the logging behavior.

**Verification:**
- [ ] Add logger tests with sensitive context payloads.
- [ ] Run `npm run test -w @finos/sail-desktop-agent`.

**Dependencies:** None

**Files likely touched:**
- `packages/sail-desktop-agent/src/core/handlers/dacp/index.ts`
- `packages/sail-desktop-agent/src/core/handlers/dacp/wcp-handlers.ts`
- `packages/sail-desktop-agent/src/core/dacp-protocol/dacp-utils.ts`
- `packages/sail-desktop-agent/src/browser/wcp/wcp-message-routing.ts`
- `packages/sail-desktop-agent/src/browser/wcp/message-port-transport.ts`

**Detailed implementation notes:**
- Create a small helper, for example `summarizeDACPMessage(message)`, that returns only:
  - `type`
  - `requestUuid`
  - `responseUuid`
  - `eventUuid`
  - `sourceInstanceId`
  - `destinationInstanceId`
  - `contextType`
  - `intent`
  - boolean flags such as `hasContext`, `hasPayload`
- Replace full-message logging in router and WCP bridge with the summary helper.
- Do not log raw invalid messages; log `typeof message`, detected `type` if present, and reason for rejection.
- Remove `fullMessage: JSON.stringify(...)` from `MessagePortTransport`.
- Update the `logDACPMessage()` comment so it accurately says metadata-only logging.
- Add tests using a context with a fake sensitive field, e.g. `accountNumber: "SECRET-123"`, and assert the logger never receives that value.

**Estimated scope:** Small to Medium

### Task 5: Fix public docs and package drift

**Description:** Align docs and examples with the actual package name, current file layout, and injectable validation architecture.

**Acceptance criteria:**
- [ ] README install/import examples use `@finos/sail-desktop-agent`.
- [ ] README architecture tree matches current files.
- [ ] README describes validation as injectable rather than shipped Zod validation.
- [ ] `src/index.ts` examples use the package name from `package.json`.

**Verification:**
- [ ] Run `npm run validate -w @finos/sail-desktop-agent`.

**Dependencies:** None

**Files likely touched:**
- `packages/sail-desktop-agent/README.md`
- `packages/sail-desktop-agent/src/index.ts`

**Detailed implementation notes:**
- Replace every `@finos/fdc3-sail-desktop-agent` reference with `@finos/sail-desktop-agent`.
- In README "Key Features", replace "Built with TypeScript and Zod validation" with "Built with TypeScript and injectable DACP/schema validation".
- Update the README directory tree:
  - `src/core/desktop-agent.ts`
  - `src/core/state/{types,initial-state,selectors,mutators}`
  - `src/browser/browser-desktop-agent.ts`
  - `src/browser/wcp/*`
  - `src/transports/in-memory-transport.ts`
- Ensure examples import browser helpers from `@finos/sail-desktop-agent/browser`.
- Ensure examples import transports from `@finos/sail-desktop-agent/transports`.

**Estimated scope:** Small

### Task 6: Add platform integration contract tests

**Description:** Prove the host platform supplies the responsibilities intentionally delegated by the pure desktop-agent package.

**Acceptance criteria:**
- [ ] Platform tests cover real transport composition.
- [ ] Platform tests cover validator injection.
- [ ] Platform tests cover app launcher, intent resolver UI, channel selector UI, and app-facing `getAgent()` method binding.

**Verification:**
- [ ] Run the relevant `sail-platform-api` validation and tests.

**Dependencies:** Tasks 1-5 clarify the core contract

**Files likely touched:**
- `packages/sail-platform-api/**`
- `packages/sail-desktop-agent/FDC3_2_2_COMPLIANCE_REVIEW.md`

**Detailed implementation notes:**
- Create or update a platform integration test suite that composes `DesktopAgent` with real platform-provided pieces.
- Required assertions:
  - transport sends app requests to the DesktopAgent and routes agent responses back to the app
  - validator is always supplied in production composition and malformed messages are rejected
  - app launcher returns an `AppIdentifier` with `instanceId`
  - intent resolver UI callback is called when multiple handlers exist
  - channel selector UI is wired or explicitly marked unsupported by design
  - app-facing `getAgent()` returns objects whose public methods still work when destructured
- After these tests exist, update `FDC3_2_2_COMPLIANCE_REVIEW.md` platform-responsibility checkboxes.

**Estimated scope:** Medium

## Final Checkpoint

- [ ] `npm run validate -w @finos/sail-desktop-agent` passes.
- [ ] `npm run test -w @finos/sail-desktop-agent` passes.
- [ ] Relevant platform validation and tests pass.
- [ ] `packages/sail-desktop-agent/FDC3_2_2_COMPLIANCE_REVIEW.md` has been updated to mark completed blockers.
- [ ] Remaining non-blocking items are either fixed or explicitly deferred.
