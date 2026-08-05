import { describe, expect, it } from "vite-plus/test"
import { connectInstance } from "../../../state/mutators"
import { createInitialState } from "../../../state/initial-state"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../default-user-channels"
import type { InstanceIdentityRecord } from "../../../app-connection/wcp/instance-identity-registry"
import { tryAdoptHostPreRegisteredInstance } from "../wcp-host-instance-adoption"

const MOCK_APP_ID = "MockAppId"
const L1 = "L1"
const L2 = "L2"
const SOURCE_WINDOW = { hostPanel: "test-source" }

function createStateWithPendingInstances(instanceIds: string[]) {
  let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
  for (const instanceId of instanceIds) {
    state = connectInstance(state, {
      instanceId,
      appId: MOCK_APP_ID,
      metadata: { name: MOCK_APP_ID },
    })
  }
  return state
}

function adopt(params: {
  reconnectInstanceId?: string
  reconnectInstanceUuid?: string
  hostIdentifier?: string
  state: ReturnType<typeof createStateWithPendingInstances>
  identityMap?: Map<string, InstanceIdentityRecord>
}) {
  const { state, identityMap = new Map<string, InstanceIdentityRecord>(), ...rest } = params
  return tryAdoptHostPreRegisteredInstance({
    ...rest,
    sourceWindow: SOURCE_WINDOW,
    appId: MOCK_APP_ID,
    getState: () => state,
    identityMap,
  })
}

describe("tryAdoptHostPreRegisteredInstance", () => {
  describe("multiple stale PENDING rows for same appId", () => {
    it.each([
      {
        label: "hostIdentifier L2 with no WCP4 instanceId",
        reconnectInstanceId: undefined,
        hostIdentifier: L2,
        expectedInstanceId: L2,
      },
      {
        label: "explicit WCP4 instanceId L1 wins over hostIdentifier L2",
        reconnectInstanceId: L1,
        hostIdentifier: L2,
        expectedInstanceId: L1,
      },
      {
        label: "explicit WCP4 instanceId L2 wins when hostIdentifier absent",
        reconnectInstanceId: L2,
        hostIdentifier: undefined,
        expectedInstanceId: L2,
      },
    ])(
      "adopts $expectedInstanceId when $label",
      ({ reconnectInstanceId, hostIdentifier, expectedInstanceId }) => {
        const state = createStateWithPendingInstances([L1, L2])

        const result = adopt({
          reconnectInstanceId,
          hostIdentifier,
          state,
        })

        expect(result).toBeDefined()
        expect(result?.instanceId).toBe(expectedInstanceId)
        expect(result?.instanceUuid).toBeTruthy()
      },
    )

    it("returns undefined when two pendings exist and neither instanceId nor hostIdentifier disambiguates", () => {
      const state = createStateWithPendingInstances([L1, L2])

      const result = adopt({ state })

      expect(result).toBeUndefined()
    })

    it("ignores hostIdentifier that does not match a pending host instance", () => {
      const state = createStateWithPendingInstances([L1, L2])

      const result = adopt({ hostIdentifier: "unknown-launch-id", state })

      expect(result).toBeUndefined()
    })
  })
})
