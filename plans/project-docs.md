# Project docs

## PRD source

- `plans/prd-transport-platform-hardening.md` — derived from `REDACTED`
- `plans/prd-desktop-agent-conformance-gaps.md` — unplanned P1: cleanup extensions, conformance BDD, validator/history/WCP policy, test trust
- Original review notes: `.cursor/issues-discovered.md`
- FDC3 review / remediation: `FDC3_2_2_COMPLIANCE_REVIEW.MD`, `FDC3_2_2_REMEDIATION_PLAN.MD`

## Architecture

- **In-memory transport pair** (`createInMemoryTransportPair`) bridges Desktop Agent ↔ platform in the browser; used by `createBrowserDesktopAgent()`.
- **MessagePort transport** connects iframe apps via WCP; `WCPConnector` owns routing, `disconnectApp()` tears down instance ↔ transport maps.
- **Platform API** (`@finos/sail-platform-api`) wraps `DesktopAgent` for Sail UI; must not bypass WCP validation or impersonate apps via raw DACP.
- **DACP messages** live in `packages/sail-desktop-agent/src/core/dacp-protocol/dacp-messages.ts`.

## Conventions

- See root `AGENTS.md`: Node 24+, `npm test`, Cucumber in `@finos/sail-desktop-agent`.
- No test-only methods on production types; prefer production disconnect paths in tests.
- BDD tags: `@conformance2.2`, functional area tags per AGENTS.md.

## Reference paths


| Area                   | Path                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------- |
| InMemoryTransport      | `packages/sail-desktop-agent/src/transports/in-memory-transport.ts`                |
| InMemory tests         | `packages/sail-desktop-agent/src/transports/__tests__/in-memory-transport.test.ts` |
| MessagePortTransport   | `packages/sail-desktop-agent/src/browser/wcp/message-port-transport.ts`            |
| WCP disconnect         | `packages/sail-desktop-agent/src/browser/wcp/wcp-connection-management.ts`         |
| WCP routing            | `packages/sail-desktop-agent/src/browser/wcp/wcp-message-routing.ts`               |
| Platform browser agent | `packages/sail-platform-api/src/sail-browser-desktop-agent.ts`                     |
| Platform channels      | `packages/sail-platform-api/src/sail-platform.ts`                                  |
| DACP message unions    | `packages/sail-desktop-agent/src/core/dacp-protocol/dacp-messages.ts`              |


## Out of scope for transport PRD only

See `plans/prd-desktop-agent-conformance-gaps.md` for desktop-agent lifecycle and conformance items.

- High-frequency FDC3 broadcast / market-data fanout; backpressure or batching in `InMemoryTransport` (defer unless product requires streaming over FDC3).
- Electron `sail-electron` transport proxy build fix.
- ESLint / Prettier repo-wide cleanup.

## Work items (conformance / lifecycle PRD)

| Slug | Focus |
|------|--------|
| `extend-cleanup-source-and-open-with-context` | **Verified red:** source pending + open-with-context target cleanup |
| `cap-intents-history` | Bound `intents.history` (append-only today) |
| `wcp1-hello-origin-allowlist` | Pre-WCP4 origin policy |
| `wcp-identity-registry-pruning` | **Investigate** inner identity map pruning |
| `app-channel-context-history-bdd` | **Gap-fill** app-channel BDD (not greenfield) |
| `fdc3-error-enum-boundary-tests` | **Extend** error enum coverage (partial today) |
| `conformance-traceability-map` | FINOS 2.2 → Cucumber map |
| `bdd-wcp-integration-scenario` | Real WCP path or defer to platform Task 6 |
| `align-wcp-instance-id-in-tests` | **Investigate** heartbeat/WCP test hygiene first |
| `reduce-vitest-retry` | `retry: 0` after transport + cleanup green |

Remediation Tasks 1–2 and partial Task 3 are **not** duplicated here — see PRD relationship table.

