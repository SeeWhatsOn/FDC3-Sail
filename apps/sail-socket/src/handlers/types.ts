import { Socket } from "socket.io"
import { SailAppManager } from '../services/SailAppManager';

/** Socket with authentication and app instance manager */
export interface AuthenticatedSocket extends Socket {
  userId: string;
  appInstanceManager?: SailAppManager;
}

/** Socket.IO callback type for handlers */
export type SocketIOCallback<T> = (result: T, error?: string) => void

/** Types of socket connections */
export const enum SocketType {
  DESKTOP_AGENT = "desktop_agent",
  APP = "app",
  CHANNEL = "channel",
}

/** Socket connection state */
export interface SocketConnectionState {
  fdc3ServerInstance?: SailFDC3Server
  appInstanceId?: string
  socketType?: SocketType
}

/** Configuration object for handler constants - re-exported from constants */
export const CONFIG = SOCKET_CONFIG

/** Legacy exports for backward compatibility */
export const APP_INSTANCE_PREFIX = CONFIG.APP_INSTANCE_PREFIX
export const DEBUG_RECONNECTION_SUFFIX = CONFIG.DEBUG_RECONNECTION_SUFFIX
export const POLLING_INTERVAL_MS = CONFIG.POLLING_INTERVAL_MS
export const STATE_REPORT_INTERVAL_MS = CONFIG.STATE_REPORT_INTERVAL_MS



/**
 * Creates a standardized error callback response
 * @param callback - The socket callback function
 * @param errorMessage - The error message to return
 */
export function handleCallbackError<T>(callback: SocketIOCallback<T>, errorMessage: string): void {
  callback(null as unknown as T, errorMessage)
}

/** AppInstance interface for type safety */
export interface AppInstance {
  channelSockets: Socket[]
  [key: string]: unknown
}

/** Log levels for structured logging */
export enum LogLevel {
  ERROR = "ERROR",
  WARN = "WARN",
  INFO = "INFO",
  DEBUG = "DEBUG",
}

/** Panel data interface for better type safety */
export interface PanelData {
  panelId: string
  tabId: string
  title: string
}

/** Directory app interface for consistent naming */
export interface DirectoryAppEntry {
  title: string
  hostManifests?: { sail?: unknown }
  details: unknown
}

/** Handler context passed to all handlers */
export interface HandlerContext {
  socket: Socket
  connectionState: SocketConnectionState
}
