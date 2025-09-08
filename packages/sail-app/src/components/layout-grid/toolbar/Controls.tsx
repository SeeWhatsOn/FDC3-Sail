import { IDockviewHeaderActionsProps } from "dockview"
import { useState, useEffect } from "react"
import { Plus, Menu, Maximize2, Minimize2, ExternalLink, X, Star } from "lucide-react"

// Types for better type safety
interface IconProps {
  icon: React.ComponentType<{ size?: number }>
  title?: string
  onClick?: (event: React.MouseEvent) => void
}

// Constants to reduce duplication and improve maintainability
const COMMON_CONTROL_STYLES = {
  display: "flex",
  alignItems: "center",
  padding: "0px 8px",
  height: "100%",
  color: "var(--dv-activegroup-visiblepanel-tab-color)",
} as const

const ICON_SIZE = 16

// Utility function to generate unique IDs for new panels
const generateUniqueId = (): string => {
  return window.crypto.randomUUID()
}

// Reusable icon component with consistent styling and behavior
const Icon = ({ icon: IconComponent, title, onClick }: IconProps) => {
  return (
    <div
      title={title}
      className="action cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded"
      onClick={onClick}
    >
      <IconComponent size={ICON_SIZE} />
    </div>
  )
}

/**
 * RightControls component renders action buttons for the right side of the panel header
 * Includes panel-specific controls, maximize/minimize, and popout functionality
 */
export const RightControls = (props: IDockviewHeaderActionsProps) => {
  // Track panel state for UI updates
  const [isMaximized, setIsMaximized] = useState<boolean>(props.containerApi.hasMaximizedGroup())
  const [isPopout, setIsPopout] = useState<boolean>(props.api.location.type === "popout")

  // Subscribe to panel state changes
  useEffect(() => {
    const maximizedDisposable = props.containerApi.onDidMaximizedGroupChange(() => {
      setIsMaximized(props.containerApi.hasMaximizedGroup())
    })

    const locationDisposable = props.api.onDidLocationChange(() => {
      setIsPopout(props.api.location.type === "popout")
    })

    return () => {
      maximizedDisposable.dispose()
      locationDisposable.dispose()
    }
  }, [props.api, props.containerApi])

  // Handle maximize/minimize toggle
  const handleMaximizeToggle = () => {
    if (props.containerApi.hasMaximizedGroup()) {
      props.containerApi.exitMaximizedGroup()
    } else {
      props.activePanel?.api.maximize()
    }
  }

  // Handle popout window toggle
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
    <div className="group-control" style={COMMON_CONTROL_STYLES}>
      {/* Star icon for active groups */}
      {props.isGroupActive && <Icon icon={Star} title="Active Group" />}

      {/* Popout/Close window button */}
      <Icon
        title={isPopout ? "Close Window" : "Open In New Window"}
        icon={isPopout ? X : ExternalLink}
        onClick={handlePopoutToggle}
      />

      {/* Maximize/Minimize button (only show when not in popout) */}
      {!isPopout && (
        <Icon
          title={isMaximized ? "Minimize View" : "Maximize View"}
          icon={isMaximized ? Minimize2 : Maximize2}
          onClick={handleMaximizeToggle}
        />
      )}
    </div>
  )
}

/**
 * LeftControls component renders the add panel button on the left side of the panel header
 * Allows users to create new panels in the current group
 */
export const LeftControls = (props: IDockviewHeaderActionsProps) => {
  // Handle adding a new panel to the current group
  const handleAddPanel = () => {
    const uniqueId = generateUniqueId()
    const timestamp = Date.now().toString()

    props.containerApi.addPanel({
      id: `id_${timestamp}`,
      component: "default",
      title: `Tab ${uniqueId}`,
      position: {
        referenceGroup: props.group,
      },
    })
  }

  return (
    <div className="group-control" style={COMMON_CONTROL_STYLES}>
      <Icon icon={Plus} title="Add New Panel" onClick={handleAddPanel} />
    </div>
  )
}

/**
 * PrefixHeaderControls component renders controls at the beginning of the panel header
 * Currently displays a menu icon (placeholder for future functionality)
 */
export const PrefixToolbarControls = () => {
  return (
    <div className="group-control" style={COMMON_CONTROL_STYLES}>
      <Icon icon={Menu} title="Menu" />
    </div>
  )
}
