import express from "express"
import helmet from "helmet"
import compression from "compression"
import cors from "cors"
import morgan from "morgan"
import { jwtAuth } from "./middleware/auth"
import { errorHandler } from "./middleware/errorHandler"
import appRoutes from "./routes/appRoutes"
import logger from "./utils/logger"

// Initialize Express app
const app = express()

// Middleware
app.use(helmet()) // Security headers
app.use(compression()) // Compress responses
app.use(cors()) // CORS support
app.use(express.json()) // Parse JSON request bodies
app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  }),
) // Logging

// Base path for app directory API
const API_BASE_PATH = "/appd"

// Routes
app.use(`${API_BASE_PATH}/v2`, jwtAuth, appRoutes)
app.use(`${API_BASE_PATH}/v1`, jwtAuth, appRoutes) // For backward compatibility

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" })
})

// Error handling middleware
app.use(errorHandler)

export default app
