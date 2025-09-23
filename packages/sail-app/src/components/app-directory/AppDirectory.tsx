import { useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "sail-ui"
import { Skeleton } from "sail-ui"
import type { DirectoryApp } from "@finos/fdc3-sail-shared"
import { ExternalLink } from "lucide-react"

import { useAppDirectoryStore } from "../../stores/appDirectoryStore"
import { useAppDirectorySocket } from "../../hooks/useAppDirectorySocket"
import { usePanelStore } from "../../stores/panelStore"

interface WebAppDetails {
  url: string
}

interface AppCardProps {
  app: DirectoryApp
  onAppClick: (app: DirectoryApp) => void
}

const AppCard = ({ app, onAppClick }: AppCardProps) => {
  const getAppIcon = (app: DirectoryApp) => {
    if (app.icons && app.icons.length > 0) {
      return app.icons[0].src
    }
    return "/default-app-icon.png" // fallback icon
  }

  const getAppUrl = (app: DirectoryApp) => {
    if (app.type === "web" && app.details) {
      return (app.details as WebAppDetails).url
    }
    return null
  }

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
      onClick={() => onAppClick(app)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <img
              src={getAppIcon(app)}
              alt={`${app.title} icon`}
              className="w-10 h-10 rounded-md object-cover"
              onError={e => {
                const target = e.target as HTMLImageElement
                target.src = "/default-app-icon.png"
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-medium line-clamp-1">{app.title}</CardTitle>
            {app.type === "web" && getAppUrl(app) && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <ExternalLink className="w-3 h-3" />
                <span className="truncate">Web App</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <CardDescription className="text-xs line-clamp-3">
          {app.description || "No description available"}
        </CardDescription>
        {app.version && (
          <div className="mt-2 text-xs text-muted-foreground">Version {app.version}</div>
        )}
      </CardContent>
    </Card>
  )
}

const AppDirectorySkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {Array.from({ length: 8 }).map((_, index) => (
      <Card key={index} className="animate-pulse">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-md" />
            <div className="flex-1">
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-3/4 mb-1" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-20 mt-2" />
        </CardContent>
      </Card>
    ))}
  </div>
)

export function AppDirectory() {
  const { apps, isLoading, error, loadApps } = useAppDirectoryStore()
  const { addPanel, activeTabId } = usePanelStore()

  // Set up WebSocket listener for real-time updates
  useAppDirectorySocket()

  // Load apps on component mount
  useEffect(() => {
    loadApps()
  }, [loadApps])

  const handleAppClick = (app: DirectoryApp) => {
    console.log("App clicked:", app)

    if (app.type === "web" && app.details) {
      const webDetails = app.details as WebAppDetails

      // Generate unique panel ID and instance title
      const instanceId = `${app.appId}-${Date.now()}`
      const instanceTitle = `${app.title} ${Date.now().toString().slice(-4)}`

      // Create AppPanel and add to dockview
      const appPanel = {
        title: instanceTitle,
        url: webDetails.url,
        tabId: activeTabId,
        panelId: instanceId,
        appId: app.appId,
        icon: app.icons?.[0]?.src || null,
      }

      addPanel(appPanel)
    }
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Apps</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">{error}</CardDescription>
            <button
              onClick={loadApps}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return <AppDirectorySkeleton />
  }

  if (apps.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Apps Available</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              No applications are currently available in the directory.
            </CardDescription>
            <button
              onClick={loadApps}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
            >
              Refresh
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">App Directory</h1>
        <p className="text-muted-foreground">
          Browse and launch applications ({apps.length} available)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {apps.map(app => (
          <AppCard key={app.appId} app={app} onAppClick={handleAppClick} />
        ))}
      </div>
    </div>
  )
}
