import type { IDockviewHeaderActionsProps } from "dockview"
import { useState, useEffect, useMemo } from "react"
import { Circle, ExternalLink, Maximize2, Minimize2, X } from "lucide-react"

import { ChannelMenu } from "../../../channel-selector/ChannelMenu"
import { useSailDesktopAgent, useConnectionStore } from "../../../../contexts/SailDesktopAgentContext"

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
const ChannelSelectorButton = ({ activePanelId }: { activePanelId?: string }) => {
  const sailAgent = useSailDesktopAgent()
  const connectionStore = useConnectionStore()
  const [channelId, setChannelId] = useState<string | null>(null)

  // Get connection and channel for the active panel
  // Re-runs when activePanelId changes (when user switches tabs)
  useEffect(() => {
    if (!activePanelId) {
      setChannelId(null)
      return
    }
    const connection = connectionStore.getConnectionByPanelId(activePanelId)
    setChannelId(connection?.channelId ?? null)
  }, [activePanelId, connectionStore])

  // Also listen for channel changes via WCP events
  useEffect(() => {
    const handleChannelChanged = (instanceId: string, newChannelId: string | null) => {
      // Check if this channel change is for the active panel
      if (!activePanelId) return
      const connection = connectionStore.getConnectionByPanelId(activePanelId)
      if (connection?.instanceId === instanceId) {
        setChannelId(newChannelId)
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

  // Channel selection is read-only for now - apps control their own channel via FDC3
  // This UI just shows what channel the active panel's app has joined
  const handleChannelSelect = (newChannelId: string | null) => {
    console.log(`[ChannelSelector] User selected channel: ${newChannelId || "none"}`)
    console.log("[ChannelSelector] Note: Apps control their own channel membership via FDC3 API")
  }

  const channelColor = channel?.displayMetadata?.color || "#888888"
  const channelName = channel?.displayMetadata?.name || channelId

  return (
    <ChannelMenu
      trigger={
        <button
          className="icon-button flex items-center justify-center"
          title={channel ? `Channel: ${channelName}` : "No channel (app not connected or not on a channel)"}
        >
          <Circle
            className="size-4"
            style={{
              fill: channelId ? channelColor : "transparent",
              stroke: channelId ? channelColor : "currentColor",
              strokeWidth: channelId ? 0 : 1.5,
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
  // Check if panel is in popout mode for conditional rendering
  const isPopout = props.api.location.type === "popout"

  // Get the active panel's ID for channel selector
  const activePanelId = props.activePanel?.id

  return (
    <div className="group-control">
      <ChannelSelectorButton activePanelId={activePanelId} />
      <PopoutButton {...props} />
      {/* Maximize/Minimize button (only show when not in popout) */}
      {!isPopout && <MaximizeButton {...props} />}
    </div>
  )
}
