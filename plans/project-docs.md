# Project docs

## Planning index

| Track | PRD | Status on `v3-pre` |
|-------|-----|-------------------|
| **Active** | `plans/prd-toolbox-conformance-v5-follow-up.md` | v5 follow-up; teardown + WCP + blocked findIntent |
| **Active** | `plans/prd-fdc3-3-0-dual-version-support.md` | Epic + 9 child work items (`epic-fdc3-3-0-dual-version`) |
| **Remediation** | `FDC3_2_2_REMEDIATION_PLAN.MD` | Tasks 1–2 done; Task 3 partial; platform Task 6 open |
| **Delivered** | Browser preset host API | See **Delivered work index** — BHA slugs; PRD deleted 2026-06-21 |
| **Delivered** | Desktop Agent state hardening | PRD-04a–j done; optional `reorganize-core-handlers-colocate-state` only |

## Planning policy (2026-06-20, updated 2026-06-21)

- **Active queue:** `plans/work-items/` only.
- **Delivered work:** recorded in active PRD **Work item retention** sections and the **Delivered work index** below; work item and completed PRD files are **deleted** (not archived).
- **Human review gate:** `waiting_on_user` in work item frontmatter ≡ `staged` in generic ww-work-items skill; this repo uses `waiting_on_user` per `plans/WORKFLOW.md`.

## Active work items (2026-06-21)

| Slug | Status | Track |
|------|--------|-------|
| `epic-toolbox-conformance-v5-follow-up` | approved | TV5 |
| `fix-harness-finOs-session-teardown` | waiting_on_user | TV5-01 — lifecycle merged; close-context + manual v6 |
| `extend-wcp-channel-delivery-integration-tests` | waiting_on_user | TV5-02 — implementation complete |
| `fix-findintent-raise-intent-oracle` | blocked | TV5-03–05 merged |
| `epic-fdc3-3-0-dual-version` | draft | F30 |
| `audit-fdc3-3-0-handler-delta` | draft | F30-01 spike |
| `add-fdc3-3-0-local-types-and-dep-upgrade` | draft | F30-07 |
| `wire-open-request-context-metadata` | draft | F30-03 |
| `wire-broadcast-intent-metadata-3-0` | draft | F30-04 |
| `add-fdc3-3-0-channel-metadata-apis` | draft | F30-06 |
| `configurable-fdc3-version-advertisement` | draft | F30-09 |
| `document-fdc3-2-2-3-0-dual-version` | draft | F30-11 |
| `expand-conformance3-0-bdd-coverage` | draft | F30-08 |
| `record-fdc3-3-0-toolbox-baseline` | blocked | F30-10 — FINOS npm 3.x |
| `reorganize-core-handlers-colocate-state` | draft | optional state-hardening hygiene |

**Count:** 15 work items (2 epics, 12 tasks, 1 spike).

## Delivered work index

Slugs only — implementation is on `v3-pre`; details were in deleted PRDs/work items.

**Composable package:** `define-desktop-agent-package-architecture`, `promote-desktop-agent-host-contracts`, `add-top-level-browser-desktop-agent-preset`, `reorganize-desktop-agent-runtime-folders`, `align-sail-platform-wrapper-with-desktop-agent-preset`, `update-conformance-harness-desktop-agent-api`, `update-consume-sail-desktop-agent-skill`, `simplify-browser-desktop-agent-facade-api`, `align-package-readme-browser-facade-examples`, `reconcile-downstream-browser-facade-consumers`

**Conformance gaps (P0–P1):** `extend-cleanup-source-and-open-with-context`, `cap-intents-history`, `wcp1-hello-origin-allowlist`, `wcp-identity-registry-pruning`, `app-channel-context-history-bdd`, `fdc3-error-enum-boundary-tests`, `conformance-traceability-map`, `bdd-wcp-integration-scenario`, `align-wcp-instance-id-in-tests`, `reduce-vitest-retry`

**Release P2:** `dacp-wcp-log-redaction`, `align-readme-package-and-validation-docs`, `centralize-implementation-metadata-defaults`, `fix-in-memory-transport-test-timing`

**Transport hardening:** `fix-in-memory-transport-half-open-disconnect`, `fix-in-memory-transport-send-failures`, `add-in-memory-transport-lifecycle-tests`, `document-in-memory-transport-constraints`, `fix-messageport-disconnect-reentrancy`, `fix-messageport-error-disconnect-cleanup`, `fix-messageport-bound-listeners`, `decide-messageport-messageerror-policy`, `replace-dacp-impersonation-with-channel-api`

**Toolbox burn-down:** `conformance-bdd-blind-spot-audit`, `fix-app-metadata-desktop-agent-field`, `fix-intent-discovery-displayname-dedupe`, `investigate-launcher-wcp-instance-id`, `bind-host-instance-id-at-wcp4`, `fix-cucumber-raise-intent-launch-correlation`, `toolbox-bdd-metadata-assertions`, `context-metadata-conformance-bdd`, `harness-toolbox-rerun-baseline`, `toolbox-conformance-burn-down`

**State hardening:** `wire-wcp5-connected-instance-lifecycle`, `consolidate-temp-instance-id-resolver`, `remove-dead-instance-state-denormalization`, `user-channels-runtime-ssot`, `collapse-app-directory-to-functions`, `move-wcp-temp-id-alias-to-agent-state`, `audit-host-channel-reactivity-read-apis`, `document-desktop-agent-singleton-and-reactivity`, `epic-desktop-agent-state-hardening` (epic coordinator deleted 2026-06-21)

**Browser preset host API:** `add-browser-host-controller-composition`, `promote-browser-intent-resolver-controller`, `add-browser-channels-controller`, `add-browser-apps-controller`, `document-browser-preset-host-controllers`, `epic-browser-preset-host-api` (PRD deleted 2026-06-21)

**Toolbox v4 wave:** see `plans/prd-toolbox-conformance-v5-follow-up.md` **Work item retention**

**Browser-first DA simplification (BFDA):** see `plans/prd-browser-first-desktop-agent-simplification.md` **Work item retention** — delivered 2026-06-21: transport spike (`BrowserDaEdgeLink` + `DacpResponseDispatcher` decision), WCP routing guard tests, browser preset edge link + `createWCPClient` removal, handler `DacpResponseDispatcher`, SailPlatform/sail-web grouped host controllers. **Open:** docs (BFDA-06), observability hooks (BFDA-07).

**Toolbox v5 partial (TV5-01 hygiene slice):** `harness-instance-lifecycle` — `prepareLaunchedHostInstance` + `disconnectHarnessInstance` merged on `v3-pre` (2026-06); close-context handshake still open under `fix-harness-finOs-session-teardown`

## PRD source

- Active PRDs: `plans/prd-toolbox-conformance-v5-follow-up.md`, `plans/prd-fdc3-3-0-dual-version-support.md`, `plans/prd-browser-first-desktop-agent-simplification.md`
- Attribution: `conformance-test-failure-review.md`, `conformance-report-v*.txt`
- FDC3 review / remediation: `FDC3_2_2_COMPLIANCE_REVIEW.MD`, `FDC3_2_2_REMEDIATION_PLAN.MD`

## Architecture

- **Browser DA edge link** (`BrowserDaEdgeLink` / `createBrowserDesktopAgentEdgeLink`) wires in-tab Desktop Agent ↔ WCP connector in `createBrowserDesktopAgent()`; per-app **MessagePort** remains the app boundary.
- **Grouped host controllers** (`channels`, `intentResolver`, `apps`) on the browser preset and `SailPlatform`; sail-web subscribes through them — not raw `WCPConnector` for normal host UI.
- **Platform API** (`@finos/sail-platform-api`) wraps the browser preset; channel changes use `channels.changeAppChannel` or platform delegates.
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
