import { Socket } from "socket.io"
import { SailFDC3Server } from "../model/fdc3/SailFDC3Server" // Adjust import path if necessary
import { SocketType } from "./utils" // Import the enum

export interface ConnectionState {
  socket: Socket
  sessionManager: SessionManager
  fdc3ServerInstance?: SailFDC3Server
  userSessionId?: string
  appInstanceId?: string
  type?: SocketType
  // Add other state relevant to a single connection if needed
}

export interface BaseMessageData {
  type: string
}

// Define helper interfaces for better type safety with fdc3Server
export interface Fdc3ChannelHandler {
  state: ChannelState[]
}

export interface MinimalFDC3ServerInternal extends FDC3Server {
  handlers: [Fdc3ChannelHandler, ...unknown[]]
}

/**
 * Represents the state of a Sail app.
 * Pending: App has a window, but isn't connected to FDC3
 * Open: App is connected to FDC3
 * NotResponding: App is not responding to heartbeats
 * Terminated: App Window has been closed
 */
export type SailData = AppRegistration & {
  socket?: Socket
  channelSockets: Socket[]
  url?: string
  hosting: AppHosting
  channel: string | null
  instanceTitle: string
}
