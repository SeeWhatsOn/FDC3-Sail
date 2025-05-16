import dotenv from "dotenv"
import app from "./app"
import logger from "./utils/logger"

// Load environment variables
dotenv.config()

// Define port
const PORT = process.env.PORT || 3000

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
})
