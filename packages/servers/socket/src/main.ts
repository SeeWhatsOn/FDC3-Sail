import { createServer } from "http"
import { Server, Socket } from "socket.io"
import { SailFDC3Server } from "./handlers/da/SailFDC3Server"
import {
  AppHelloArgs,
  APP_HELLO,
  CHANNEL_RECEIVER_HELLO,
  CHANNEL_RECEIVER_UPDATE,
  ChannelReceiverHelloRequest,
  ChannelReceiverUpdate,
  DA_DIRECTORY_LISTING,
  DA_HELLO,
  DA_REGISTER_APP_LAUNCH,
  DesktopAgentDirectoryListingArgs,
  DesktopAgentHelloArgs,
  DesktopAgentRegisterAppLaunchArgs,
  ElectronDAResponse,
  ElectronHelloArgs,
  ELECTRON_HELLO,
  FDC3_APP_EVENT,
  SAIL_APP_STATE,
  SAIL_CHANNEL_CHANGE,
  SAIL_CLIENT_STATE,
  SAIL_INTENT_RESOLVE_ON_CHANNEL,
  SailChannelChangeArgs,
  SailClientStateArgs,
  SailIntentResolveOpenChannelArgs,
} from "@finos/fdc3-sail-common" // Assuming common types are needed here
import dotenv from "dotenv"
import { State } from "@finos/fdc3-web-impl" // Assuming State enum is needed
import { v4 as uuid } from "uuid" // Assuming uuid is needed

// TODO: Move handler logic into separate files/functions in ./handlers/
import {
  getSailUrl,
  getFdc3ServerInstance,
  SocketType, // Assuming SocketType enum is needed
  DEBUG_MODE, // Assuming DEBUG_MODE is needed
  debugReconnectionNumber, // Assuming this state is needed, consider better state management
} from "./handlers/da/initSocketService" // Temporarily import until refactored

// Load environment variables from .env file
dotenv.config()

const PORT = parseInt(process.env.PORT ?? "8090")

// Running sessions - the server state
const sessions = new Map<string, SailFDC3Server>()

const httpServer = createServer()
const io = new Server(httpServer, {
  // Configure CORS if needed, e.g.:
  // cors: {
  //   origin: "*", // Adjust for production
  //   methods: ["GET", "POST"]
  // }
})

io.on("connection", (socket: Socket) => {
  let fdc3ServerInstance: SailFDC3Server | undefined = undefined
  let userSessionId: string | undefined
  let appInstanceId: string | undefined
  let type: SocketType | undefined = undefined
  let reporter: NodeJS.Timeout | undefined = undefined

  console.log(`Socket connected: ${socket.id}`)

  // --- Handler Registrations (To be refactored) ---
  // Replace these inline functions with calls to imported handler functions

  socket.on(
    ELECTRON_HELLO,
    async function (
      props: ElectronHelloArgs,
      callback: (success: any, err?: string) => void,
    ) {
      // TODO: Move this logic to a handler function
      console.log("SAIL ELECTRON HELLO: " + JSON.stringify(props))
      // ... (Existing ELECTRON_HELLO logic from initSocketService.ts)
      // Note: You'll need to pass `sessions`, `socket`, potentially `userSessionId`
      //       and modify the handler to set `userSessionId` and return the response.
      // Example (conceptual):
      // const { response, error, serverInstance } = await handleElectronHello(props, sessions, socket);
      // if (serverInstance) fdc3ServerInstance = serverInstance; // If DA connection
      // if (error) callback(null, error); else callback(response);
      callback(null, "Handler not implemented yet") // Placeholder
    },
  )

  socket.on(
    DA_HELLO,
    async function (
      props: DesktopAgentHelloArgs,
      callback: (success: any, err?: string) => void,
    ) {
      // TODO: Move this logic to a handler function
      console.log("SAIL DA HELLO:" + JSON.stringify(props))
      type = SocketType.DESKTOP_AGENT
      userSessionId = props.userSessionId
      // ... (Existing DA_HELLO logic from initSocketService.ts)
      // Note: You'll need to pass `sessions`, `socket`, `props`
      //       and modify the handler to return the created/updated server instance.
      // Example (conceptual):
      // const { serverInstance, error } = await handleDaHello(props, sessions, socket);
      // if (serverInstance) fdc3ServerInstance = serverInstance;
      // callback(!error, error);

      // Temporary assignment for reporter setup below
      fdc3ServerInstance = sessions.get(userSessionId) // Assuming DA_HELLO populates sessions

      callback(null, "Handler not implemented yet") // Placeholder
    },
  )

  socket.on(
    DA_DIRECTORY_LISTING,
    async function (
      props: DesktopAgentDirectoryListingArgs,
      callback: (success: any, err?: string) => void,
    ) {
      // TODO: Move this logic to a handler function
      const userSessionId = props.userSessionId
      const session = await getFdc3ServerInstance(sessions, userSessionId) // This helper needs access to sessions
      if (session) {
        callback(session?.getDirectory().allApps)
      } else {
        console.error("Session not found", userSessionId)
        callback(null, "Session not found")
      }
    },
  )

  socket.on(
    DA_REGISTER_APP_LAUNCH,
    async function (
      props: DesktopAgentRegisterAppLaunchArgs,
      callback: (success: any, err?: string) => void,
    ) {
      // TODO: Move this logic to a handler function
      console.log("SAIL DA REGISTER APP LAUNCH: " + JSON.stringify(props))
      // ... (Existing DA_REGISTER_APP_LAUNCH logic)
      callback(null, "Handler not implemented yet") // Placeholder
    },
  )

  socket.on(
    SAIL_CLIENT_STATE,
    async function (
      props: SailClientStateArgs,
      callback: (success: any, err?: string) => void,
    ) {
      // TODO: Move this logic to a handler function
      console.log("SAIL CLIENT STATE: " + JSON.stringify(props))
      // ... (Existing SAIL_CLIENT_STATE logic)
      callback(null, "Handler not implemented yet") // Placeholder
    },
  )

  socket.on(
    SAIL_CHANNEL_CHANGE,
    async function (
      props: SailChannelChangeArgs,
      callback: (success: any, err?: string) => void,
    ) {
      // TODO: Move this logic to a handler function
      console.log("SAIL CHANNEL CHANGE: " + JSON.stringify(props))
      // ... (Existing SAIL_CHANNEL_CHANGE logic)
      callback(null, "Handler not implemented yet") // Placeholder
    },
  )

  socket.on(
    APP_HELLO,
    async function (
      props: AppHelloArgs,
      callback: (success: any, err?: string) => void,
    ) {
      // TODO: Move this logic to a handler function
      console.log("SAIL APP HELLO: " + JSON.stringify(props))
      appInstanceId = props.instanceId
      userSessionId = props.userSessionId
      type = SocketType.APP
      // ... (Existing APP_HELLO logic)
      // Note: Needs access to sessions, socket, props. Needs to set fdc3ServerInstance.
      // Example (conceptual):
      // const { hosting, error, serverInstance } = await handleAppHello(props, sessions, socket);
      // if (serverInstance) fdc3ServerInstance = serverInstance;
      // if (error) callback(null, error); else callback(hosting);
      callback(null, "Handler not implemented yet") // Placeholder
    },
  )

  socket.on(FDC3_APP_EVENT, function (data, from): void {
    // TODO: Move this logic to a handler function
    // Note: Needs access to fdc3ServerInstance
    if (!data?.type?.startsWith("heartbeat")) {
      console.log(
        "SAIL FDC3_APP_EVENT: " + JSON.stringify(data) + " from " + from,
      )
    }

    if (fdc3ServerInstance != undefined) {
      try {
        fdc3ServerInstance.receive(data, from)
        // ... (broadcast notification logic) ...
      } catch (e) {
        console.error("Error processing message", e)
      }
    } else {
      console.error("No Server instance for FDC3_APP_EVENT")
    }
  })

  socket.on(
    CHANNEL_RECEIVER_HELLO,
    async function (
      props: ChannelReceiverHelloRequest,
      callback: (
        success: ChannelReceiverUpdate | undefined,
        err?: string,
      ) => void,
    ) {
      // TODO: Move this logic to a handler function
      userSessionId = props.userSessionId
      appInstanceId = props.instanceId
      type = SocketType.CHANNEL
      // ... (Existing CHANNEL_RECEIVER_HELLO logic)
      // Note: Needs sessions, socket, props. Needs to set fdc3ServerInstance.
      callback(undefined, "Handler not implemented yet") // Placeholder
    },
  )

  socket.on(
    SAIL_INTENT_RESOLVE_ON_CHANNEL,
    function (
      props: SailIntentResolveOpenChannelArgs,
      callback: (success: void, err?: string) => void,
    ) {
      // TODO: Move this logic to a handler function
      // Note: Needs fdc3ServerInstance
      console.log("SAIL INTENT RESOLVE ON CHANNEL: " + JSON.stringify(props))
      fdc3ServerInstance!.serverContext.openOnChannel(
        props.appId,
        props.channel,
      )
      callback(undefined)
    },
  )

  // --- State Reporter ---
  // This needs fdc3ServerInstance to be set by DA_HELLO or similar
  // Consider starting this only *after* fdc3ServerInstance is confirmed.
  reporter = setInterval(async () => {
    if (fdc3ServerInstance) {
      try {
        const state = await fdc3ServerInstance.serverContext.getAllApps()
        socket.emit(SAIL_APP_STATE, state)
      } catch (err) {
        console.error("Error fetching app state for reporter:", err)
        // Handle error, maybe stop reporter if instance is invalid
      }
    }
  }, 3000)

  // --- Disconnect Handler ---
  socket.on("disconnect", async function (): Promise<void> {
    console.log(`Socket disconnected: ${socket.id}`)
    if (reporter) {
      clearInterval(reporter)
    }

    // TODO: Move this logic to a handler function
    // Note: Needs fdc3ServerInstance, type, appInstanceId, userSessionId, sessions
    if (fdc3ServerInstance) {
      if (type == SocketType.APP && appInstanceId) {
        await fdc3ServerInstance.serverContext.setAppState(
          appInstanceId,
          State.Terminated,
        )
        const remaining =
          await fdc3ServerInstance.serverContext.getConnectedApps()
        console.log(
          `App disconnect: ${appInstanceId}. ${remaining.length} remaining.`,
        )
      } else if (type == SocketType.CHANNEL && appInstanceId) {
        const details = fdc3ServerInstance
          .getServerContext()
          .getInstanceDetails(appInstanceId)
        if (details) {
          details.channelSockets = details.channelSockets.filter(
            (s) => s.id !== socket.id,
          ) // Remove specific socket
          fdc3ServerInstance
            .getServerContext()
            .setInstanceDetails(appInstanceId, details)
          console.log(
            `Channel Selector Disconnect for app ${appInstanceId} on socket ${socket.id}`,
          )
        }
      } else if (type == SocketType.DESKTOP_AGENT && userSessionId) {
        fdc3ServerInstance.shutdown()
        sessions.delete(userSessionId)
        console.log("Desktop Agent Disconnected", userSessionId)
      } else {
        console.log("Disconnect from unknown socket type or missing IDs")
      }
    } else {
      console.log("Disconnect from socket with no associated server instance.")
    }
  })
})

httpServer.listen(PORT, () => {
  console.log(
    `SAIL Server is listening in ${process.env.NODE_ENV} mode on port ${PORT}. Connect via ${getSailUrl()}`,
  )
})

// Handle server shutdown gracefully
const shutdown = () => {
  console.log("Shutting down server...")
  io.close(() => {
    console.log("Socket.IO server closed.")
    httpServer.close(() => {
      console.log("HTTP server closed.")
      process.exit(0)
    })
  })

  // Force close after timeout
  setTimeout(() => {
    console.error("Could not close connections in time, forcing shutdown")
    process.exit(1)
  }, 5000) // 5 seconds timeout
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

export {
  getSailUrl,
  getFdc3ServerInstance,
  SocketType,
  DEBUG_MODE,
  debugReconnectionNumber,
}

function getFdc3ServerInstance( // Keep this function here for now as it's used locally
  sessions: Map<string, SailFDC3Server>,
  userSessionId: string,
): Promise<SailFDC3Server> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const fdc3Server = sessions.get(userSessionId)
      if (fdc3Server) {
        clearInterval(interval)
        resolve(fdc3Server)
      }
    }, 100) // Consider adding a timeout/rejection mechanism
  })
}

// Make sure SocketType enum is exported
export enum SocketType { // Added export
  DESKTOP_AGENT,
  APP,
  CHANNEL,
}

// Make sure DEBUG_MODE is exported
export const DEBUG_MODE = true // Added export

// Make sure debugReconnectionNumber is exported (and consider refactoring later)
export let debugReconnectionNumber = 0 // Added export
