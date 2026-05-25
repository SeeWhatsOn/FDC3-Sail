# FDC3 2.2 Compliance Review: Sail Desktop Agent

Review target: `packages/sail-desktop-agent`

Review date: 2026-05-13

Primary standard source: `fdc3-expert/FDC3_knowledge.txt`, especially:

- `api/conformance/Overview.md`
- `api/conformance/Basic-Tests.md`
- `api/conformance/App-Channel-Tests.md`
- `api/conformance/User-Channel-Tests.md`
- `api/conformance/Intents-Tests.md`
- `api/conformance/Metadata-Tests.md`
- `api/conformance/Open-Tests.md`
- `api/ref/Channel.md`
- `api/ref/PrivateChannel.md`
- `api/ref/Errors.md`
- `api/ref/Events.md`
- `api/ref/GetAgent.md`
- `api/ref/Metadata.md`
- `api/ref/Types.md`
- `api/specs/browserResidentDesktopAgents.md`
- `api/specs/desktopAgentCommunicationProtocol.md`
- `api/specs/preloadDesktopAgents.md`
- `api/specs/webConnectionProtocol.md`
- `api/supported-platforms.md`

Status legend:

- Pass: implemented and covered well enough for this first pass.
- Gap: implementation appears to miss or violate an FDC3 2.2 requirement.
- Needs test: behavior may be implemented, but the current test evidence is weak or missing.
- Needs platform integration: correct for the pure core to delegate, but the host platform must provide it.
- Optional cleanup: not a direct spec blocker, but should be cleaned before relying on the package as production-quality infrastructure.
- Not applicable to pure core: belongs to the app-facing proxy, preload, host shell, or conformance harness rather than this package.

## Linked Remediation Plan

The implementation follow-up is tracked in `packages/sail-desktop-agent/FDC3_2_2_REMEDIATION_PLAN.md`.

- [ ] Remediation plan complete.
- [ ] Channel semantics blockers resolved.
- [ ] Private-channel and cleanup blockers resolved.
- [ ] Logging, docs, and platform integration follow-ups resolved or explicitly deferred.

## Executive Summary

`@finos/sail-desktop-agent` has the right high-level shape for a pure, composable Desktop Agent. The core is environment-agnostic, DACP handlers are routed behind a transport abstraction, browser WCP code is separated under `src/browser`, and the host can inject the app launcher, app directory, validator, logger, user channels, implementation metadata, and intent resolver.

The first-pass review does not clear the package as fully FDC3 2.2 conformant yet. The most important blockers are user-channel state being conflated with app-channel participation, incomplete PrivateChannel 2.2 null-event-listener behavior, heartbeat timeout cleanup not using full DACP cleanup, and a few production-readiness issues around untrusted payload logging and stale public docs.

Version correction: `Channel.clearContext()` and `contextCleared` appear in newer FDC3 docs, but not in the exact FDC3 `v2.2` `Channel.md` or `App-Channel-Tests.md`. They should not be treated as FDC3 2.2 blockers unless Sail explicitly chooses to implement newer API behavior.

## Requirement Checklist

### Basic, GetAgent, And Binding

- [x] Pass: Core exposes an environment-agnostic `DesktopAgent` and browser composition helpers.
  - Spec source: `api/ref/GetAgent.md`, `api/supported-platforms.md`, `api/specs/webConnectionProtocol.md`.
  - Implementation evidence: `src/index.ts`, `src/core/index.ts`, `src/core/desktop-agent.ts`, `src/browser/browser-desktop-agent.ts`.
  - Test evidence: `test/features/basic/basic.feature`, `src/browser/__tests__/wcp-connector.test.ts`.

- [x] Pass: `getInfo` returns FDC3 implementation metadata with `fdc3Version`, `provider`, `providerVersion`, optional features, and originating app metadata where known.
  - Spec source: `api/conformance/Basic-Tests.md`, `api/conformance/Metadata-Tests.md`, `api/ref/Metadata.md`.
  - Implementation evidence: `src/core/handlers/dacp/app-handlers.ts`.
  - Test evidence: `test/features/basic/basic.feature`, `test/features/apps/apps.feature`.

- [ ] Needs platform integration: App-facing `getAgent()` and public API method binding are mostly supplied by `@finos/fdc3` proxy/preload code, not by this pure core.
  - Spec source: `api/ref/GetAgent.md`, `api/supported-platforms.md`.
  - Implementation evidence: `src/browser/wcp/*`, `src/browser/browser-desktop-agent.ts`.
  - Follow-up: document that app-facing binding and `getAgent()` compatibility are delegated to `@finos/fdc3` / platform proxy code unless this package starts exposing app-facing API objects.
  - Test follow-up: add an integration test in the platform/proxy layer for destructured `DesktopAgent`, `Channel`, `PrivateChannel`, and `IntentResolution` methods.

- [ ] Optional cleanup: default implementation metadata is inconsistent across paths.
  - Implementation evidence: `src/core/desktop-agent.ts` defaults `providerVersion` to `3.0.0`; `src/core/handlers/dacp/wcp-handlers.ts` falls back to `0.0.1`; `src/core/handlers/dacp/app-handlers.ts` falls back to `0.0.0`.
  - Follow-up: make implementation metadata required by platform composition or centralize one default constant used by all paths.

### User Channels

- [x] Pass: `getUserChannels`, `joinUserChannel`, `leaveCurrentChannel`, `getCurrentChannel`, broadcast, current context delivery on join, and `userChannelChanged` event paths exist.
  - Spec source: `api/conformance/User-Channel-Tests.md`, `api/ref/Channel.md`, `api/ref/Events.md`.
  - Implementation evidence: `src/core/handlers/dacp/channel-handlers.ts`, `src/core/handlers/dacp/context-handlers.ts`, `src/core/handlers/dacp/event-handlers.ts`, `src/core/state/mutators/instance.ts`.
  - Test evidence: `test/features/channels/user-channels.feature`, `test/features/context/broadcast.feature`, `test/features/context/event-listeners.feature`.

- [ ] Gap: user-channel membership and app-channel listener participation are both represented by `AppInstance.currentChannel`.
  - Spec source: `api/conformance/User-Channel-Tests.md`, `api/conformance/App-Channel-Tests.md`, `api/ref/Channel.md`.
  - Implementation evidence: `src/core/state/types.ts`, `src/core/state/mutators/instance.ts`, `src/core/state/selectors/instance.ts`, `src/core/handlers/dacp/channel-handlers.ts`, `src/core/handlers/dacp/context-handlers.ts`.
  - Why it matters: `getCurrentChannel()` is a user-channel API, but adding a listener on an app channel can set `currentChannel` to an app channel. Default `broadcast()` and `leaveCurrentChannel()` can then act on the wrong concept.
  - Test follow-up: join a user channel, add an app-channel context listener, then assert `getCurrentChannel()` still reports the user channel and default `broadcast()` still uses that user channel.
  - Implementation follow-up: separate user-channel membership from app-channel subscription/routing state.

### App Channels

- [x] Pass: app channels can be created, are isolated, case-sensitive, cannot collide with user channels, and do not auto-replay prior context to `Channel.addContextListener`.
  - Spec source: `api/conformance/App-Channel-Tests.md`, `api/ref/Channel.md`.
  - Implementation evidence: `src/core/handlers/dacp/channel-handlers.ts`, `src/core/handlers/dacp/context-handlers.ts`, `src/core/state/mutators/channel.ts`.
  - Test evidence: `test/features/channels/app-channels.feature`.

- [ ] Not applicable to pure FDC3 2.2 scope: `Channel.clearContext()` and `contextCleared`.
  - Version check: exact FDC3 `v2.2` `api/ref/Channel.md` does not include `clearContext`, and exact FDC3 `v2.2` `api/conformance/App-Channel-Tests.md` does not include `ACClearContext`.
  - Note: newer/next docs do include `clearContext(contextType?: string): Promise<void>` and `contextCleared`, so this can be tracked as a future-version or Sail extension item.
  - Follow-up: omit from FDC3 2.2 remediation unless the product intentionally wants newer API support.

- [ ] Needs test: full app-channel current-context history matrix should be locked against the FDC3 conformance tests.
  - Spec source: `api/conformance/App-Channel-Tests.md`.
  - Test evidence: `test/features/channels/app-channels.feature` covers multiple types and untyped lookup, but not every conformance ordering/history variant.
  - Follow-up: add targeted scenarios for typed/untyped context history and listener ordering.

### Context And Broadcast

- [x] Pass: malformed context is rejected for broadcast/open/intent paths that were inspected.
  - Spec source: `api/ref/Errors.md`, `api/conformance/Intents-Tests.md`, `api/conformance/Open-Tests.md`.
  - Implementation evidence: `src/core/handlers/dacp/utils/context-validation.ts`, `src/core/handlers/dacp/context-handlers.ts`, `src/core/handlers/dacp/app-handlers.ts`, `src/core/handlers/dacp/intent-handlers/*`.
  - Test evidence: `test/features/context/broadcast.feature`, `test/features/apps/apps.feature`, `test/features/intents/*.feature`.

- [x] Pass: open-with-context waits for a new instance listener before resolving.
  - Spec source: `api/conformance/Open-Tests.md`, `api/specs/desktopAgentCommunicationProtocol.md`.
  - Implementation evidence: `src/core/handlers/dacp/utils/open-with-context.ts`, `src/core/handlers/dacp/app-handlers.ts`.
  - Test evidence: `test/features/apps/apps.feature`.

- [ ] Needs test: context listener cleanup after heartbeat timeout is not proven and likely incomplete.
  - Spec source: `api/specs/desktopAgentCommunicationProtocol.md`.
  - Implementation evidence: heartbeat timeout directly removes the instance in `src/core/handlers/dacp/heartbeat-handlers.ts`, while full cleanup is centralized in `src/core/handlers/dacp/index.ts`.
  - Follow-up: add a regression test that heartbeat timeout removes context listeners, event listeners, private-channel connections, heartbeat state, pending intents, and app instance state consistently.

### Private Channels

- [x] Pass: private channels can be created, broadcast to, disconnected, and protected from `getOrCreateChannel`.
  - Spec source: `api/ref/PrivateChannel.md`, `api/conformance/Intents-Tests.md`.
  - Implementation evidence: `src/core/handlers/dacp/private-channel-handlers.ts`, `src/core/handlers/dacp/context-handlers.ts`, `src/core/handlers/dacp/channel-handlers.ts`.
  - Test evidence: `test/features/channels/private-channel.feature`.

- [ ] Gap: `PrivateChannel.addEventListener(null, handler)` is not implemented as a catch-all lifecycle listener.
  - Spec source: `api/conformance/Intents-Tests.md`, `api/ref/PrivateChannel.md`, `api/ref/Events.md`.
  - Implementation evidence: `src/core/handlers/dacp/private-channel-handlers.ts` resolves null/undefined listener type to `addContextListener`.
  - Test evidence: current feature coverage only registers explicit `addContextListener`, `unsubscribe`, and `disconnect`.
  - Test follow-up: add a scenario where `addEventListener(null, handler)` receives add-context-listener, unsubscribe, and disconnect events.
  - Implementation follow-up: store catch-all private-channel lifecycle listeners or register the same listener in all three lifecycle buckets.

- [ ] Needs test: private channel returned from intent result and "private channel is not an app channel" conformance flows are only partially represented in this package.
  - Spec source: `api/conformance/Intents-Tests.md`.
  - Test evidence: `test/features/channels/private-channel.feature`, `test/features/intents/intent-result.feature`.
  - Follow-up: add intent-based private-channel lifecycle tests that mirror the 2.2 conformance pack rather than relying on direct test harness references.

### Intents

- [x] Pass: intent discovery, raise-intent, raise-intent-for-context, target app/instance, resolver cancellation, delivery failure, and result retrieval are broadly covered.
  - Spec source: `api/conformance/Intents-Tests.md`, `api/ref/Errors.md`, `api/ref/Metadata.md`.
  - Implementation evidence: `src/core/handlers/dacp/intent-handlers/*`.
  - Test evidence: `test/features/intents/find-intent.feature`, `test/features/intents/raise-intent.feature`, `test/features/intents/raise-intent-with-context.feature`, `test/features/intents/intent-result.feature`.

- [ ] Needs platform integration: user-facing intent resolver UI is correctly injected rather than hard-coded in core.
  - Spec source: `api/specs/browserResidentDesktopAgents.md`, `api/specs/webConnectionProtocol.md`.
  - Implementation evidence: `DesktopAgentConfig.requestIntentResolution` in `src/core/desktop-agent.ts`; WCP resolver bridge in `src/browser/wcp/wcp-intent-resolver.ts`; browser factory wiring in `src/browser/browser-desktop-agent.ts`.
  - Follow-up: `sail-platform-api` must supply production resolver UI behavior and cancellation semantics.

- [ ] Needs test: richer app-directory intent matrices from the conformance pack are not fully mirrored.
  - Spec source: `api/conformance/Intents-Tests.md`.
  - Follow-up: add a matrix-driven Cucumber feature with multiple apps, intents, context types, result types, app-channel results, and private-channel results.

### Apps, Open, Instances, And Metadata

- [x] Pass: `open`, unknown app, launch failures, open-with-context, reconnect/find-instances, and app metadata flows are present.
  - Spec source: `api/conformance/Open-Tests.md`, `api/conformance/Metadata-Tests.md`, `api/ref/Metadata.md`, `api/ref/Errors.md`.
  - Implementation evidence: `src/core/handlers/dacp/app-handlers.ts`, `src/core/app-directory/app-directory-manager.ts`, `src/core/interfaces/app-launcher.ts`.
  - Test evidence: `test/features/apps/apps.feature`, `test/features/apps/disconnect-cleanup.feature`, `src/core/app-directory/__tests__/app-directory-manager.test.ts`.

- [ ] Needs platform integration: actual application launch behavior is intentionally delegated to `AppLauncher`.
  - Spec source: `api/conformance/Open-Tests.md`.
  - Implementation evidence: `src/core/interfaces/app-launcher.ts`, `src/core/handlers/dacp/app-handlers.ts`.
  - Follow-up: `sail-platform-api` or the host runtime must guarantee app launch, timeout, identity registration, and window/process lifecycle behavior.

- [ ] Needs test: app launch timeout/error strings should be checked directly against FDC3 standard enum messages.
  - Spec source: `api/ref/Errors.md`, `api/conformance/Open-Tests.md`.
  - Follow-up: add tests that assert `AppNotFound`, `AppTimeout`, `ErrorOnLaunch`, and `MalformedContext` exactly where the standard requires those messages.

### DACP, WCP, Browser Resident DA, And Preload

- [x] Pass: browser WCP1-6 handshake and WCP4 identity validation are implemented in a separate browser bridge.
  - Spec source: `api/specs/webConnectionProtocol.md`, `api/specs/browserResidentDesktopAgents.md`, `api/specs/desktopAgentCommunicationProtocol.md`.
  - Implementation evidence: `src/browser/wcp/wcp-connector.ts`, `src/browser/wcp/wcp1-3-handshake.ts`, `src/browser/wcp/wcp-message-routing.ts`, `src/core/handlers/dacp/wcp-handlers.ts`.
  - Test evidence: `src/browser/__tests__/wcp-connector.test.ts`, `src/core/__tests__/desktop-agent-wcp-routing.test.ts`.

- [x] Pass: WCP4 origin/identity validation checks `identityUrl`, `actualUrl`, and original `MessageEvent.origin`.
  - Spec source: `api/specs/webConnectionProtocol.md`.
  - Implementation evidence: `src/browser/wcp/wcp-connector.ts`, `src/core/handlers/dacp/wcp-handlers.ts`.
  - Test evidence: `src/browser/__tests__/wcp-connector.test.ts`, `src/core/__tests__/desktop-agent-wcp-routing.test.ts`.

- [ ] Gap: heartbeat timeout does not use the same cleanup path as WCP6Goodbye / transport disconnect.
  - Spec source: `api/specs/desktopAgentCommunicationProtocol.md`.
  - Implementation evidence: `src/core/handlers/dacp/heartbeat-handlers.ts` calls `removeInstance`; `src/core/handlers/dacp/wcp-handlers.ts` and `src/core/handlers/dacp/index.ts` use `cleanupDACPHandlers`.
  - Impact: pending intents, event listeners, private channels, listener indexes, and open-with-context state may outlive dead instances.
  - Test follow-up: add a heartbeat-timeout cleanup test that seeds each state category and verifies all are removed.
  - Implementation follow-up: route heartbeat timeout through full DACP cleanup without circular imports.

- [ ] Optional cleanup: WCP identity registry can grow for a long-lived transport.
  - Implementation evidence: `src/core/handlers/dacp/wcp-handlers.ts` uses `WeakMap<Transport, Map<string, InstanceIdentityRecord>>`; inner maps are not pruned on cleanup.
  - Follow-up: delete identity records on WCP6Goodbye/heartbeat cleanup or colocate identity registry with instance lifecycle cleanup.

- [ ] Optional cleanup: `MessagePortTransport.disconnect()` removes newly-bound listener functions, not the functions it registered.
  - Implementation evidence: `src/browser/wcp/message-port-transport.ts`.
  - Follow-up: store bound listener fields and use them for both add/remove.

- [ ] Optional cleanup: `wcp-handlers.ts` imports `cleanupDACPHandlers` from the DACP barrel that also imports `wcp-handlers.ts`.
  - Implementation evidence: `src/core/handlers/dacp/wcp-handlers.ts`, `src/core/handlers/dacp/index.ts`.
  - Follow-up: move cleanup into a small independent module to avoid circular initialization risk.

### Errors

- [x] Pass: handlers generally send FDC3 enum-style error strings through DACP error responses.
  - Spec source: `api/ref/Errors.md`, `api/conformance/Open-Tests.md`, `api/conformance/Intents-Tests.md`.
  - Implementation evidence: `src/core/errors/fdc3-errors.ts`, `src/core/handlers/dacp/utils/dacp-response-utils.ts`, handler modules under `src/core/handlers/dacp`.
  - Test evidence: existing Cucumber error-path coverage across `test/features/apps`, `test/features/intents`, `test/features/channels`, and `test/features/context`.

- [ ] Needs test: standard enum messages should be locked at the boundary for every promise-rejection surface.
  - Spec source: `api/ref/Errors.md`.
  - Follow-up: add tests for exact error messages for `ChannelError`, `OpenError`, `ResolveError`, `ResultError`, and `BridgingError` across non-happy paths.

- [ ] Optional cleanup: some fallback errors use string casts such as `"ListenerError" as ChannelError`.
  - Implementation evidence: `src/core/handlers/dacp/event-handlers.ts`, `src/core/handlers/dacp/context-handlers.ts`.
  - Follow-up: verify these are legal wire values for the target DACP schema or introduce a local typed error enum for listener failures.

### Security And Hardening

- [ ] Required: reduce logging of untrusted DACP/WCP payloads.
  - Spec source: security review requirement from the local `security-and-hardening` skill; WCP/DACP messages are untrusted app-originating input.
  - Implementation evidence: `src/core/handlers/dacp/index.ts` logs full messages; `src/core/handlers/dacp/wcp-handlers.ts` logs WCP payloads; `src/core/dacp-protocol/dacp-utils.ts` logs full metadata while claiming filtering; `src/browser/wcp/wcp-message-routing.ts` logs invalid raw messages; `src/browser/wcp/message-port-transport.ts` logs full broadcast messages.
  - Impact: context payloads can contain client, trade, portfolio, or other sensitive data.
  - Test follow-up: add logger tests that assert redacted/metadata-only fields are emitted for invalid and valid messages.
  - Implementation follow-up: log type, request/event IDs, instance IDs, context type, and high-level flags only; never stringify full `payload.context` at info/debug by default.

- [ ] Needs platform integration: schema validation is injectable but optional.
  - Spec source: `api/specs/desktopAgentCommunicationProtocol.md`, `api/ref/Errors.md`.
  - Implementation evidence: `DesktopAgentConfig.validator` in `src/core/desktop-agent.ts`; validation gate in `src/core/handlers/dacp/index.ts`.
  - Follow-up: production composition in `sail-platform-api` should always inject a validator based on `@finos/fdc3-schema` or equivalent and test malformed-message rejection.

### Documentation And Packaging

- [ ] Required: README and source examples use the wrong package name.
  - Implementation evidence: `package.json` name is `@finos/sail-desktop-agent`; `README.md` and `src/index.ts` examples use `@finos/fdc3-sail-desktop-agent`.
  - Follow-up: align docs and examples with the published package name.

- [ ] Required: README overstates shipped validation.
  - Implementation evidence: `README.md` says "Built with TypeScript and Zod validation"; `package.json` has no `zod` dependency and validation is injected.
  - Follow-up: say validation is pluggable/injectable and identify where the host should provide it.

- [ ] Optional cleanup: README directory structure is stale.
  - Implementation evidence: `README.md` references old filenames such as `sail-desktop-agent.ts` and registry files that are now mutators/selectors.
  - Follow-up: refresh the architecture tree and public API examples.

### Test Infrastructure

- [x] Pass: there is broad BDD coverage for app, channel, context, intent, private-channel, event, and heartbeat flows.
  - Test evidence: `test/features/**/*.feature`.

- [ ] Required: Cucumber relies on `process.exit(0)` because heartbeat timers survive scenarios.
  - Implementation evidence: `test/support/hooks.ts`.
  - Impact: tests can mask missing teardown and make watch/IDE runs brittle.
  - Follow-up: expose/consume full cleanup APIs so scenarios can stop agents and heartbeats deterministically.

- [ ] Optional cleanup: Vitest retries can hide flakiness.
  - Implementation evidence: `vitest.config.ts` sets `retry: 1`.
  - Follow-up: remove retries after timer/test isolation issues are fixed.

- [ ] Optional cleanup: some transport tests use fixed short sleeps.
  - Implementation evidence: `src/transports/__tests__/in-memory-transport.test.ts`.
  - Follow-up: await explicit delivery promises instead of time-based waits.

## Test Coverage Map

Existing coverage that should remain part of the conformance gate:

- `test/features/basic/basic.feature`: smoke and core API surface.
- `test/features/apps/apps.feature`: `open`, app lookup, open-with-context, reconnect, launch errors, timeout, malformed context, `findInstances`.
- `test/features/apps/disconnect-cleanup.feature`: disconnect cleanup and reconnect behavior.
- `test/features/channels/user-channels.feature`: user channel join/leave/listen/broadcast and negative cases.
- `test/features/channels/app-channels.feature`: app channel creation, isolation, listener behavior, current context.
- `test/features/channels/private-channel.feature`: private channel broadcast, lifecycle events, disconnect, negative cases.
- `test/features/context/broadcast.feature`: broadcast and malformed context behavior.
- `test/features/context/event-listeners.feature`: DA-level `userChannelChanged` event listeners.
- `test/features/intents/*.feature`: intent discovery, raising, target selection, resolver paths, results, malformed contexts, delivery failures.
- `test/features/infrastructure/heartbeat.feature`: heartbeat response/no-response/goodbye behavior.
- `src/browser/__tests__/wcp-connector.test.ts`: WCP handshake, routing, invalid messages, origin preservation.
- `src/core/__tests__/desktop-agent-wcp-routing.test.ts`: WCP identity routing and rejection.
- `src/core/app-directory/__tests__/app-directory-manager.test.ts`: app directory parsing, lookup, URL validation, fetch failures.
- `src/transports/__tests__/in-memory-transport.test.ts`: transport mechanics.

Missing or weak coverage to add before fixing behavior:

- User channel membership must survive app-channel listener registration.
- Default `broadcast()` must use current user channel, not last app channel touched.
- `PrivateChannel.addEventListener(null, handler)` catch-all lifecycle behavior.
- Heartbeat timeout full cleanup across state registries and pending promises.
- Exact FDC3 error enum strings for all promise-rejection/error response surfaces.
- Redacted logging of untrusted messages.
- Platform/proxy destructured method binding tests.
- Rich conformance-style intent matrix for channel/private-channel result flows.

## Senior Code Quality Gate

Verdict: request changes before claiming full FDC3 2.2 conformance.

Required fixes:

- Separate user-channel membership from app-channel listener/routing state. The current single `currentChannel` model is too easy to break and already conflicts with the API meaning in `api/ref/Channel.md`.
- Implement PrivateChannel null lifecycle listeners.
- Align heartbeat timeout with full cleanup.
- Redact untrusted payload logging.
- Fix public docs/package name drift.

KISS/DRY/readability notes:

- The core/package layering is good and mostly simple.
- The state mutation style is consistent.
- Several comments are useful, but some are stale or misleading, especially "with sensitive data filtering" in `dacp-utils.ts` and README architecture paths.
- Repeated generated-type casts are understandable given schema/type mismatch comments, but they should be isolated and tested because wire shape correctness is security and interoperability critical.
- The circular import around `cleanupDACPHandlers` should be removed before cleanup is reused from heartbeat.

## QA Findings

Critical / Required:

- User/app channel state conflation.
- PrivateChannel catch-all lifecycle event listener missing.
- Heartbeat timeout incomplete cleanup.
- Full untrusted payload logging.
- Cucumber forced `process.exit(0)` masking teardown gaps.

Needs test:

- Exact standard error strings.
- Cleanup after heartbeat timeout.
- Private-channel intent-result conformance lifecycle.
- App-channel context history/clear semantics.
- Platform method binding.

Needs platform integration:

- Production transport.
- App launcher lifecycle.
- App directory loading/population.
- Intent resolver UI.
- Channel selector UI.
- Schema validator injection.
- App-facing `getAgent()` / method binding proxy.
- Accurate implementation metadata.

Optional cleanup:

- MessagePort listener remove bug.
- WCP identity map pruning.
- DACP barrel circular import.
- README stale tree and Zod claim.
- Vitest retry and timer-based tests.

## Recommended Remediation Tasks

### Task 1: Separate user-channel membership from app-channel participation

Acceptance criteria:

- `getCurrentChannel()` only reports user-channel membership.
- `leaveCurrentChannel()` only leaves the current user channel.
- App-channel listeners still receive channel broadcasts.
- Default `broadcast()` uses current user channel only.

Verification:

- New regression tests for user-channel plus app-channel interaction.
- `npm run test -w @finos/sail-desktop-agent`.

Dependencies: none, but do before larger channel refactors.

Estimated scope: Medium.

### Task 2: Implement PrivateChannel null lifecycle listeners

Acceptance criteria:

- `PrivateChannel.addEventListener(null, handler)` receives add-context-listener, unsubscribe, and disconnect lifecycle events.
- Explicit lifecycle listeners still behave as before.
- Unsupported lifecycle event type still returns an error.

Verification:

- New Cucumber scenarios in `test/features/channels/private-channel.feature`.
- `npm run test -w @finos/sail-desktop-agent`.

Dependencies: none.

Estimated scope: Small.

### Task 3: Route heartbeat timeout through full cleanup

Acceptance criteria:

- Heartbeat timeout clears the same state as WCP6Goodbye/transport disconnect.
- No pending intent promise, event listener, context listener, private channel, heartbeat, or app instance state is left behind for the timed-out instance.
- Tests no longer need process-level forced exit for heartbeat timers.

Verification:

- Add focused Vitest coverage for cleanup state.
- Run `npm run test -w @finos/sail-desktop-agent`.

Dependencies: none, but coordinate with circular import cleanup.

Estimated scope: Medium.

### Task 4: Harden logging and validation boundaries

Acceptance criteria:

- Logs contain message type, request/event IDs, instance IDs, context type, and high-level flags only.
- Full payload/context data is not logged by default.
- README documents that runtime schema validation is injected by platform composition.

Verification:

- Add logger tests with sensitive context payloads.
- Run `npm run test -w @finos/sail-desktop-agent`.

Dependencies: none.

Estimated scope: Small to Medium.

### Task 5: Fix public docs and packaging drift

Acceptance criteria:

- README install/import examples use `@finos/sail-desktop-agent`.
- README architecture tree matches current files.
- README accurately describes pluggable validation rather than shipped Zod validation.
- `src/index.ts` examples use the package name from `package.json`.

Verification:

- `npm run validate -w @finos/sail-desktop-agent`.

Dependencies: none.

Estimated scope: Small.

### Task 6: Add platform integration contract tests

Acceptance criteria:

- Platform composition tests prove real transport, validator, app launcher, intent resolver UI, channel selector UI, and app-facing `getAgent()` method binding.
- Pure-core package documents which requirements are host responsibilities.

Verification:

- Add tests in the platform package that composes this core.
- Run the platform package validation and tests.

Dependencies: Tasks 1-5 clarify core behavior.

Estimated scope: Medium.

## Verification Run During Review

- `npm run validate -w @finos/sail-desktop-agent`: shell reported exit code 0.
- `npm run test -w @finos/sail-desktop-agent`: shell reported exit code 0.

The shell session did not capture stdout for these commands, so this review records the exit codes but not detailed per-test output.

## Final First-Pass Verdict

The package is a strong foundation for a pure and composable FDC3 Desktop Agent, but it should not yet be presented as "full FDC3 2.2 compliance." The core abstraction is good; the main work is to close the channel-state/private-channel/cleanup gaps, harden logging, and make the docs and tests reflect the exact boundary between this package and `sail-platform-api`.
