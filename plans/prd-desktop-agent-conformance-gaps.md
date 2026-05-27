# PRD: Desktop Agent conformance gaps and release hardening (P1)

> Deferred hardening (logging, README, metadata defaults, platform integration pointers): see `plans/prd-desktop-agent-release-p2.md`.

## Persona / user

- **Lead maintainer** gating FDC3 Sail v3 / `@finos/sail-desktop-agent` for release.
- **Conformance engineers** mapping FINOS 2.2 interop tests to in-repo BDD and tracking coverage.

## Goal / outcome

Close planning gaps not covered by `plans/prd-transport-platform-hardening.md` or `FDC3_2_2_REMEDIATION_PLAN.MD` so remaining lifecycle cleanup, conformance evidence, validation boundaries, and test trust are explicit, testable, and schedulable.

## Relationship to other plans

| Existing plan | Status on `v3-pre` | This PRD |
|---------------|-------------------|----------|
| `FDC3_2_2_REMEDIATION_PLAN.MD` Task 1 (user vs app channel) | Largely implemented (`currentUserChannel`, revised BDD) | **Do not re-plan** — track completion via remediation checklist |
| `FDC3_2_2_REMEDIATION_PLAN.MD` Task 2 (PrivateChannel null listener) | Implemented (`lifecycleCatchAllListeners` + BDD) | **Do not re-plan** |
| `FDC3_2_2_REMEDIATION_PLAN.MD` Task 3 (heartbeat / `cleanupDACPHandlers`) | **Partially done** — heartbeat timeout and `disconnectInstance` call shared cleanup; hooks clear module timers | **Extends** cleanup for **source** pending intents and **open-with-context** (not a repeat of Task 3) |
| `FDC3_2_2_REMEDIATION_PLAN.MD` Task 4 (logging redaction) | Not done | **No duplicate** — same goal; implement via Task 4 |
| `FDC3_2_2_REMEDIATION_PLAN.MD` Task 6 (platform validator + `getAgent()`) | Validator exists in platform-api but not wired in `SailPlatform` | **No duplicate** for wiring; item 7 here is **core enum boundary tests** only |
| `plans/prd-transport-platform-hardening.md` | Draft work-items | **No duplicate** — MessagePort / InMemory / platform channel API; WCP origin allowlist here is complementary |

**Note:** `FDC3_2_2_REMEDIATION_PLAN.MD` references `packages/sail-desktop-agent/FDC3_2_2_COMPLIANCE_REVIEW.md`; the review file lives at repo root: `FDC3_2_2_COMPLIANCE_REVIEW.MD`.

## In scope (PRD items)

### Lifecycle cleanup (finish P0 — prerequisite for P1 sign-off)

1. **`cleanupDACPHandlers` — raising instance (source pending intents)** — When `sourceInstanceId` disconnects, clear matching `intents.pending` entries, reject/clear `pendingIntentPromises`, and cancel timeouts. **Verified:** Vitest + Cucumber red today; `cleanup.ts` only filters `targetInstanceId`.

2. **`cleanupDACPHandlers` — open-with-context (target disconnect, required)** — When the **target** instance disconnects, clear `state.open.pendingWithContext[targetInstanceId]` and module `pendingOpenWithContextTimeouts`. **Verified:** red tests today. **Follow-up (optional):** if the **source** instance disconnects while open-with-context is pending, cancel entries where `sourceInstanceId` matches — not covered by current red tests; add scenario before treating as required.

### Memory and security boundaries

3. **`intents.history` bound** — Cap, TTL, or prune on resolve/disconnect so long-lived Desktop Agent sessions do not grow memory without bound. **Verified:** `recordIntentResolution` still append-only.

4. **WCP1Hello origin policy** — Host-configurable allowlist before allocating MessageChannel / temp connection; document interaction with WCP4 origin checks. **Verified:** no allowlist in `WCPConnector` today.

5. **WCP identity registry pruning (investigate)** — `wcp-handlers` uses `identityMap.set` with no `delete`. Confirm whether stale `InstanceIdentityRecord` entries accumulate on long-lived transports (outer structure is `WeakMap<Transport, Map<...>>` — severity TBD). Plan investigation before treating as a confirmed leak.

### Conformance and test trust

6. **App-channel context history — fill conformance gaps** — Extend BDD for typed/untyped context history and ordering variants called out in `FDC3_2_2_COMPLIANCE_REVIEW.MD`. **Not greenfield:** `app-channels.feature` already has substantial coverage; this item closes **matrix gaps**, not “no app-channel tests.”

7. **FDC3 error enum boundary tests — extend and lock** — Strengthen tests so `ResolveError`, `OpenError`, `ChannelError` (and related) are asserted on promise rejections and DACP error responses. **Not greenfield:** many scenarios already cover e.g. `MalformedContext`, `NoAppsFound`; goal is **systematic boundary coverage**, fewer string casts.

8. **Conformance traceability map** — Human- or machine-readable map: FINOS 2.2 conformance test area / ID → `test/features/**` scenario, with rows marked covered | partial | missing | n/a. Distinct from `.cursor/plans/fdc3-conformance-progress_*.plan.md` (toolbox UI completion signal).

9. **BDD or integration through real WCP path** — At least one test via `createBrowserDesktopAgent` / `WCPConnector` (not only `MockTransport`), **or** explicit sign-off that `FDC3_2_2_REMEDIATION_PLAN.MD` Task 6 platform integration tests satisfy this for release.

10. **WCP / heartbeat test hygiene (investigate first)** — Some failures (e.g. multiple active heartbeat timers) may be due to **test design** (re-initializing `DesktopAgent`, duplicate validate) rather than product bug. Investigate with a minimal scenario (single agent, one validate, one goodbye/disconnect) before changing production code. Use `mockTransport.lastWcp5ValidatedInstanceId` where WCP assigns a canonical id.

### Tooling hygiene

11. **Vitest `retry: 1`** — Remove or narrow retries after cleanup and transport work items are green so flakes are visible. **Verified:** `vitest.config.ts` still has `retry: 1`.

## Out of scope

- Transport half-open disconnect, MessagePort reentrancy, and platform `sendDACPMessageOnBehalfOf` (see `plans/prd-transport-platform-hardening.md`).
- Re-opening remediation Tasks 1–2 (user channel, private channel) unless regression found.
- FDC3 3.0 / `Channel.clearContext()` as a 2.2 blocker (per remediation plan scope correction).
- Electron `sail-electron` proxy build.
- Repo-wide ESLint/Prettier.

## Success criteria

- Vitest `cleanup.test.ts` and Cucumber disconnect-cleanup scenarios for items 1–2 are green **without weakening assertions**.
- Optional: Cucumber scenarios tightened (e.g. heartbeat assertion only after validate; source-side open-with-context if required).
- `intents.history` bounded under a documented policy with a unit test.
- WCP1Hello from disallowed origins does not allocate a MessageChannel when allowlist is configured.
- Conformance map published; app-channel and error-enum gaps explicitly listed as partial vs missing.
- `npm run test -w @finos/sail-desktop-agent` passes with `retry: 0` (or documented exceptions).

## BDD scenarios (product-level)

```text
# Item 1 — required (red today)
Given App1 raised an intent to PortfolioApp and the intent is still pending (not yet resolved)
When App1 disconnects via disconnectInstance or WCP6Goodbye
Then the agent has no pending intents for that request

# Item 2 — required (red today)
Given portfolioApp opened chartApp with context and chart has not added a listener
When the chart target instance disconnects
Then open-with-context pending for that target is empty and no open-with-context timeouts remain

# Item 2 — optional follow-up
Given portfolioApp opened chartApp with context and is waiting on chart
When portfolioApp (source) disconnects before chart adds a listener
Then pending open-with-context for that open is cancelled and timeouts cleared

# Item 3
Given many intent resolutions recorded
When count exceeds configured cap
Then oldest history entries are pruned

# Item 4
Given WCP allowedOrigins ["https://apps.example.com"]
When WCP1Hello from "https://evil.example.com"
Then no MessageChannel is created
```

## Risks / unknowns

- WCP1 origin allowlist on `WCPConnector` vs. host shell only.
- Item 9 vs. Task 6 — avoid three overlapping integration suites without an owner.
- Item 5 severity after investigation may downgrade to optional cleanup.
- Item 10 may result in test-only changes, not product changes.

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

- `FDC3_2_2_COMPLIANCE_REVIEW.MD` (repo root)
- `FDC3_2_2_REMEDIATION_PLAN.MD`
- `packages/sail-desktop-agent/test/features/apps/disconnect-cleanup-p0.feature`
- `AGENTS.md` (testing conventions; prefer `disconnectInstance` / goodbye over manual cleanup shims)
