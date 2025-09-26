import type { IDockviewHeaderActionsProps } from "dockview"
import { useState, useEffect } from "react"
import { Maximize2, Minimize2, ExternalLink, X } from "lucide-react"

import { ChannelSelectorButton as ChannelSelector } from "../../../channel-selector/ChannelSelectorButton"
import { ChannelMenu } from "../../../channel-selector/ChannelMenu"

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

const ChannelSelectorButton = () => {
  return (
    <>
      <ChannelMenu trigger={<Icon title="Channel Selector" icon={ChannelSelector} />} />
    </>
  )
}

/**
 * RightControls component renders action buttons for the right side of the panel header
 * Composes individual button components with their own state management
 */
export const RightControls = (props: IDockviewHeaderActionsProps) => {
  // Check if panel is in popout mode for conditional rendering
  const isPopout = props.api.location.type === "popout"

  const { activePanel } = props

  const isFocused = activePanel?.api.isActive

  console.log(isFocused)
  console.log(activePanel)
  return (
    <div className="group-control">
      <ChannelSelectorButton />
      <PopoutButton {...props} />
      {/* Maximize/Minimize button (only show when not in popout) */}
      {!isPopout && <MaximizeButton {...props} />}
    </div>
  )
}
