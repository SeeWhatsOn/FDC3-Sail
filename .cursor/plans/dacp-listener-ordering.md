# Minimal Viable Delivery Plan: DACP Listener Ordering

Status: verified
Current slice: response-before-pending-open-delivery
Review/fix loops: 0

## Intent

- Outcome: Fix the open-with-context race where Sail delivers a pending `broadcastEvent` before the target app has processed `addContextListenerResponse`.
- User: FDC3 popup/iframe/app clients using the standard `@finos/fdc3` proxy through Sail's browser Desktop Agent.
- Success: A target app that registers a matching context listener receives the open-with-context payload and the source app only sees `openResponse` after the listener response has been sent to the target.
- Constraint: Keep the Desktop Agent host-agnostic; do not add popup/platform lifecycle state or redesign app instance lifecycle.
- Out of scope: Broad lifecycle refactors, new observability infrastructure, platform launcher rewrites, mutexes/locks, and client proxy changes.

## Simplicity Bias

- Reuse: Existing `AgentState.open.pendingWithContext`, `notifyContextListenerAdded`, `deliverOpenWithContext`, and DACP response helpers.
- Avoid: New lifecycle phases, new abstractions, new dependencies, and popup-specific Desktop Agent behavior.
- Architecture: Minimal protocol-ordering change in the add-context-listener flow, plus focused regression coverage around outbound message order.

## Slices

1. Response-before-pending-open delivery
   - Goal: Ensure normal `addContextListenerRequest` sends `addContextListenerResponse` to the registering app before flushing matched pending open-with-context `broadcastEvent` delivery.
   - Acceptance: For a pending open-with-context target, outbound messages are ordered as target `addContextListenerResponse`, target `broadcastEvent`, then source `openResponse`.
   - Verify: Add or update focused Vitest coverage in `@finos/sail-desktop-agent`; run the smallest targeted test command for the changed handler.
   - Likely files: `packages/sail-desktop-agent/src/handlers/broadcast/handlers.ts`, relevant tests under `packages/sail-desktop-agent/src/handlers/__tests__/` or nearby existing broadcast/open-with-context tests.

## Test Plan

- Unit: Focused handler test that seeds pending open-with-context, sends `addContextListenerRequest`, and asserts outbound order.
- Integration: Not required for MVP if the handler-level test proves ordering and existing WCP/open-with-context tests still pass.
- Manual/runtime: Not required for this slice; existing captured logs already prove the failing ordering.
- Not testing: Markdown/docs contracts, broad conformance toolbox run, popup lifecycle redesign.

## Review Plan

- Main-agent checks: Confirm diff stays limited to ordering fix plus focused regression test.
- Fresh-context review: Use a subagent because this is cross-boundary protocol ordering.
- Loop limit: Stop after three failed verify/review loops and ask whether to reduce scope or switch workflow.

## Risks

- Reordering could accidentally delay current-context delivery for user-channel listener registration; keep existing current-context delivery after `addContextListenerResponse`.
- Private channel add-context-listener has its own response ordering and is not the observed failing path; avoid changing it unless tests show the same issue.
- If tests assert internal helper calls instead of outbound message order, they may miss the real protocol contract.

## Evidence

- Same failing run showed target popup instance `66142a2e-4b11-41c9-9f42-b47e4612629a` throughout WCP5 and later DACP messages.
- DA logs showed source `openResponse` at `2026-07-07T21:43:41.091Z`.
- Popup logs showed target `addContextListenerResponse` for `fdc3.instrument` at `2026-07-07T21:43:41.097Z`.
- Current code calls `notifyContextListenerAdded(...)` before creating/sending `addContextListenerResponse`; `deliverOpenWithContext(...)` sends target `broadcastEvent` before source `openResponse`.

## Slice Checkpoints

- [x] Response-before-pending-open delivery: working | verified

## Verification Notes

- Changed normal `addContextListenerRequest` handling so `addContextListenerResponse` is sent to the registering app before matched pending open-with-context delivery is flushed.
- Added focused Vitest coverage proving outbound order: target `addContextListenerResponse`, target `broadcastEvent`, source `openResponse`.
- `nvm use 24` could not run because Node 24 is not installed in this shell; active Node/npm were `v25.9.0` / `11.12.1`.
- Passed from `packages/sail-desktop-agent`: `npx vitest run "src/handlers/__tests__/broadcast-stale-instance.test.ts"` (1 file, 3 tests).
- Failed with pre-existing unrelated errors: `npm run typecheck` (`message-port-transport.test.ts`, `harness-finos-teardown.test.ts`, `main.test.ts`).
- Failed with pre-existing unrelated errors: `npm run lint` (`message-port-transport.test.ts`, conformance harness tests, `dockview-popout.ts`).

## Review Notes

- Required: None from fresh-context review.
- Implementation diff stayed limited to the normal listener ordering fix, focused handler coverage, and this checkpoint update. Full `npm test` was not run because the requested acceptance was the smallest meaningful targeted handler test.
- Follow-up: Consider documenting the invariant near `notifyContextListenerAdded` if the final code path is still subtle.
- Follow-up: Non-production/mock dispatchers that throw during `sendDACPResponse` could prevent pending open delivery from flushing; production browser routing catches/logs MessagePort send failures, so this does not block the MVP.
- Ignore for MVP: OTEL instrumentation, broader lifecycle state, popup/platform redesign, and harness-level conformance regression.

## Parked Follow-ups

- Add harness-level conformance regression only if handler/integration coverage fails to catch a future regression.

## Known Limitations

- MVP targets the observed normal context listener path; private-channel listener readiness is left unchanged unless evidence shows the same ordering bug there.
