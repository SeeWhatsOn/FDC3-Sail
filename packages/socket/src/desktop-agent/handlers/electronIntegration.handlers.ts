import { v4 as uuid } from "uuid"
import { SailAppInstanceManager } from "../sailAppInstanceManager"
import { AppDirectoryManager } from "../../app-directory/appDirectoryManager"
import { SailFDC3Server } from "../sailFDC3Server"
import { HandlerContext, CONFIG, handleCallbackError, SocketIOCallback } from "./types"
import { TabDetail, ContextHistory } from "@finos/fdc3-sail-shared"
import { DirectoryApp } from "@finos/fdc3-web-impl"

// Electron integration constants
const ELECTRON_HELLO = "electron-hello"

// Electron integration types
interface ElectronHelloArgs {
  userSessionId: string
  url: string
  directories: string[]
  channels: TabDetail[]
  panels: unknown[]
  customApps: DirectoryApp[]
  contextHistory: ContextHistory
}

interface ElectronAppResponse {
  type: "app"
  userSessionId: string
  appId: string
  instanceId: string
  intentResolver: null
  channelSelector: null
}

interface ElectronDAResponse {
  type: "da"
}

/**
 * Gets the Sail URL from environment variables or returns default
 */
function getSailUrl(): string {
  return process.env.SAIL_URL || "http://localhost:8090"
}

/**
 * Handles Electron hello messages for app discovery and Desktop Agent initialization
 * @param electronHelloArgs - Electron hello arguments with URL and session info
 * @param callback - Socket callback to return app or DA response
 * @param context - Handler context with socket, connection state, and sessions
 */
function handleElectronHello(
  electronHelloArgs: ElectronHelloArgs,
  callback: SocketIOCallback<ElectronAppResponse | ElectronDAResponse>,
  { socket, connectionState, sessions }: HandlerContext
): void {
  console.log(`SAIL ELECTRON HELLO: ${JSON.stringify(electronHelloArgs)}`)
  const existingServer = sessions.get(electronHelloArgs.userSessionId)

  if (existingServer) {
    const matchingAppList = existingServer.getDirectory().retrieveAppsByUrl(electronHelloArgs.url)

    if (matchingAppList.length > 0) {
      const [firstApp] = matchingAppList
      console.log("SAIL Found app", firstApp.appId)

      const response: ElectronAppResponse = {
        type: "app",
        userSessionId: electronHelloArgs.userSessionId,
        appId: firstApp.appId,
        instanceId: `${CONFIG.APP_INSTANCE_PREFIX}${uuid()}`,
        intentResolver: null,
        channelSelector: null,
      }
      callback(response)
    } else {
      console.error("App not found", electronHelloArgs.url)
      handleCallbackError(callback as (result: unknown, error?: string) => void, "App not found")
    }
  } else if (electronHelloArgs.url === getSailUrl()) {
    connectionState.userSessionId = electronHelloArgs.userSessionId
    const serverContext = new SailAppInstanceManager(new AppDirectoryManager(), socket)
    const newServer = new SailFDC3Server(serverContext, {
      ...electronHelloArgs,
      directories: [],
      channels: [],
      panels: [],
      customApps: [],
      contextHistory: {},
    })
    serverContext.setFDC3Server(newServer)
    sessions.set(electronHelloArgs.userSessionId, newServer)

    const response: ElectronDAResponse = { type: "da" }
    callback(response)
  } else {
    console.error("Session not found", connectionState.userSessionId)
    handleCallbackError(callback as (result: unknown, error?: string) => void, "Session not found")
  }
}

/**
 * Registers electron-specific socket handlers
 */
export function registerElectronHandlers(context: HandlerContext): void {
  const { socket } = context

  socket.on(
    ELECTRON_HELLO,
    (
      electronHelloArgs: ElectronHelloArgs,
      callback: SocketIOCallback<ElectronAppResponse | ElectronDAResponse>
    ) => {
      handleElectronHello(electronHelloArgs, callback, context)
    }
  )
}
