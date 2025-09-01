import { IDockviewHeaderActionsProps } from "dockview"
import { useMemo, useState, useEffect, FC } from "react"
import { Download, Plus, Menu, Maximize2, Minimize2, ExternalLink, X, Star } from "lucide-react"

const randomId = () => {
  const hash = window.crypto.randomUUID()
  return hash
}

const Icon = (props: {
  icon: React.ComponentType<{ size?: number }>
  title?: string
  onClick?: (event: React.MouseEvent) => void
}) => {
  const IconComponent = props.icon
  return (
    <div
      title={props.title}
      className="action cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded"
      onClick={props.onClick}
    >
      <IconComponent size={16} />
    </div>
  )
}

const groupControlsComponents: Record<string, FC> = {
  panel_1: () => {
    return <Icon icon={Download} />
  },
}

export const RightControls = (props: IDockviewHeaderActionsProps) => {
  const Component = useMemo(() => {
    if (!props.isGroupActive || !props.activePanel) {
      return null
    }

    return groupControlsComponents[props.activePanel.id]
  }, [props.isGroupActive, props.activePanel])

  const [isMaximized, setIsMaximized] = useState<boolean>(props.containerApi.hasMaximizedGroup())

  const [isPopout, setIsPopout] = useState<boolean>(props.api.location.type === "popout")

  useEffect(() => {
    const disposable = props.containerApi.onDidMaximizedGroupChange(() => {
      setIsMaximized(props.containerApi.hasMaximizedGroup())
    })

    const disposable2 = props.api.onDidLocationChange(() => {
      setIsPopout(props.api.location.type === "popout")
    })

    return () => {
      disposable.dispose()
      disposable2.dispose()
    }
  }, [props.api, props.containerApi])

  const onClick = () => {
    if (props.containerApi.hasMaximizedGroup()) {
      props.containerApi.exitMaximizedGroup()
    } else {
      props.activePanel?.api.maximize()
    }
  }

  const onClick2 = () => {
    if (props.api.location.type !== "popout") {
      props.containerApi
        .addPopoutGroup(props.group)
        .then(() => {
          // props.api.moveTo({ position: "right" })
        })
        .catch(() => {
          console.error("Failed to add popout group")
        })
    } else {
      props.api.moveTo({ position: "right" })
    }
  }

  return (
    <div
      className="group-control"
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0px 8px",
        height: "100%",
        color: "var(--dv-activegroup-visiblepanel-tab-color)",
      }}
    >
      {props.isGroupActive && <Icon icon={Star} />}
      {Component && <Component />}
      <Icon
        title={isPopout ? "Close Window" : "Open In New Window"}
        icon={isPopout ? X : ExternalLink}
        onClick={onClick2}
      />
      {!isPopout && (
        <Icon
          title={isMaximized ? "Minimize View" : "Maximize View"}
          icon={isMaximized ? Minimize2 : Maximize2}
          onClick={onClick}
        />
      )}
    </div>
  )
}

export const LeftControls = (props: IDockviewHeaderActionsProps) => {
  const onClick = () => {
    props.containerApi.addPanel({
      id: `id_${Date.now().toString()}`,
      component: "default",
      title: `Tab ${randomId()}`, // this is a random id for the tab before it had a nextId function so might need to be changed
      position: {
        referenceGroup: props.group,
      },
    })
  }

  return (
    <div
      className="group-control"
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0px 8px",
        height: "100%",
        color: "var(--dv-activegroup-visiblepanel-tab-color)",
      }}
    >
      <Icon onClick={onClick} icon={Plus} />
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const PrefixHeaderControls = (_props: IDockviewHeaderActionsProps) => {
  return (
    <div
      className="group-control"
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0px 8px",
        height: "100%",
        color: "var(--dv-activegroup-visiblepanel-tab-color)",
      }}
    >
      <Icon icon={Menu} />
    </div>
  )
}
