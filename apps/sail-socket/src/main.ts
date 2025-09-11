import { Server } from "socket.io"
import { createServer } from "http"
import { type SailFDC3Server, initSocketService } from "@finos/fdc3-sail-desktop-agent"
import { APP_CONFIG } from "./constants"
import dotenv from "dotenv"

// Load environment variables from .env file
dotenv.config()

// running sessions - the server state
const sessions = new Map<string, SailFDC3Server>()

// Create HTTP server
const httpServer = createServer()

// Create Socket.IO server with CORS for localhost
const io = new Server(httpServer, {
  cors: {
    origin: Array.from(APP_CONFIG.CORS_ORIGINS),
    methods: ["GET", "POST"],
    credentials: true,
  },
})

const port = process.env.PORT || APP_CONFIG.DEFAULT_PORT

httpServer.listen(port, () => {
  console.log(`SAIL Socket Server is listening on port ${port}`)
})

initSocketService(io, sessions)
