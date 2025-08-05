import { promises as fs } from "fs"
import { BasicDirectory, DirectoryApp } from "@finos/fdc3-web-impl"

export type AppDirectory = {
  applications: DirectoryApp[]
  message?: string
}

// TODO: move to a shared location and get correct path
export const DEFAULT_ICON = "/icons/control/choose-app.svg"

export function getIcon(app: DirectoryApp | undefined) {
  if (app && app?.icons?.length) {
    return app.icons[0].src
  } else {
    return DEFAULT_ICON
  }
}

// load an app directory from a remote URL or local file
async function loadAppDirectory(url: string): Promise<AppDirectory> {
  if (url.startsWith("http")) {
    // load an app directory from a remote URL
    const response = await fetch(url)
    return (await response.json()) as AppDirectory
  } else {
    // load an app directory from a local file
    const data = await fs.readFile(url, { encoding: "utf8" })
    return (await JSON.parse(data)) as AppDirectory
  }
}

export class SailDirectory extends BasicDirectory {
  constructor() {
    super([])
  }

  async addAppsFromAppDirectory(url: string): Promise<void> {
    try {
      const { applications } = await loadAppDirectory(url)
      // Create a Set of appIds from the current this.allApps for efficient lookup.
      // This also helps in de-duplicating apps from the incoming 'applications' list itself
      // with respect to what gets added to this.allApps.
      const existingAppIds = new Set(
        this.allApps.map((existingApp) => existingApp.appId),
      )

      const appsToAdd = applications.filter((app) => {
        if (!existingAppIds.has(app.appId)) {
          // If the app is not already known (either from previous allApps or earlier in this 'applications' list),
          // mark its ID as now known and include it for addition.
          existingAppIds.add(app.appId)
          return true
        }
        return false
      })

      if (appsToAdd.length > 0) {
        this.allApps.push(...appsToAdd)
      }
    } catch (e) {
      console.error(`Error loading app directory from ${url}:`, e)
    }
  }

  clearApps() {
    this.allApps = []
  }

  /**
   * Replaces all currently loaded apps with apps loaded from the specified app directory URLs.
   * This method will:
   * 1. Clear all existing apps from the directory
   * 2. Load and parse each app directory URL in sequence
   * 3. Add all unique apps from each directory to the internal app collection
   *
   * @param urls - Array of URLs pointing to app directory JSON files. Can be HTTP(S) URLs or local file paths
   * @throws Will log but not throw errors if individual app directory loads fail
   * @example
   * await directory.replaceAppsFromAppDirectories([
   *   'https://example.com/app-directory.json',
   *   '/local/path/to/directory.json'
   * ]);
   */
  async replaceAppsFromAppDirectories(urls: string[]) {
    this.clearApps()
    for (const url of urls) {
      await this.addAppsFromAppDirectory(url)
    }
    console.log("Loaded " + this.allApps.length + " apps")
  }

  /**
   * Replace all apps in the directory with apps from the provided directory objects
   * @param directories - Array of directory objects with apps property
   */
  replaceAppsFromDirectoryObjects(directories: { apps: DirectoryApp[] }[]) {
    this.clearApps()
    if (directories && Array.isArray(directories)) {
      for (const directory of directories) {
        if (directory && directory.apps && Array.isArray(directory.apps)) {
          for (const app of directory.apps) {
            this.addApp(app)
          }
        }
      }
    }
    console.log("Loaded " + this.allApps.length + " apps")
  }

  addApp(app: DirectoryApp) {
    this.allApps.push(app)
  }

  retrieveAppsByUrl(url: string): DirectoryApp[] {
    return this.retrieveAllApps().filter(
      (app) => app.type == "web" && (app.details as { url: string }).url == url,
    )
  }
}
