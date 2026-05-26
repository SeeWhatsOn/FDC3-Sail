# PRD: Desktop Agent conformance gaps and release hardening (unplanned P1)

## Persona / user

- **Lead maintainer** gating FDC3 Sail v3 / `@finos/sail-desktop-agent` for release.
- **Conformance engineers** mapping FINOS 2.2 interop tests to in-repo BDD and tracking coverage.

## Goal / outcome

Close planning gaps not covered by `plans/prd-transport-platform-hardening.md` or `FDC3_2_2_REMEDIATION_PLAN.MD` so lifecycle cleanup, conformance evidence, validation boundaries, and test trust are explicit, testable, and schedulable.

## Relationship to other plans

| Existing plan | Overlap | This PRD |
|---------------|---------|----------|
| `FDC3_2_2_REMEDIATION_PLAN.MD` Task 3 | General heartbeat / `cleanupDACPHandlers` | Extends cleanup for **source** pending intents and **open-with-context** module state |
| `FDC3_2_2_REMEDIATION_PLAN.MD` Task 4 | Logging redaction | No duplicate — same goal |
| `FDC3_2_2_REMEDIATION_PLAN.MD` Task 6 | Platform validator + `getAgent()` | Validator wiring stays there; enum lock tests are **core** boundary tests here |
| `plans/prd-transport-platform-hardening.md` | MessagePort / InMemory / platform channel API | No duplicate — WCP origin allowlist is complementary |

## In scope (PRD items)

### Lifecycle cleanup (finish P0 — prerequisite for P1 sign-off)

1. **`cleanupDACPHandlers` — raising instance** — When `sourceInstanceId` disconnects, clear `intents.pending`, reject/clear `pendingIntentPromises`, and cancel timeouts (Vitest + Cucumber already red in `disconnect-cleanup-p0.feature`).
2. **`cleanupDACPHandlers` — open-with-context** — On disconnect of source or target, clear `state.open.pendingWithContext` and module `pendingOpenWithContextTimeouts` (Vitest + Cucumber red).

### Memory and security boundaries

3. **`intents.history` bound** — Cap, TTL, or prune on resolve/disconnect so long-lived Desktop Agent sessions do not grow memory without bound.
4. **WCP1Hello origin policy** — Host-configurable allowlist (or deny-by-default) before allocating MessageChannel / temp connection; document interaction with WCP4 origin checks.
5. **WCP identity registry pruning** — Remove stale `InstanceIdentityRecord` entries after failed handshake, timeout, or disconnect on long-lived transports.

### Conformance and test trust

6. **App-channel context history matrix** — BDD scenarios for typed/untyped context history and ordering per FDC3 2.2 app-channel conformance (gaps called out in `FDC3_2_2_COMPLIANCE_REVIEW.MD`).
7. **FDC3 error enum boundary tests** — Lock `ResolveError`, `OpenError`, `ChannelError` (and related) on promise rejections and DACP error responses; reduce string casts at boundaries.
8. **Conformance traceability map** — Machine- or human-readable map: FINOS 2.2 conformance test ID → `test/features/**` scenario (and explicit “not implemented” rows).
9. **BDD through real WCP path** — At least one Cucumber or integration scenario via `createBrowserDesktopAgent` / `WCPConnector` (not only `MockTransport`), or document deferral to `sail-platform-api` Task 6 with acceptance criteria.
10. **WCP-validated instance id in tests** — Steps use `lastWcp5ValidatedInstanceId` (or equivalent) for validate / goodbye / disconnect when WCP reassigns instance ids.

### Tooling hygiene

11. **Vitest `retry: 1`** — Remove or narrow retries once transport/cleanup suites are stable so flakes are visible.

## Out of scope

- Transport half-open disconnect, MessagePort reentrancy, and platform `sendDACPMessageOnBehalfOf` (see `plans/prd-transport-platform-hardening.md`).
- FDC3 3.0 / `Channel.clearContext()` as a 2.2 blocker (per remediation plan scope correction).
- Electron `sail-electron` proxy build.
- Repo-wide ESLint/Prettier.

## Success criteria

- Vitest `src/core/handlers/dacp/__tests__/cleanup.test.ts` and Cucumber `disconnect-cleanup-p0.feature` are green without weakening assertions.
- `intents.history` size is bounded under a documented policy with a unit test.
- WCP1Hello from disallowed origins does not allocate a MessageChannel (or is rejected before bridge) when allowlist is configured.
- New or updated BDD covers app-channel history gaps; conformance map lists coverage status for each 2.2 pack test area.
- Error boundary tests fail if handler returns wrong enum string for representative operations.
- `npm run test -w @finos/sail-desktop-agent` passes with `retry: 0` (or documented exception for specific files).

## BDD scenarios (product-level)

```text
Given App1 has raised an intent to PortfolioApp and the intent is still pending
When App1 disconnects from the DA via production cleanup
Then the agent has no pending intents and no pending promise entries for that request

Given portfolioApp opened chartApp with context and chart has not added a listener
When the chart instance disconnects from the DA
Then open-with-context pending for that target is empty and no open-with-context timeouts remain scheduled

Given a Desktop Agent that has resolved many intents over time
When history exceeds the configured cap
Then oldest intent resolution records are pruned and memory stays bounded

Given WCP connector configured with allowedOrigins ["https://apps.example.com"]
When a WCP1Hello arrives from "https://evil.example.com"
Then no MessageChannel is created and no temp connection is registered

Given FINOS app-channel conformance scenario X for context history
When the matching Cucumber scenario in sail-desktop-agent runs
Then messaging assertions match the conformance pack expectation
```

## Risks / unknowns

- Whether WCP1 origin allowlist belongs in `WCPConnector` options vs. host shell only.
- Whether one BDD WCP scenario duplicates platform Task 6 integration tests (avoid triple maintenance).
- FINOS conformance pack version pin vs. `@conformance2.2` tags in features.

## Suggested vertical slices

| PRD # | Work item |
|-------|-----------|
| 1–2 | `plans/work-items/extend-cleanup-source-and-open-with-context.md` |
| 3 | `plans/work-items/cap-intents-history.md` |
| 4 | `plans/work-items/wcp1-hello-origin-allowlist.md` |
| 5 | `plans/work-items/wcp-identity-registry-pruning.md` |
| 6 | `plans/work-items/app-channel-context-history-bdd.md` |
| 7 | `plans/work-items/fdc3-error-enum-boundary-tests.md` |
| 8 | `plans/work-items/conformance-traceability-map.md` |
| 9 | `plans/work-items/bdd-wcp-integration-scenario.md` |
| 10 | `plans/work-items/align-wcp-instance-id-in-tests.md` |
| 11 | `plans/work-items/reduce-vitest-retry.md` |

## Reference

- `FDC3_2_2_COMPLIANCE_REVIEW.MD`
- `FDC3_2_2_REMEDIATION_PLAN.MD`
- `packages/sail-desktop-agent/test/features/apps/disconnect-cleanup-p0.feature`
- `AGENTS.md` (testing conventions, Cucumber tags)
