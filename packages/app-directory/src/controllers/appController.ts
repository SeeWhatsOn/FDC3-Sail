import { Request, Response, NextFunction } from "express"
import { appService } from "../services/appService"

export const appController = {
  // Get application by id
  getAppById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { appId } = req.params

      // Get the app definition
      const app = await appService.getAppById(appId)

      if (!app) {
        return res.status(404).json({
          code: 404,
          message: `Application with id '${appId}' not found`,
        })
      }

      return res.status(200).json(app)
    } catch (error) {
      next(error)
      return error
    }
  },

  // Get all applications
  getAllApps: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // Get all app definitions
      const apps = await appService.getAllApps()

      return res.status(200).json({
        applications: apps,
        message: "OK",
      })
    } catch (error) {
      next(error)
      return error
    }
  },
}
