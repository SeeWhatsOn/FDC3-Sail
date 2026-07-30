import { resolveLinkedInstanceId } from "../../state/selectors/wcp-handshake-routing"
import type { DACPHandlerContext } from "../types"
import { getInstance } from "../../state/selectors"

type MessageWithDacpInstanceMeta = {
  meta?: {
    hostInstanceId?: string
    source?: { appId?: string; instanceId?: string }
  }
}

/**
 * Resolve the agent instance bucket for DACP handlers during WCP handshake.
 *
 * Prefer an explicit host launcher id, then a registered MessagePort-routed id,
 * then the WCP5 handshake-routing link. Never guess identity from app-supplied
 * `meta.source.appId`.
 */
export function resolveDacpHandlerInstanceId(
  message: MessageWithDacpInstanceMeta,
  context: DACPHandlerContext,
): string {
  const { instanceId, getState } = context
  const state = getState()
  const hostInstanceId = message.meta?.hostInstanceId

  if (hostInstanceId && getInstance(state, hostInstanceId)) {
    return hostInstanceId
  }

  // Prefer the MessagePort-routed instance when it is already registered. Pending
  // open-with-context targets are for a *different* instance awaiting a listener;
  // redirecting here breaks broadcastResponse routing back to the connected sender
  // (orphan tabs accumulate when windowClosed broadcasts time out).
  if (getInstance(state, instanceId)) {
    return instanceId
  }

  const linkedInstanceId = resolveLinkedInstanceId(state, instanceId)
  if (linkedInstanceId && getInstance(state, linkedInstanceId)) {
    return linkedInstanceId
  }

  return instanceId
}
