---
title: "Investigate launcher instanceId vs WCP5 canonical id"
slug: investigate-launcher-wcp-instance-id
kind: spike
type: bug
status: waiting_on_user
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/wcp-handlers.ts
  - packages/sail-desktop-agent/src/browser/wcp/wcp1-3-handshake.ts
  - packages/sail-conformance-harness/README.md
  - packages/sail-conformance-harness/src/app-launcher.ts
depends_on: []
integration_branch: v3-pre
branch: cursor/investigate-launcher-wcp-instance-id
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Document why AppLauncher.instanceId, iframe name, and WCP5 canonical instanceId diverge in harness/toolbox runs, and recommend the minimal fix contract for `bind-host-instance-id-at-wcp4`.

## User or system context

Largest toolbox failure cluster is AppTimeout / IntentDeliveryFailed from wrong instance routing. Cucumber fails `"uuid-0" sends validate` with "Did not find app instance uuid-0". Cross-origin conformance iframes cannot expose window.name to the host.

## Reference docs

- `plans/prd-toolbox-conformance-burn-down.md` (TB-04)
- `conformance-test-failure-review.md`
- `plans/work-items/conformance-harness-host.md`

## Parent context

From `plans/prd-toolbox-conformance-burn-down.md`: Spike before implementation; harness already sets iframe name=instanceId; WCP4 may mint unrelated UUID on first connect.

## Behavior spec

**Phase 1 — investigate**

Given the conformance harness opens an app via fdc3.open with AppLauncher returning instanceId X
When the app iframe completes WCP4/WCP5 handshake
Then logs correlate launcher X, iframe name, WCP5 instanceId, and findInstances() output

**Phase 2 — recommendation**

Given Phase 1 evidence
When the spike completes
Then `bind-host-instance-id-at-wcp4` work item has an updated behavior spec with chosen contract (pre-register, WCP4 payload, or agent change)

## Out of scope

- Implementing the fix (separate task `bind-host-instance-id-at-wcp4`)
- sail-web changes in this spike

## TypeScript interfaces

none

## Test guidance

Use harness debug logging (`logPayloadDetail: 'full'`) and optional Cucumber repro. Document findings in this work item `## Staged for review` or `## Blocked decisions`.

Deliverable via /ww-deliver: yes (spike; spawns or unblocks bind-host-instance-id-at-wcp4)

## Blocked decisions

None. Recommendation forwarded to `bind-host-instance-id-at-wcp4` behavior spec below.

## Loop history

- 2026-05-31: approved by human

## Staged for review

### Phase 1 findings (2026-05-31)

Harness spike `runHarnessOpenAndWcpHandshake` (Vitest) reproduces the divergence:

1. **launcherInstanceId** — `createHarnessAppLauncher` / `openResponse.appIdentifier.instanceId`
2. **iframeName** — panel `instanceId` (matches launcher; harness contract holds)
3. **wcp5InstanceId** — `WCP5ValidateAppIdentityResponse.payload.instanceId` (new UUID from `createAppInstance`)
4. **findInstancesInstanceIds** — contains WCP5 id only, not launcher id

Root cause: `handleWcp4ValidateAppIdentity` → `createAppInstance` always calls `crypto.randomUUID()` for first connect. WCP4 `instanceId` is only adopted when `canReuseInstanceIdentity` passes (existing state + identity registry + `sourceWindow` + matching `instanceUuid`). `fdc3.open` does not pre-register the launcher id in agent state.

Impact: open-with-context pending keyed on launcher id; DACP listeners on WCP5 id → `AppTimeout` / `IntentDeliveryFailed` in toolbox.

Debug: `[ConformanceHarness] instance-identity-correlation` log with `logPayloadDetail: 'full'` captures all four fields. See `packages/sail-conformance-harness/README.md`.

### Phase 2 recommendation

**Chosen contract: agent change at WCP4 with host pre-registration at open** (not WCP4-payload-only, not harness-only).

1. **At `openRequest` success** — after `appLauncher.launch`, call `connectInstance` (or equivalent) with launcher `instanceId`, `appId`, and a `pendingWcpValidation: true` flag so the id is reserved before the iframe connects.
2. **At WCP4 first connect** — when claimed `instanceId` matches a pending host-launched instance for the same `appId` and origin, adopt that id (set `instanceUuid` from payload or mint once) instead of `createAppInstance` random UUID. Keep strict reconnect validation for true reconnects.
3. **Cross-origin** — toolbox apps on `fdc3.finos.org` cannot set iframe `name`; pre-registration still allows WCP4 payload `instanceId` from session storage / FINOS get-agent to bind if the host passes the launcher id through open metadata (follow-up if needed).

Pre-register alone without WCP4 adoption is insufficient; WCP4-payload-only without pre-register fails when no state slot exists. Minimal surface: `app-handlers.ts` (open) + `wcp-handlers.ts` (WCP4 branch).

## Escalation notes

_(empty)_

## Learnings extracted

- [AGENTS.md candidate] On first connect after `fdc3.open`, WCP5 canonical `instanceId` is minted by `createAppInstance` unless `canReuseInstanceIdentity` passes; host `AppLauncher.instanceId` / iframe `name` are not adopted without bind-host fix (pre-register at open + WCP4 adoption).

## Phase audit

| Phase | Subagent | Registered subagent | Result |
|-------|----------|---------------------|--------|
| A RED | test-engineer | yes | RED — correlation tests fail on id divergence |
| B GREEN | implement-agent | yes | Tests green; bind-host spec updated |
| C Verify | verifier-agent | yes | FAIL scope (plans/); orchestrator re-ran tests PASS |
| D Review | code-reviewer | yes | VERDICT: PASS |
