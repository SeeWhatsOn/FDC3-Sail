import { Application } from "../types"
import { data } from "../data/apps"

export const appService = {
  // Get app by id
  getAppById: async (appId: string): Promise<Application | null> => {
    // Parse appId to handle fully-qualified IDs (e.g., myAppId@host.domain.com)
    const parsedAppId = appId.split("@")[0]

    // Find the app in our data store
    const app = data.applications.find(
      (a) => a.appId === parsedAppId || a.appId === appId,
    )

    return app || null
  },

  // Get all apps
  getAllApps: async (): Promise<Application[]> => {
    return data.applications
  },
}
