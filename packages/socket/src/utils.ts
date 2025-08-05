// Minimal essential utilities - replaces 7 utility files
import { Socket } from "socket.io"

// Socket type identification
export enum SocketType {
  DESKTOP_AGENT = "desktop-agent",
  APP = "app",
  CHANNEL = "channel",
}

// Simple error handling with proper callback typing
export function handleError<T = unknown>(
  operation: string,
  error: Error | string,
  callback?: (data: T | null, error?: string | null) => void,
): void {
  const errorMessage = error instanceof Error ? error.message : error
  console.error(`Error in ${operation}:`, errorMessage)

  if (callback) {
    callback(null, errorMessage)
  }
}

// Simple logging (replaces complex logHandlerEvent)
export function logEvent(
  category: string,
  event: string,
  data?: Record<string, string | number | boolean>,
): void {
  const timestamp = new Date().toISOString()
  const dataStr = data
    ? ` | ${Object.entries(data)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ")}`
    : ""
  console.log(`${timestamp} [${category}] ${event}${dataStr}`)
}

// Server URL helper
export function getServerUrl(): string {
  return process.env.SAIL_URL || "http://localhost:8090"
}

// Socket connection validation
export function isSocketConnected(socket: Socket): boolean {
  return socket && socket.connected
}

// Simple UUID generation helper
export function generateId(): string {
  return `sail-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
