import type { IDockviewHeaderActionsProps } from "dockview"
import { useState, useEffect, useMemo, useRef } from "react"
import { Circle, ExternalLink, Maximize2, Minimize2, X } from "lucide-react"

import { ChannelMenu } from "../../../channel-selector/ChannelMenu"
import { useSailDesktopAgent, useConnectionStore } from "../../../../contexts"
import {
  createJoinUserChannelRequest,
  createLeaveCurrentChannelRequest,
} from "../../../../utils/dacp-messages"

import { Icon } from "./Icon"

import "./controls.css"

// Popout button component with its own state and logic
const PopoutButton = (props: IDockviewHeaderActionsProps) => {
  const [isPopout, setIsPopout] = useState<boolean>(props.api.location.type === "popout")

  useEffect(() => {
    const locationDisposable = props.api.onDidLocationChange(() => {
      setIsPopout(props.api.location.type === "popout")
    })

    return () => {
      locationDisposable.dispose()
    }
  }, [props.api])

  const handlePopoutToggle = () => {
    if (props.api.location.type !== "popout") {
      // Create new popout window
      props.containerApi
        .addPopoutGroup(props.group)
        .then(() => {
          // Optional: Move panel to right position after popout
          // props.api.moveTo({ position: "right" })
        })
        .catch(error => {
          console.error("Failed to create popout window:", error)
        })
    } else {
      // Return from popout to main window
      props.api.moveTo({ position: "right" })
    }
  }

  return (
    <Icon
      title={isPopout ? "Close Window" : "Open In New Window"}
      icon={isPopout ? X : ExternalLink}
      onClick={handlePopoutToggle}
    />
  )
}

// Maximize button component with its own state and logic
const MaximizeButton = (props: IDockviewHeaderActionsProps) => {
  const [isMaximized, setIsMaximized] = useState<boolean>(props.containerApi.hasMaximizedGroup())

  useEffect(() => {
    const maximizedDisposable = props.containerApi.onDidMaximizedGroupChange(() => {
      setIsMaximized(props.containerApi.hasMaximizedGroup())
    })

    return () => {
      maximizedDisposable.dispose()
    }
  }, [props.containerApi])

  const handleMaximizeToggle = () => {
    if (props.containerApi.hasMaximizedGroup()) {
      props.containerApi.exitMaximizedGroup()
    } else {
      props.activePanel?.api.maximize()
    }
  }

  return (
    <Icon
      title={isMaximized ? "Minimize View" : "Maximize View"}
      icon={isMaximized ? Minimize2 : Maximize2}
      onClick={handleMaximizeToggle}
    />
  )
}

// Channel selector button that shows the active panel's FDC3 channel
// Each instance should be independent and only show/update for its specific panelId
const ChannelSelectorButton = ({ activePanelId }: { activePanelId?: string }) => {
  const sailAgent = useSailDesktopAgent()
  const connectionStore = useConnectionStore()
  const [channelId, setChannelId] = useState<string | null>(null)

  // Generate a unique ID for this component instance to track in debug logs
  const instanceIdRef = useRef(`ChannelSelector-${Math.random().toString(36).substr(2, 9)}`)

  // Use a ref to track the current activePanelId to avoid stale closures
  const activePanelIdRef = useRef(activePanelId)
  useEffect(() => {
    activePanelIdRef.current = activePanelId
  }, [activePanelId])

  // Get connection and channel for THIS specific panel
  // This should only update when activePanelId changes OR when we manually update via events
  useEffect(() => {
    if (!activePanelId) {
      setChannelId(null)
      return
    }

    const connection = connectionStore.getConnectionByPanelId(activePanelId)
    const newChannelId = connection?.channelId ?? null

    // Only update if it actually changed to avoid unnecessary re-renders
    setChannelId(prev => {
      if (prev !== newChannelId) {
        if (process.env.NODE_ENV === "development") {
          console.log(
            `[ChannelSelectorButton:${instanceIdRef.current}] ChannelId updated from connection store:`,
            {
              activePanelId,
              prev,
              newChannelId,
              instanceId: connection?.instanceId,
            }
          )
        }
        return newChannelId
      }
      return prev
    })
  }, [activePanelId, connectionStore])

  // Listen for channel changes via WCP events
  // CRITICAL: Use the ref to ensure we're checking the current activePanelId
  // and only update if the event is for THIS specific panel's instance
  useEffect(() => {
    if (!activePanelId) return

    const handleChannelChanged = (instanceId: string, newChannelId: string | null) => {
      // Use the ref to get the current activePanelId (avoids stale closure)
      const currentPanelId = activePanelIdRef.current
      if (!currentPanelId) return

      // Get the connection for THIS specific panel
      const connection = connectionStore.getConnectionByPanelId(currentPanelId)

      // Only update if this channel change is for THIS panel's instance
      if (connection?.instanceId === instanceId) {
        if (process.env.NODE_ENV === "development") {
          console.log(
            `[ChannelSelectorButton:${instanceIdRef.current}] channelChanged event - updating state:`,
            {
              activePanelId: currentPanelId,
              instanceId,
              newChannelId,
            }
          )
        }
        setChannelId(newChannelId)
      } else {
        if (process.env.NODE_ENV === "development") {
          console.log(
            `[ChannelSelectorButton:${instanceIdRef.current}] channelChanged event - ignoring (wrong instance):`,
            {
              activePanelId: currentPanelId,
              eventInstanceId: instanceId,
              connectionInstanceId: connection?.instanceId,
            }
          )
        }
      }
    }

    sailAgent.wcpConnector.on("channelChanged", handleChannelChanged)
    return () => {
      sailAgent.wcpConnector.off("channelChanged", handleChannelChanged)
    }
  }, [activePanelId, connectionStore, sailAgent.wcpConnector])

  // Get channel metadata for display
  const channel = useMemo(() => {
    if (!channelId) return null
    try {
      return sailAgent.desktopAgent.getUserChannelRegistry().get(channelId)
    } catch {
      return null
    }
  }, [sailAgent, channelId])

  // Handle channel selection - send DACP message to change the active panel's channel
  // According to FDC3 2.2 spec, when channelSelectorUrl is false (Sail-controlled UI),
  // the external UI should send DACP messages directly to control app channels.
  const handleChannelSelect = (newChannelId: string | null) => {
    if (!activePanelId) {
      console.warn("[ChannelSelector] No active panel to change channel for")
      return
    }

    const connection = connectionStore.getConnectionByPanelId(activePanelId)
    if (!connection || !connection.instanceId) {
      console.warn("[ChannelSelector] No connection found for active panel", activePanelId)
      return
    }

    const instanceId = connection.instanceId

    try {
      if (newChannelId === null) {
        // Leave current channel
        const message = createLeaveCurrentChannelRequest()
        console.log(`[ChannelSelector] Sending leaveCurrentChannelRequest`, {
          instanceId,
          panelId: activePanelId,
          message,
        })
        sailAgent.sendDACPMessageOnBehalfOf(instanceId, message)
        console.log(`[ChannelSelector] Sent leaveCurrentChannelRequest for instance ${instanceId}`)
      } else {
        // Join user channel
        const message = createJoinUserChannelRequest(newChannelId)
        console.log(`[ChannelSelector] Sending joinUserChannelRequest`, {
          instanceId,
          panelId: activePanelId,
          channelId: newChannelId,
          message,
        })
        sailAgent.sendDACPMessageOnBehalfOf(instanceId, message)
        console.log(
          `[ChannelSelector] Sent joinUserChannelRequest for instance ${instanceId}, channel ${newChannelId}`
        )
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error("[ChannelSelector] Failed to send channel change message:", errorMessage)
    }
  }

  const channelColor = channel?.displayMetadata?.color
  const channelName = channel?.displayMetadata?.name || channelId

  return (
    <ChannelMenu
      trigger={
        <button
          className="icon-button flex items-center justify-center"
          title={
            channel
              ? `Channel: ${channelName}`
              : "No channel (app not connected or not on a channel)"
          }
        >
          <Circle
            className="size-4"
            style={{
              fill: channelId && channelColor ? channelColor : "transparent",
              stroke: channelId && channelColor ? channelColor : "currentColor",
              strokeWidth: channelId && channelColor ? 0 : 1.5,
            }}
          />
        </button>
      }
      selectedChannelId={channelId}
      onChannelSelect={handleChannelSelect}
    />
  )
}

/**
 * RightControls component renders action buttons for the right side of the panel header
 * Composes individual button components with their own state management
 */
export const RightControls = (props: IDockviewHeaderActionsProps) => {
  const isPopout = props.api.location.type === "popout"

  /**
   * Resolves the panel ID for this header component.
   *
   * Dockview headers are rendered per tab, but props.api.id may be a Dockview internal ID
   * rather than the actual panel ID stored in params.panel.panelId. This function searches
   * through available panels to find the matching panel and extract its panelId.
   *
   * @returns The panel ID if found, undefined otherwise
   */
  const resolvePanelId = (): string | undefined => {
    type PanelParams = { panel?: { panelId: string } } | undefined
    const extractPanelId = (params: unknown): string | undefined => {
      return (params as PanelParams)?.panel?.panelId
    }

    // Search within the group first
    if (props.group) {
      const groupPanels = props.group.panels

      // Match by panel.api.id or panel.id
      for (const panel of groupPanels) {
        if (panel.api.id === props.api.id || panel.id === props.api.id) {
          const panelId = extractPanelId(panel.params)
          if (panelId) return panelId
        }
      }

      // Fallback: if only one panel in group, use it
      if (groupPanels.length === 1) {
        const panelId = extractPanelId(groupPanels[0].params)
        if (panelId) return panelId
      }
    }

    // Search all panels if not found in group
    for (const panel of props.containerApi.panels) {
      if (panel.api.id === props.api.id || panel.id === props.api.id) {
        const panelId = extractPanelId(panel.params)
        if (panelId) return panelId
      }
    }

    // Last resort: use props.api.id if it matches our panel ID format
    if (props.api.id && (props.api.id.startsWith("sail-") || props.api.id.includes("-"))) {
      return props.api.id
    }

    return undefined
  }

  const panelId = resolvePanelId()

  if (process.env.NODE_ENV === "development" && !panelId) {
    console.warn("[RightControls] Could not resolve panelId for header", {
      "props.api.id": props.api.id,
      "group?.panels.length": props.group?.panels.length,
    })
  }

  const isFDC3Panel = !!panelId

  return (
    <div className="group-control">
      {isFDC3Panel && panelId && <ChannelSelectorButton activePanelId={panelId} />}
      <PopoutButton {...props} />
      {/* Maximize/Minimize button (only show when not in popout) */}
      {!isPopout && <MaximizeButton {...props} />}
    </div>
  )
}
