import type { SailDesktopAgent } from "@finos/sail-desktop-agent"

import type { PopupCloseWatcher } from "./popup-launcher"

const HARNESS_LOG_PREFIX = "[ConformanceHarness]"

/** Try to destroy a host-owned browsing context opened via {@link window.open}. */
export function tryCloseBrowsingContext(
  windowRef: Window | null | undefined,
  instanceId: string,
): boolean {
  if (!windowRef) {
    return false
  }
  if (windowRef.closed) {
    return true
  }

  try {
    windowRef.close()
  } catch (error) {
    console.warn(`${HARNESS_LOG_PREFIX} window.close() threw for ${instanceId}`, error)
  }

  if (windowRef.closed) {
    return true
  }

  console.warn(`${HARNESS_LOG_PREFIX} Browsing context still open after close() for ${instanceId}`)
  return false
}

/** Collect launcher and WCP routing ids that may refer to the same popup. */
export function collectHarnessCloseInstanceIds(
  desktopAgent: SailDesktopAgent,
  instanceId: string,
): string[] {
  const ids = new Set<string>([instanceId])

  for (const connection of desktopAgent.apps.getConnections()) {
    ids.add(connection.instanceId)
    if (connection.instanceId === instanceId && connection.source) {
      for (const other of desktopAgent.apps.getConnections()) {
        if (other.source === connection.source) {
          ids.add(other.instanceId)
        }
      }
    }
  }

  for (const instance of desktopAgent.apps.getInstances()) {
    if (instance.instanceId === instanceId) {
      ids.add(instance.instanceId)
    }
  }

  return [...ids]
}

/**
 * Close a mock-app browsing context when FINOS calls `fdc3.close()` or the agent
 * disconnects the instance. Tries the popup registry first, then WCP `source` windows.
 */
export function closeHarnessBrowsingContext(options: {
  instanceId: string
  desktopAgent: SailDesktopAgent
  popupWatcher: PopupCloseWatcher
}): boolean {
  const { instanceId, desktopAgent, popupWatcher } = options
  const candidateIds = collectHarnessCloseInstanceIds(desktopAgent, instanceId)

  for (const candidateId of candidateIds) {
    if (popupWatcher.closePopup(candidateId)) {
      return true
    }
  }

  for (const connection of desktopAgent.apps.getConnections()) {
    if (tryCloseBrowsingContext(connection.source, connection.instanceId)) {
      return true
    }
  }

  console.warn(
    `${HARNESS_LOG_PREFIX} No closable browsing context found for instance ${instanceId} (candidates: ${candidateIds.join(", ")})`,
  )
  return false
}
