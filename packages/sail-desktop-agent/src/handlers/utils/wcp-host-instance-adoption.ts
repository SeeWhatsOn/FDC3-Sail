import type { DACPHandlerParams } from "../types"
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
  params: DACPHandlerParams,
  appId: string,
  validatedInstanceId: string,
): void {
  // Reap only PENDING registrations made *before* the one that just connected. A registration
  // made *after* it is a concurrent launch whose context has not connected yet, and reaping that
  // would delete an instanceId its `open()` caller already holds.
  //
  // This is a heuristic, not an implication. `openResponse` is returned before WCP4 (see
  // `handleOpenRequest`), so nothing serialises which of two concurrent launches connects first.
  // When the *later* launch validates first, the earlier PENDING row is reaped even though it was
  // never abandoned, and its own WCP4 then mints an id no caller holds — the same defect mirrored.
  //
  // That is deliberate: a later launch reaching WCP4 first is the only abandoned-launch signal the
  // agent has. Only the host knows whether a browsing context is still alive (the harness uses
  // `popupWatcher.hasPopup()`), and plumbing liveness in would be a new host contract. Registration
  // order also assumes non-integer-like instanceIds, since integer-like keys sort ahead of all
  // string keys regardless of insertion order.
  const instances = Object.values(params.getState().instances)
  const validatedIndex = instances.findIndex(
    instance => instance.instanceId === validatedInstanceId,
  )

  const orphanInstanceIds = instances
    .slice(0, validatedIndex === -1 ? instances.length : validatedIndex)
    .filter(instance => instance.appId === appId && instance.state === AppInstanceState.PENDING)
    .map(instance => instance.instanceId)

  if (orphanInstanceIds.length === 0) {
    return
  }

  // Migrating a reaped row's pending open means the two open flavours land differently. For an
  // open *with* context the context has to be delivered somewhere and the validated instance is
  // the only live candidate, so re-targeting is right. For a *plain* open it substitutes a
  // different instance: the caller is answered with `validatedInstanceId`, an id its own launch
  // never produced, so two `open()` calls can resolve to one instanceId. That still beats the
  // pre-migration outcome of handing back an id whose browsing context is gone — see the
  // Known Limitations note in .cursor/plans/conformance-open-timing.md.
  params.setState(state => {
    let nextState = state
    for (const orphanInstanceId of orphanInstanceIds) {
      nextState = migratePendingOpenWithContextTarget(
        nextState,
        orphanInstanceId,
        validatedInstanceId,
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

  return pendingHostInstances[0]!.instanceId
}
