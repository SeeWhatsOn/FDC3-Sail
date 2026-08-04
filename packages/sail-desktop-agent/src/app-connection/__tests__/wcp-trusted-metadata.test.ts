/**
 * Trusted inbound meta: apps must not author `meta.messageOrigin` or `meta.source.appId`.
 * Origin comes from the WCP1-recorded connection; missing trusted origin clears the field.
 *
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it } from "vite-plus/test"
import type { BrowserTypes } from "@finos/fdc3"
import type { SailDesktopAgent } from "../../agent/sail-desktop-agent"
import { clearAllHeartbeatTimersForTesting } from "../../handlers/heartbeat/runtime"
import { connectWcpApp, TEST_ORIGIN } from "./wcp-edge-test-helpers"
import { createTestAgent, PORTFOLIO_APP } from "./wcp-desktop-agent.integration.fixtures"

const HOSTILE_ORIGIN = "https://evil.example"
const HOSTILE_APP_ID = "hostile-spoofed-app"

/**
 * Private on BrowserAppConnection — accessed only so these tests can assert the
 * agent-recorded meta without a production export.
 */
function enrichViaConnector(
  connector: SailDesktopAgent["appConnection"],
  message: BrowserTypes.WebConnectionProtocol4ValidateAppIdentity,
  instanceId: string,
): BrowserTypes.WebConnectionProtocol4ValidateAppIdentity {
  const enrich = (
    connector as unknown as {
      enrichMessageWithSource: (
        message: BrowserTypes.WebConnectionProtocol4ValidateAppIdentity,
        instanceId: string,
      ) => BrowserTypes.WebConnectionProtocol4ValidateAppIdentity
    }
  ).enrichMessageWithSource.bind(connector)
  return enrich(message, instanceId)
}

function createHostileWcp4(
  connectionAttemptUuid: string,
  identityUrl: string,
): BrowserTypes.WebConnectionProtocol4ValidateAppIdentity {
  return {
    type: "WCP4ValidateAppIdentity",
    meta: {
      connectionAttemptUuid,
      timestamp: new Date(),
      messageOrigin: HOSTILE_ORIGIN,
      source: { appId: HOSTILE_APP_ID, instanceId: "app-supplied-instance" },
    },
    payload: {
      identityUrl,
      actualUrl: identityUrl,
    },
  } as unknown as BrowserTypes.WebConnectionProtocol4ValidateAppIdentity
}

describe("enrichMessageWithSource trusted metadata", () => {
  const activeAgents: SailDesktopAgent[] = []

  afterEach(() => {
    clearAllHeartbeatTimersForTesting()
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }
  })

  it("replaces hostile messageOrigin and source.appId when the connection has a stored WCP1 origin", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)
    const connector = agent.appConnection

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "trusted-meta-with-origin-uuid",
      appId: PORTFOLIO_APP.appId,
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const stored = connector.getConnection(connected.validatedInstanceId)
    expect(stored?.messageOrigin).toBe(TEST_ORIGIN)

    const enriched = enrichViaConnector(
      connector,
      createHostileWcp4(connected.connectionAttemptUuid, PORTFOLIO_APP.details.url),
      connected.validatedInstanceId,
    )

    const meta = enriched.meta as {
      messageOrigin?: string
      source?: { appId?: string; instanceId?: string }
    }

    // Trusted WCP1 origin must win; app-supplied origin must not remain authoritative.
    expect(meta.messageOrigin).toBe(TEST_ORIGIN)
    expect(meta.messageOrigin).not.toBe(HOSTILE_ORIGIN)

    // Registry instanceId is fine; app-supplied appId must not be treated as trusted.
    expect(meta.source?.instanceId).toBe(connected.validatedInstanceId)
    expect(meta.source?.appId).not.toBe(HOSTILE_APP_ID)
    expect(meta.source?.appId).toBe(stored?.appId)
  })

  it("drops app-supplied messageOrigin when the connection has no stored origin", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)
    const connector = agent.appConnection

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "trusted-meta-no-origin-uuid",
      appId: PORTFOLIO_APP.appId,
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const stored = connector.connectionRegistry.connections.get(connected.validatedInstanceId)
    expect(stored).toBeDefined()
    // Simulate the invariant break: no trusted origin on the connection.
    ;(stored as { messageOrigin?: string }).messageOrigin = ""

    const enriched = enrichViaConnector(
      connector,
      createHostileWcp4(connected.connectionAttemptUuid, PORTFOLIO_APP.details.url),
      connected.validatedInstanceId,
    )

    const meta = enriched.meta as {
      messageOrigin?: string
      source?: { appId?: string }
    }

    // Absence of trusted origin must clear the field — never keep the app's value.
    expect(meta.messageOrigin).toBeUndefined()
    expect(meta.messageOrigin).not.toBe(HOSTILE_ORIGIN)
    expect(meta.source?.appId).not.toBe(HOSTILE_APP_ID)
  })
})
