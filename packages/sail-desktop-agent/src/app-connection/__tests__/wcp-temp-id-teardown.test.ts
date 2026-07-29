/**
 * WCP-A reproduction (Slice 5a): a `WCP6Goodbye` that arrives before WCP4 completes is armed
 * against the temp handshake id. `updateConnectionMetadata` (the WCP5 remap) only cancels the
 * pending disconnect keyed by the *actual* instanceId and links `temp -> canonical` in
 * `wcpHandshakeRouting`, so the temp-keyed grace timer survives the handshake. When it fires it
 * resolves forward through the new link and tears down the connection whose handshake just
 * succeeded.
 *
 * See `.cursor/plans/sail-desktop-agent-review-remediation.md`, Slice 5a, finding WCP-A.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach } from "vite-plus/test"
import type { BrowserTypes } from "@finos/fdc3"
import type { DesktopAgent } from "../../agent/desktop-agent"
import type { SailDesktopAgent } from "../../agent/sail-desktop-agent"
import { AppInstanceState } from "../../state/types"
import { clearAllHeartbeatTimersForTesting } from "../../handlers/heartbeat/runtime"
import { beginWcpAppFirstConnect, connectWcpApp, flushAsyncDelivery } from "./wcp-edge-test-helpers"
import { createTestAgent, PORTFOLIO_APP } from "./wcp-desktop-agent.integration.fixtures"

function getTestConnector(agent: DesktopAgent): SailDesktopAgent["connector"] {
  return (agent as SailDesktopAgent).connector
}

/**
 * Schema-valid WCP6Goodbye, modeled on the message `disconnectAppByInstanceId` builds in
 * `wcp-connection-management.ts`. Slice-4's inbound validation gate in `bridgeAppPort` runs
 * before the WCP6 early-return, so a malformed goodbye here would be dropped for the wrong
 * reason and the test would "pass" without ever arming the temp-keyed grace timer.
 */
function createWCP6Goodbye(): BrowserTypes.WebConnectionProtocol6Goodbye {
  return {
    type: "WCP6Goodbye",
    payload: undefined,
    meta: {
      timestamp: new Date(),
    },
  } as unknown as BrowserTypes.WebConnectionProtocol6Goodbye
}

describe("WCP temp-id teardown escalation (WCP-A)", () => {
  const activeAgents: DesktopAgent[] = []

  afterEach(() => {
    clearAllHeartbeatTimersForTesting()
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }
  })

  it("does not tear down the canonical instance when WCP6Goodbye arrives on the temp id before WCP4 completes", async () => {
    const agent = createTestAgent({ disconnectGracePeriod: 25 })
    activeAgents.push(agent)
    const connector = getTestConnector(agent)

    const disconnectedInstanceIds: string[] = []
    connector.on("appDisconnected", instanceId => {
      disconnectedInstanceIds.push(instanceId)
    })

    // Start the handshake through WCP3 but stop before WCP4 — the connection is still keyed by
    // the temp id (bridgeAppPort resolves transportToInstanceId, which is temp-{uuid} until the
    // WCP5 remap runs).
    const session = beginWcpAppFirstConnect(agent, {
      connectionAttemptUuid: "wcp-a-goodbye-before-wcp4-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    // Goodbye arrives while still temp-keyed: handleWCP6Goodbye arms
    // pendingDisconnects[temp-{uuid}].
    session.appPort.postMessage(createWCP6Goodbye())
    await flushAsyncDelivery()

    // Complete the handshake. updateConnectionMetadata cancels pendingDisconnects[actual] (a
    // no-op here — nothing is armed under the actual id yet) but never looks at
    // pendingDisconnects[temp], so the temp-keyed timer from the goodbye above keeps running.
    await session.postFirstConnectWcp4()
    const { canonicalInstanceId } = await session.completeFirstConnect()

    // Wait comfortably past the 25ms grace period (real timer — no fake-timer wind-forward,
    // since MessagePort delivery needs real task turns).
    await new Promise(resolve => setTimeout(resolve, 150))
    await flushAsyncDelivery()

    // Proof this fails for the real reason, not a timeout or a dropped/never-received message:
    // the surviving temp-keyed timer fired, resolved forward through the temp -> canonical
    // handshake-routing link, and tore down the *canonical* instance whose handshake succeeded.
    expect(disconnectedInstanceIds).not.toContain(canonicalInstanceId)
    expect(connector.getConnection(canonicalInstanceId)).toBeDefined()
    expect(agent.getState().instances[canonicalInstanceId]?.state).toBe(AppInstanceState.CONNECTED)
  })

  it("still disconnects the canonical instance when WCP6Goodbye arrives after the handshake remap (guard)", async () => {
    const agent = createTestAgent({ disconnectGracePeriod: 25 })
    activeAgents.push(agent)
    const connector = getTestConnector(agent)

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "wcp-a-goodbye-after-remap-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    expect(agent.getState().instances[connected.canonicalInstanceId]?.state).toBe(
      AppInstanceState.CONNECTED,
    )

    // Goodbye now arrives keyed by the canonical id (the remap already ran) — this is
    // legitimate teardown and must keep working once WCP-A is fixed.
    connected.appPort.postMessage(createWCP6Goodbye())
    await flushAsyncDelivery()

    await new Promise(resolve => setTimeout(resolve, 150))
    await flushAsyncDelivery()

    expect(connector.getConnection(connected.canonicalInstanceId)).toBeUndefined()
    expect(agent.getState().instances[connected.canonicalInstanceId]).toBeUndefined()
  })

  // Guard: "handshake timeout still prunes a never-validated temp connection" (see plan Slice 5a
  // acceptance criteria) is intentionally NOT covered here. createTestAgent hard-codes
  // handshakeTimeout: 30_000 in wcp-desktop-agent.integration.fixtures.ts with no override knob,
  // and the instructions for this test require not touching that fixture. Exercising it for real
  // would mean a 30s-plus test; skipped rather than weakened into a fake-timer test that doesn't
  // match this file's real-timer MessagePort delivery style.
})
