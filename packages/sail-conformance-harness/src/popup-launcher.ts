import type { HarnessPanel } from "./types"

import { tryCloseBrowsingContext } from "./harness-browsing-context-close"

/** Default popup chrome — omit noopener/noreferrer so WCP can use window.opener. */
export const HARNESS_POPUP_FEATURES =
  "width=1024,height=768,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes"

export type PopupCloseWatcherOptions = {
  onPopupClosed: (instanceId: string) => void
  pollIntervalMs?: number
  closeWindow?: (windowRef: Window, instanceId: string) => boolean
}

export type PopupCloseWatcher = {
  registerPopup: (instanceId: string, popup: Window) => void
  unregisterPopup: (instanceId: string) => void
  hasPopup: (instanceId: string) => boolean
  closePopup: (instanceId: string) => boolean
  /** Re-key a registered popup when WCP5 canonical id differs from launcher id. */
  remapPopupByWindow: (source: Window, canonicalInstanceId: string) => boolean
  stop: () => void
}

/**
 * Open a conformance mock app in a script-closable popup window. The window name
 * must match {@link HarnessPanel.instanceId} so the app can claim it in WCP4.
 *
 * Opens `about:blank` with {@link HARNESS_POPUP_FEATURES} first so browsers treat
 * the context as a host-owned auxiliary window, then navigates to the mock app URL.
 */
export function openHarnessPopup(panel: HarnessPanel): Window | null {
  const popup = window.open("about:blank", panel.instanceId, HARNESS_POPUP_FEATURES)
  if (!popup) {
    return null
  }

  try {
    popup.location.href = panel.url
  } catch (error) {
    console.error(
      `[ConformanceHarness] Failed to navigate popup for ${panel.appId} (${panel.instanceId})`,
      error,
    )
    tryCloseBrowsingContext(popup, panel.instanceId)
    return null
  }

  return popup
}

/**
 * Poll `window.closed` for harness popups and invoke cleanup when a popup closes.
 * Does not override `window.close` on child windows.
 */
export function createPopupCloseWatcher(options: PopupCloseWatcherOptions): PopupCloseWatcher {
  const popups = new Map<string, Window>()
  const pollIntervalMs = options.pollIntervalMs ?? 100
  const closeWindow =
    options.closeWindow ??
    ((windowRef: Window, instanceId: string) => tryCloseBrowsingContext(windowRef, instanceId))
  let intervalId: ReturnType<typeof setInterval> | undefined

  const stopPolling = () => {
    if (intervalId !== undefined) {
      clearInterval(intervalId)
      intervalId = undefined
    }
  }

  const pollClosedPopups = () => {
    for (const [instanceId, popup] of popups) {
      if (popup.closed) {
        popups.delete(instanceId)
        options.onPopupClosed(instanceId)
      }
    }

    if (popups.size === 0) {
      stopPolling()
    }
  }

  const startPollingIfNeeded = () => {
    if (intervalId !== undefined || popups.size === 0) {
      return
    }

    intervalId = setInterval(pollClosedPopups, pollIntervalMs)
  }

  return {
    registerPopup(instanceId: string, popup: Window) {
      popups.set(instanceId, popup)
      startPollingIfNeeded()
    },

    unregisterPopup(instanceId: string) {
      popups.delete(instanceId)
      if (popups.size === 0) {
        stopPolling()
      }
    },

    hasPopup(instanceId: string) {
      return popups.has(instanceId)
    },

    closePopup(instanceId: string) {
      const popup = popups.get(instanceId)
      if (!popup) {
        return false
      }
      if (closeWindow(popup, instanceId)) {
        return true
      }
      return false
    },

    remapPopupByWindow(source: Window, canonicalInstanceId: string) {
      for (const [launcherInstanceId, popup] of popups) {
        if (popup === source) {
          if (launcherInstanceId !== canonicalInstanceId) {
            popups.delete(launcherInstanceId)
            popups.set(canonicalInstanceId, popup)
          }
          return true
        }
      }
      return false
    },

    stop() {
      stopPolling()
      popups.clear()
    },
  }
}
