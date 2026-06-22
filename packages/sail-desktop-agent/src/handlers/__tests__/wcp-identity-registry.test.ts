import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import type { BrowserTypes } from "@finos/fdc3"
import { createDesktopAgentWithTestConnection } from "../../../test/support/desktop-agent-test-harness"
import { cleanupDACPHandlers } from "../cleanup"
import { startHeartbeat } from "../heartbeat/handlers"
import {
  clearAllHeartbeatTimersForTesting,
  getActiveHeartbeatTimerCount,
} from "../heartbeat/runtime"
import {
  getInstanceIdentityCountForTesting,
  getInstanceIdentityMap,
  hasInstanceIdentityForTesting,
} from "../../app-connection/wcp/instance-identity-registry"
import { connectInstance, updateInstanceState } from "../../state/mutators"
import { AppInstanceState } from "../../state/types"
import { createInitialState } from "../../state/initial-state"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../default-user-channels"
import { createDACPTestContext } from "./test-context"
import { withResponseDispatcher } from "./test-context"
import { MockTransport } from "../../__tests__/utils/mock-transport"

const TEST_APP = {
  appId: "test-app",
  title: "Test App",
  type: "web" as const,
  details: { url: "https://example.com/app" },
}

function createWcp4Message(
  connectionAttemptUuid: string,
  overrides: Partial<BrowserTypes.WebConnectionProtocol4ValidateAppIdentity["payload"]> = {},
) {
  return {
    type: "WCP4ValidateAppIdentity",
    payload: {
      identityUrl: "https://example.com/app",
      actualUrl: "https://example.com/app",
      ...overrides,
    },
    meta: {
      connectionAttemptUuid,
      timestamp: new Date().toISOString(),
      messageOrigin: "https://example.com",
    },
  } as unknown as BrowserTypes.WebConnectionProtocol4ValidateAppIdentity
}

function createAgentWithTestConnection(options?: {
  heartbeatIntervalMs?: number
  heartbeatTimeoutMs?: number
}) {
  return createDesktopAgentWithTestConnection({
    apps: [TEST_APP],
    heartbeatIntervalMs: options?.heartbeatIntervalMs ?? 5000,
    heartbeatTimeoutMs: options?.heartbeatTimeoutMs ?? 15000,
  })
}

function getWcp5CanonicalInstanceId(
  connection: ReturnType<typeof createAgentWithTestConnection>["connection"],
  occurrence = 0,
): string {
  const wcp5Responses = connection.sentMessages.filter(
    message => (message as { type?: string }).type === "WCP5ValidateAppIdentityResponse",
  ) as Array<{ payload?: { instanceId?: string } }>
  const instanceId = wcp5Responses[occurrence]?.payload?.instanceId
  expect(instanceId).toBeDefined()
  return instanceId!
}

afterEach(() => {
  clearAllHeartbeatTimersForTesting()
  vi.useRealTimers()
})

describe("instance identity registry lifecycle", () => {
  it("does not add identity entries when WCP4 validation fails", async () => {
    const { connection } = createAgentWithTestConnection()

    await connection.receiveMessage(
      createWcp4Message("failed-wcp4-uuid", {
        identityUrl: "https://example.com/not-in-directory",
        actualUrl: "https://example.com/not-in-directory",
      }),
    )

    expect(getInstanceIdentityCountForTesting(connection)).toBe(0)
  })

  it("records identity after successful WCP4 validation", async () => {
    const { connection } = createAgentWithTestConnection()

    await connection.receiveMessage(createWcp4Message("success-wcp4-uuid"))

    const instanceId = getWcp5CanonicalInstanceId(connection)
    expect(hasInstanceIdentityForTesting(connection, instanceId)).toBe(true)
    expect(getInstanceIdentityCountForTesting(connection)).toBe(1)
  })

  it("prunes identity entry when cleanupDACPHandlers runs after successful WCP4", async () => {
    const { agent, connection } = createAgentWithTestConnection()

    await connection.receiveMessage(createWcp4Message("cleanup-wcp4-uuid"))

    const instanceId = getWcp5CanonicalInstanceId(connection)
    expect(hasInstanceIdentityForTesting(connection, instanceId)).toBe(true)

    agent.disconnectInstance(instanceId)

    expect(hasInstanceIdentityForTesting(connection, instanceId)).toBe(false)
    expect(getInstanceIdentityCountForTesting(connection)).toBe(0)
  })

  it("prunes identity entry when disconnectInstance runs after successful WCP4", async () => {
    const { agent, connection } = createAgentWithTestConnection()

    await connection.receiveMessage(createWcp4Message("goodbye-wcp4-uuid"))

    const canonicalInstanceId = getWcp5CanonicalInstanceId(connection)
    expect(hasInstanceIdentityForTesting(connection, canonicalInstanceId)).toBe(true)

    agent.disconnectInstance(canonicalInstanceId)

    expect(agent.getState().instances[canonicalInstanceId]).toBeUndefined()
    expect(hasInstanceIdentityForTesting(connection, canonicalInstanceId)).toBe(false)
    expect(getInstanceIdentityCountForTesting(connection)).toBe(0)
  })

  it("prunes identity entry when heartbeat timeout fires after successful WCP4", async () => {
    vi.useFakeTimers()
    const { connection } = createAgentWithTestConnection({
      heartbeatIntervalMs: 500,
      heartbeatTimeoutMs: 2000,
    })

    await connection.receiveMessage(createWcp4Message("heartbeat-timeout-uuid"))

    const instanceId = getWcp5CanonicalInstanceId(connection)
    expect(hasInstanceIdentityForTesting(connection, instanceId)).toBe(true)
    expect(getActiveHeartbeatTimerCount()).toBe(1)

    vi.advanceTimersByTime(2500)

    expect(hasInstanceIdentityForTesting(connection, instanceId)).toBe(false)
    expect(getInstanceIdentityCountForTesting(connection)).toBe(0)
  })

  it("prunes only the disconnected instance when multiple identities exist on one connection", async () => {
    const { agent, connection } = createAgentWithTestConnection()

    await connection.receiveMessage(createWcp4Message("first-connect-uuid"))
    const firstInstanceId = getWcp5CanonicalInstanceId(connection)

    await connection.receiveMessage(createWcp4Message("second-connect-uuid"))
    const secondInstanceId = getWcp5CanonicalInstanceId(connection, 1)

    expect(getInstanceIdentityCountForTesting(connection)).toBe(2)

    agent.disconnectInstance(firstInstanceId)

    expect(hasInstanceIdentityForTesting(connection, firstInstanceId)).toBe(false)
    expect(hasInstanceIdentityForTesting(connection, secondInstanceId)).toBe(true)
    expect(getInstanceIdentityCountForTesting(connection)).toBe(1)

    agent.disconnectInstance(secondInstanceId)

    expect(getInstanceIdentityCountForTesting(connection)).toBe(0)
  })

  it("prunes identity when cleanupDACPHandlers resolves canonical id from WCP4 temp context", () => {
    const mockTransport = new MockTransport()
    const canonicalInstanceId = "canonical-prune-instance"
    let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    state = connectInstance(state, {
      instanceId: canonicalInstanceId,
      appId: TEST_APP.appId,
      metadata: { appId: TEST_APP.appId, name: TEST_APP.title },
    })
    state = updateInstanceState(state, canonicalInstanceId, AppInstanceState.CONNECTED)

    const { context, getState } = createDACPTestContext({
      instanceId: "temp-prune-attempt",
      initialState: state,
    })
    const contextWithTransport = withResponseDispatcher(context, mockTransport)

    getInstanceIdentityMap(mockTransport).set(canonicalInstanceId, {
      appId: TEST_APP.appId,
      instanceUuid: "uuid-prune",
      origin: "https://example.com",
      sourceWindow: undefined,
    })
    expect(hasInstanceIdentityForTesting(mockTransport, canonicalInstanceId)).toBe(true)

    startHeartbeat(canonicalInstanceId, contextWithTransport)
    cleanupDACPHandlers(contextWithTransport)

    expect(getState().instances[canonicalInstanceId]).toBeUndefined()
    expect(hasInstanceIdentityForTesting(mockTransport, canonicalInstanceId)).toBe(false)
  })
})
