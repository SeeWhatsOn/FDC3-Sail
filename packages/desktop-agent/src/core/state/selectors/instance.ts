/**
 * Instance Selectors
 *
 * Pure functions for querying instance-related state.
 */

import type { AgentState, AppInstance } from "../types"
import { AppInstanceState } from "../types"

export const getInstance = (state: AgentState, instanceId: string): AppInstance | undefined =>
  state.instances[instanceId]

export const getAllInstances = (state: AgentState): AppInstance[] =>
  Object.values(state.instances)

export const getInstancesByAppId = (state: AgentState, appId: string): AppInstance[] =>
  Object.values(state.instances).filter(i => i.appId === appId)

export const getInstancesOnChannel = (state: AgentState, channelId: string): AppInstance[] =>
  Object.values(state.instances).filter(i => i.currentChannel === channelId)

export const getConnectedInstances = (state: AgentState): AppInstance[] =>
  Object.values(state.instances).filter(i => i.state === AppInstanceState.CONNECTED)

export const getInstancesByState = (
  state: AgentState,
  instanceState: AppInstanceState | AppInstanceState[]
): AppInstance[] => {
  const states = Array.isArray(instanceState) ? instanceState : [instanceState]
  return Object.values(state.instances).filter(i => states.includes(i.state))
}

export const getInstancesWithContextListener = (
  state: AgentState,
  contextType: string
): AppInstance[] =>
  Object.values(state.instances).filter(instance =>
    Object.values(instance.contextListeners).some(
      listenerContextType => listenerContextType === contextType || listenerContextType === "*"
    )
  )

export const getInstancesWithIntentListener = (
  state: AgentState,
  intentName: string
): AppInstance[] =>
  Object.values(state.instances).filter(i => i.intentListeners.includes(intentName))

export const getInstancesWithPrivateChannel = (
  state: AgentState,
  channelId: string
): AppInstance[] =>
  Object.values(state.instances).filter(i => i.privateChannels.includes(channelId))
