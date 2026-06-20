# Project docs

## Planning index

| Track | PRD | Status on `v3-pre` |
|-------|-----|-------------------|
| **Active** | `plans/prd-desktop-agent-state-hardening.md` | Mostly delivered; audit + docs remain |
| **Active** | `plans/prd-browser-preset-host-api.md` | Draft work items (host controllers) |
| **Active** | `plans/prd-toolbox-conformance-v5-follow-up.md` | v5 follow-up; teardown + WCP + blocked findIntent |
| **Remediation** | `FDC3_2_2_REMEDIATION_PLAN.MD` | Tasks 1–2 done; Task 3 partial; platform Task 6 open |

## Planning policy (2026-06-20)

- **Active queue:** `plans/work-items/` only.
- **Delivered work:** recorded in active PRD **Work item retention** sections and the **Delivered work index** below; work item and completed PRD files are **deleted** (not archived to `completed-prds/` or `completed-work-items/`).

## Delivered work index

Slugs only — implementation is on `v3-pre`; details were in deleted PRDs/work items.

**Composable package:** `define-desktop-agent-package-architecture`, `promote-desktop-agent-host-contracts`, `add-top-level-browser-desktop-agent-preset`, `reorganize-desktop-agent-runtime-folders`, `align-sail-platform-wrapper-with-desktop-agent-preset`, `update-conformance-harness-desktop-agent-api`, `update-consume-sail-desktop-agent-skill`, `simplify-browser-desktop-agent-facade-api`, `align-package-readme-browser-facade-examples`, `reconcile-downstream-browser-facade-consumers`

**Conformance gaps (P0–P1):** `extend-cleanup-source-and-open-with-context`, `cap-intents-history`, `wcp1-hello-origin-allowlist`, `wcp-identity-registry-pruning`, `app-channel-context-history-bdd`, `fdc3-error-enum-boundary-tests`, `conformance-traceability-map`, `bdd-wcp-integration-scenario`, `align-wcp-instance-id-in-tests`, `reduce-vitest-retry`

**Release P2:** `dacp-wcp-log-redaction`, `align-readme-package-and-validation-docs`, `centralize-implementation-metadata-defaults`, `fix-in-memory-transport-test-timing`

**Transport hardening:** `fix-in-memory-transport-half-open-disconnect`, `fix-in-memory-transport-send-failures`, `add-in-memory-transport-lifecycle-tests`, `document-in-memory-transport-constraints`, `fix-messageport-disconnect-reentrancy`, `fix-messageport-error-disconnect-cleanup`, `fix-messageport-bound-listeners`, `decide-messageport-messageerror-policy`, `replace-dacp-impersonation-with-channel-api`

**Toolbox burn-down:** `conformance-bdd-blind-spot-audit`, `fix-app-metadata-desktop-agent-field`, `fix-intent-discovery-displayname-dedupe`, `investigate-launcher-wcp-instance-id`, `bind-host-instance-id-at-wcp4`, `fix-cucumber-raise-intent-launch-correlation`, `toolbox-bdd-metadata-assertions`, `context-metadata-conformance-bdd`, `harness-toolbox-rerun-baseline`, `toolbox-conformance-burn-down`

**State hardening (partial):** `wire-wcp5-connected-instance-lifecycle`, `consolidate-temp-instance-id-resolver`, `remove-dead-instance-state-denormalization`, `user-channels-runtime-ssot`, `collapse-app-directory-to-functions`, `move-wcp-temp-id-alias-to-agent-state`

**Toolbox v4 wave:** see `plans/prd-toolbox-conformance-v5-follow-up.md` **Work item retention**

## PRD source

- Active PRDs: `plans/prd-*.md` (3 files)
- Attribution: `conformance-test-failure-review.md`, `conformance-report-v*.txt`
- FDC3 review / remediation: `FDC3_2_2_COMPLIANCE_REVIEW.MD`, `FDC3_2_2_REMEDIATION_PLAN.MD`

## Architecture

- **In-memory transport pair** (`createInMemoryTransportPair`) bridges Desktop Agent ↔ platform in the browser; used by `createBrowserDesktopAgent()`.
- **MessagePort transport** connects iframe apps via WCP; `WCPConnector` owns routing, `disconnectApp()` tears down instance ↔ transport maps.
- **Platform API** (`@finos/sail-platform-api`) wraps `DesktopAgent` for Sail UI; channel changes use typed platform APIs, not raw DACP impersonation.
- **DACP messages** live in `packages/sail-desktop-agent/src/core/dacp/`.

## Conventions

- See root `AGENTS.md`: Node 24+, `npm test`, Cucumber in `@finos/sail-desktop-agent`.
- No test-only methods on production types; prefer production disconnect paths in tests.
- BDD tags: `@conformance2.2`, functional area tags per AGENTS.md.

## Reference paths

| Area | Path |
|------|------|
| InMemoryTransport | `packages/sail-desktop-agent/src/transports/in-memory-transport.ts` |
| MessagePortTransport | `packages/sail-desktop-agent/src/app-connection/wcp/message-port-transport.ts` |
| WCP disconnect | `packages/sail-desktop-agent/src/app-connection/wcp/wcp-connection-management.ts` |
| WCP routing | `packages/sail-desktop-agent/src/app-connection/wcp/wcp-message-routing.ts` |
| Platform browser agent | `packages/sail-platform-api/src/sail-browser-desktop-agent.ts` |
| Platform channels | `packages/sail-platform-api/src/sail-platform.ts` |
