import { Router } from "express"
import { appController } from "../controllers/appController"

const router = Router()

// GET /v2/apps/{appId} - Retrieve an application definition
router.get("/apps/:appId", appController.getAppById)

// GET /v2/apps - Retrieve all application definitions
router.get("/apps", appController.getAllApps)

export default router
