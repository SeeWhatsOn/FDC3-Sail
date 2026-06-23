import type { DACPHandlerContext } from "../types"
import { getInstance } from "../../state/selectors"
import { migratePendingOpenWithContextTarget, removeInstance } from "../../state/mutators"
import { AppInstanceState } from "../../state/types"
import type { AgentState } from "../../state/types"
import type { InstanceIdentityRecord } from "../../app-connection/wcp/instance-identity-registry"

export function tryAdoptHostPreRegisteredInstance(params: {
  reconnectInstanceId?: string
  reconnectInstanceUuid?: string
  /** Host-assigned browsing context name from WCP1 (`window.name` / iframe `name`). */
  hostIdentifier?: string
  sourceWindow: unknown
  appId: string
  getState: () => AgentState
  identityMap: Map<string, InstanceIdentityRecord>
}): { instanceId: string; instanceUuid: string } | undefined {
  const {
    reconnectInstanceId,
    reconnectInstanceUuid,
    hostIdentifier,
    sourceWindow,
    appId,
    getState,
    identityMap,
  } = params

  const adoptParams = { sourceWindow, appId, getState, identityMap }

  const explicitHostInstanceId =
    reconnectInstanceId && canAdoptPendingHostInstance({ reconnectInstanceId, ...adoptParams })
      ? reconnectInstanceId
      : undefined

  const hostIdentifierInstanceId =
    hostIdentifier &&
    hostIdentifier !== reconnectInstanceId &&
    canAdoptPendingHostInstance({ reconnectInstanceId: hostIdentifier, ...adoptParams })
      ? hostIdentifier
      : undefined

  const solePendingHostInstanceId = findSolePendingHostInstanceId(getState(), appId, identityMap)

  const hostInstanceId =
    explicitHostInstanceId ?? hostIdentifierInstanceId ?? solePendingHostInstanceId
  if (!hostInstanceId) {
    return undefined
  }

  return {
    instanceId: hostInstanceId,
    instanceUuid: reconnectInstanceUuid ?? crypto.randomUUID(),
  }
}

export function reconcileOrphanPendingHostInstances(
  context: DACPHandlerContext,
  appId: string,
  canonicalInstanceId: string,
): void {
  const orphanInstanceIds = Object.values(context.getState().instances)
    .filter(
      instance =>
        instance.appId === appId &&
        instance.instanceId !== canonicalInstanceId &&
        instance.state === AppInstanceState.PENDING,
    )
    .map(instance => instance.instanceId)

  if (orphanInstanceIds.length === 0) {
    return
  }

  context.setState(state => {
    let nextState = state
    for (const orphanInstanceId of orphanInstanceIds) {
      nextState = migratePendingOpenWithContextTarget(
        nextState,
        orphanInstanceId,
        canonicalInstanceId,
      )
      nextState = removeInstance(nextState, orphanInstanceId)
    }
    return nextState
  })
}

function canAdoptPendingHostInstance(params: {
  reconnectInstanceId: string
  sourceWindow?: unknown
  appId: string
  getState: () => AgentState
  identityMap: Map<string, InstanceIdentityRecord>
}): boolean {
  const { reconnectInstanceId, appId, getState, identityMap } = params

  if (identityMap.has(reconnectInstanceId)) {
    return false
  }

  const existingInstance = getInstance(getState(), reconnectInstanceId)
  return existingInstance?.state === AppInstanceState.PENDING && existingInstance.appId === appId
}

function findSolePendingHostInstanceId(
  state: AgentState,
  appId: string,
  identityMap: Map<string, InstanceIdentityRecord>,
): string | undefined {
  const pendingHostInstances = Object.values(state.instances).filter(
    instance =>
      instance.appId === appId &&
      instance.state === AppInstanceState.PENDING &&
      !identityMap.has(instance.instanceId),
  )

  if (pendingHostInstances.length !== 1) {
    return undefined
  }

  return pendingHostInstances[0].instanceId
}
