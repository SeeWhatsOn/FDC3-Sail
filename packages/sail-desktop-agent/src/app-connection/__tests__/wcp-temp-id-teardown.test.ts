/**
 * Regression tests for temp-handshake-id teardown escalation.
 *
 * Between WCP1 and WCP5 a connection is keyed by a temporary id (`temp-{connectionAttemptUuid}`).
 * `updateConnectionMetadata` remaps it to the canonical instanceId on WCP5 success and records a
 * `temp -> canonical` link in `wcpHandshakeRouting` so late handshake-keyed traffic still routes.
 * That link is what makes any *teardown* arriving keyed by the temp id dangerous: it resolves
 * forward and destroys the live connection instead of the dead handshake.
 *
 * Two such paths are covered here. Both were real defects found by code reading, each reproduced
 * as a failing test before being fixed. The guards are what keep them fixed:
 *
 *   1. A `WCP6Goodbye` arriving before WCP4 arms a grace timer under the temp id, because
 *      `bridgeAppPort` still resolves the port through `transportToInstanceId` at that point.
 *      Fixed in `updateConnectionMetadata`, which now cancels the temp-keyed pending disconnect
 *      as well as the canonical-keyed one.
 *   2. A WCP5 *failure* response is always addressed to the temp id, so pruning it resolved
 *      forward onto a connection an earlier successful handshake had established under that same
 *      temp id. Fixed by `BrowserAppConnection.disconnectHandshakeApp`, which disconnects the id
 *      it is given without resolving.
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
 * `wcp-connection-management.ts`. The inbound schema-validation gate in `bridgeAppPort` runs
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

describe("WCP6Goodbye arriving on a temp handshake id", () => {
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
    // legitimate teardown, and cancelling the temp-keyed timer must not suppress it.
    connected.appPort.postMessage(createWCP6Goodbye())
    await flushAsyncDelivery()

    await new Promise(resolve => setTimeout(resolve, 150))
    await flushAsyncDelivery()

    expect(connector.getConnection(connected.canonicalInstanceId)).toBeUndefined()
    expect(agent.getState().instances[connected.canonicalInstanceId]).toBeUndefined()
  })

  // KNOWN COVERAGE GAP: the third caller of the non-resolving disconnect — the WCP1 handshake
  // timeout in wcp1-3-handshake.ts, which prunes a connection that never completed WCP4 — has no
  // test here. createTestAgent hard-codes handshakeTimeout: 30_000 in
  // wcp-desktop-agent.integration.fixtures.ts with no override, so exercising it for real means a
  // 30s-plus test, and this file uses real timers because MessagePort delivery needs real task
  // turns. Add an override to that fixture if you touch handshake teardown again.
})

/**
 * A WCP5 failure response is always addressed to the temp handshake id: `sendFailureResponse`
 * falls back to `temp-{uuid}` because `getInboundInstanceId()` returns null on the browser edge.
 * If that temp id was already remapped to a canonical instanceId by an earlier successful
 * handshake, disconnecting it must not resolve forward through the `temp -> canonical`
 * handshake-routing link — that would tear down the live connection instead of the failed attempt.
 *
 * Reproduced by reusing the same `connectionAttemptUuid` for a second, mismatched-origin WCP4 on
 * an already-connected app's port: `bridgeAppPort` keys the message by the now-canonical transport
 * id (so enrichment finds the live connection and supplies `messageOrigin`), but
 * `DesktopAgent.handleWcpMessage` recomputes `tempInstanceId` from the message meta and hands the
 * handler a context addressed to the stale temp id.
 *
 * @vitest-environment jsdom
 */
describe("WCP5 failure addressed to an already-remapped temp id", () => {
  const activeAgents: DesktopAgent[] = []

  afterEach(() => {
    clearAllHeartbeatTimersForTesting()
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }
  })

  /**
   * Schema-valid WCP4ValidateAppIdentity reusing `connectionAttemptUuid`, with `identityUrl`
   * and `actualUrl` on different origins so `handleWcp4ValidateAppIdentity` fails the
   * origin-mismatch check before ever reaching the app-directory lookup.
   */
  function createMismatchedOriginWcp4(
    connectionAttemptUuid: string,
    identityUrl: string,
  ): BrowserTypes.WebConnectionProtocol4ValidateAppIdentity {
    return {
      type: "WCP4ValidateAppIdentity",
      meta: {
        connectionAttemptUuid,
        timestamp: new Date(),
      },
      payload: {
        identityUrl,
        actualUrl: "https://malicious.example.org/portfolio",
      },
    } as unknown as BrowserTypes.WebConnectionProtocol4ValidateAppIdentity
  }

  it("does not tear down the canonical instance when a WCP5 failure resolves the stale temp id forward", async () => {
    const agent = createTestAgent({ disconnectGracePeriod: 25 })
    activeAgents.push(agent)
    const connector = getTestConnector(agent)

    const disconnectedInstanceIds: string[] = []
    connector.on("appDisconnected", instanceId => {
      disconnectedInstanceIds.push(instanceId)
    })

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "wcp-b-remapped-temp-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    expect(agent.getState().instances[connected.canonicalInstanceId]?.state).toBe(
      AppInstanceState.CONNECTED,
    )

    // Second WCP4 on the now-connected port, reusing the same connectionAttemptUuid, with a
    // mismatched actualUrl origin. bridgeAppPort keys it by the canonical transport id (the
    // live connection), so it is genuinely entered — but handleWcpMessage recomputes the
    // routing context from temp-{connectionAttemptUuid}, which was already remapped.
    connected.appPort.postMessage(
      createMismatchedOriginWcp4(connected.connectionAttemptUuid, PORTFOLIO_APP.details.url),
    )
    await flushAsyncDelivery()

    // Proof this fails for the real reason, not a timeout or a dropped/never-received message:
    // the WCP5 failure response resolved temp -> canonical and tore down the live instance
    // whose handshake had already succeeded.
    expect(disconnectedInstanceIds).not.toContain(connected.canonicalInstanceId)
    expect(connector.getConnection(connected.canonicalInstanceId)).toBeDefined()
    expect(agent.getState().instances[connected.canonicalInstanceId]?.state).toBe(
      AppInstanceState.CONNECTED,
    )
  })

  it("still prunes the temp connection on a WCP5 failure for a genuinely unvalidated first handshake (guard)", async () => {
    const agent = createTestAgent({ disconnectGracePeriod: 25 })
    activeAgents.push(agent)
    const connector = getTestConnector(agent)

    const session = beginWcpAppFirstConnect(agent, {
      connectionAttemptUuid: "wcp-b-guard-unvalidated-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    expect(connector.getConnection(session.tempInstanceId)).toBeDefined()

    // WCP4 with mismatched origins fails identity validation before WCP5 success — the temp
    // connection here was never remapped, so pruning it is the legitimate handshake-timeout
    // contract this fix must preserve.
    session.appPort.postMessage(
      createMismatchedOriginWcp4(session.connectionAttemptUuid, PORTFOLIO_APP.details.url),
    )
    await flushAsyncDelivery()

    expect(connector.getConnection(session.tempInstanceId)).toBeUndefined()
  })
})
