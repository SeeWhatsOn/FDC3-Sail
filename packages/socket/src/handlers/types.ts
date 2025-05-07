import { Socket } from "socket.io"
import { SailFDC3Server } from "./desktop-agent/SailFDC3Server" // Adjust import path if necessary
import { SocketType } from "./utils" // Import the enum

export interface ConnectionState {
  socket: Socket
  sessions: Map<string, SailFDC3Server>
  fdc3ServerInstance?: SailFDC3Server
  userSessionId?: string
  appInstanceId?: string
  type?: SocketType
  // Add other state relevant to a single connection if needed
}
