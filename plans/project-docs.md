# Project docs

## PRD source

- `plans/prd-transport-platform-hardening.md` — derived from `REDACTED`
- Original review notes: `.cursor/issues-discovered.md`

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


## Out of scope for this workload

- High-frequency FDC3 broadcast / market-data fanout; backpressure or batching in `InMemoryTransport` (defer unless product requires streaming over FDC3).
- Electron `sail-electron` transport proxy build fix.
- ESLint / Prettier repo-wide cleanup.

