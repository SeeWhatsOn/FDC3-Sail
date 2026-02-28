import type { BrowserTypes, Context } from "@finos/fdc3"
import { OpenError } from "@finos/fdc3"
import {
  createDACPEvent,
  createDACPSuccessResponse,
} from "../../../dacp-protocol/dacp-message-creators"
import { sendDACPResponse, sendDACPErrorResponse } from "./dacp-response-utils"
import type { DACPHandlerContext } from "../../types"
import { getInstance } from "../../../state/selectors"
import type { AgentState, PendingOpenWithContext } from "../../../state/types"
import {
  addPendingOpenWithContext,
  removePendingOpenWithContextByRequest,
  setPendingOpenWithContextForInstance,
} from "../../../state/mutators"

// Timeout handles are not serializable, so keep them separate from AgentState.
// Pending open-with-context requests themselves live in AgentState so they can be
// inspected/cleared alongside other agent state.
const pendingOpenWithContextTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

export function registerOpenWithContext(
  message: BrowserTypes.OpenRequest,
  appIdentifier: BrowserTypes.AppIdentifier,
  launchContext: Context,
  context: DACPHandlerContext
): void {
  const { instanceId: sourceInstanceId, openContextListenerTimeoutMs } = context
  const targetInstanceId = appIdentifier.instanceId
  if (!targetInstanceId) {
    throw new Error("App identifier missing instanceId for open-with-context")
  }

  // Fast path: if the app already has a matching listener, deliver immediately.
  if (hasMatchingContextListener(targetInstanceId, launchContext.type, context)) {
    deliverOpenWithContext(message, appIdentifier, launchContext, context, sourceInstanceId)
    return
  }

  // Otherwise, store the request and time out if no listener appears.
  // The timeout triggers an AppTimeout error to the caller.
  const requestUuid = message.meta.requestUuid
  const timeoutHandle = setTimeout(() => {
    context.setState((state: AgentState) =>
      removePendingOpenWithContextByRequest(state, targetInstanceId, requestUuid)
    )
    pendingOpenWithContextTimeouts.delete(requestUuid)
    sendDACPErrorResponse({
      message,
      errorType: OpenError.AppTimeout,
      errorMessage: "Timed out waiting for context listener",
      instanceId: sourceInstanceId,
      transport: context.transport,
    })
  }, openContextListenerTimeoutMs)

  const pendingEntry: PendingOpenWithContext = {
    message,
    appIdentifier,
    launchContext,
    sourceInstanceId,
  }

  // Track the pending request in state; the timeout map is keyed by requestUuid.
  context.setState((state: AgentState) =>
    addPendingOpenWithContext(state, targetInstanceId, pendingEntry)
  )
  pendingOpenWithContextTimeouts.set(requestUuid, timeoutHandle)
}

export function notifyContextListenerAdded(
  instanceId: string,
  contextType: string,
  context: DACPHandlerContext
): void {
  // Called when an instance adds a context listener; resolve any pending opens.
  const state: AgentState = context.getState()
  const pendingList = state.open.pendingWithContext[instanceId]
  if (!pendingList || pendingList.length === 0) {
    return
  }

  // A listener for "*" matches any pending context type.
  const { matched, remaining } = partitionPending(pendingList, contextType)
  if (matched.length === 0) {
    return
  }

  context.setState((state: AgentState) =>
    setPendingOpenWithContextForInstance(state, instanceId, remaining)
  )

  matched.forEach(pending => {
    clearPendingTimeout(pending.message.meta.requestUuid)
    deliverOpenWithContext(
      pending.message,
      pending.appIdentifier,
      pending.launchContext,
      context,
      pending.sourceInstanceId
    )
  })
}

function partitionPending(
  pendingList: PendingOpenWithContext[],
  contextType: string
): { matched: PendingOpenWithContext[]; remaining: PendingOpenWithContext[] } {
  const matched: PendingOpenWithContext[] = []
  const remaining: PendingOpenWithContext[] = []

  pendingList.forEach(pending => {
    const matches = contextType === "*" || pending.launchContext.type === contextType
    if (matches) {
      matched.push(pending)
    } else {
      remaining.push(pending)
    }
  })

  return { matched, remaining }
}

function clearPendingTimeout(requestUuid: string): void {
  const timeoutHandle = pendingOpenWithContextTimeouts.get(requestUuid)
  if (!timeoutHandle) {
    return
  }
  clearTimeout(timeoutHandle)
  pendingOpenWithContextTimeouts.delete(requestUuid)
}

function hasMatchingContextListener(
  targetInstanceId: string,
  contextType: string,
  context: DACPHandlerContext
): boolean {
  const instance = getInstance(context.getState(), targetInstanceId)
  if (!instance) {
    return false
  }

  // Listener registration is stored as listenerId -> contextType (or "*" for all).
  return Object.values(instance.contextListeners).some(
    listenerContextType => listenerContextType === contextType || listenerContextType === "*"
  )
}

function deliverOpenWithContext(
  message: BrowserTypes.OpenRequest,
  appIdentifier: BrowserTypes.AppIdentifier,
  launchContext: Context,
  context: DACPHandlerContext,
  sourceInstanceId: string
): void {
  // "Open with context" is modeled as a broadcast to the target instance,
  // then the original openRequest is completed with openResponse.
  const callerInstance = getInstance(context.getState(), sourceInstanceId)
  const broadcastEvent = createDACPEvent("broadcastEvent", {
    channelId: null,
    context: launchContext,
    originatingApp: {
      appId: callerInstance?.appId ?? "unknown",
      instanceId: sourceInstanceId,
    },
  })

  const broadcastEventWithRouting = {
    ...broadcastEvent,
    meta: {
      ...broadcastEvent.meta,
      destination: { instanceId: appIdentifier.instanceId },
    },
  }

  context.transport.send(broadcastEventWithRouting)

  const response = createDACPSuccessResponse(message, "openResponse", {
    appIdentifier,
  })

  sendDACPResponse({
    response,
    instanceId: sourceInstanceId,
    transport: context.transport,
  })
}
