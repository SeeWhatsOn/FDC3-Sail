import { Socket } from "socket.io"
import type { SailFDC3Server } from "@finos/fdc3-sail-desktop-agent"

/**
 * Extended Socket interface with authentication and FDC3 session data
 */
export interface AuthenticatedSocket extends Socket {
  userId: string
  sessionId: string
  isAuthenticated: boolean
  desktopAgent?: SailFDC3Server // FDC3 Desktop Agent instance
}

/**
 * Authentication result interface
 */
export interface AuthResult {
  success: boolean
  userId?: string
  sessionId?: string
  error?: string
}

/**
 * Simple authentication function - validates user credentials
 * In production, this would integrate with JWT, OAuth, etc.
 */
export function authenticateUser(_token?: string, userId?: string): AuthResult {
  // For development/demo purposes - simple validation
  // In production, this would verify JWT tokens, API keys, etc.

  if (!userId) {
    return {
      success: false,
      error: "Missing userId in authentication",
    }
  }

  // For now, accept any non-empty userId
  // TODO: Implement real token validation
  const sessionId = `session-${userId}-${Date.now()}`

  return {
    success: true,
    userId,
    sessionId,
  }
}

/**
 * Socket.IO authentication middleware
 * Validates authentication before allowing socket connection
 */
export function authMiddleware(socket: Socket, next: (err?: Error) => void) {
  // Check both auth object and query parameters for flexibility
  const authData = socket.handshake.auth || {}
  const queryData = socket.handshake.query || {}

  const token = (authData.token as string) || (queryData.token as string)
  const userId = (authData.userId as string) || (queryData.userId as string)

  console.log("🔐 Authenticating socket connection:", {
    userId,
    hasToken: !!token,
    source: authData.userId ? "auth" : "query",
  })

  const authResult = authenticateUser(token, userId)

  if (!authResult.success) {
    console.error("❌ Authentication failed:", authResult.error)
    return next(new Error(authResult.error || "Authentication failed"))
  }

  // Extend socket with authentication info
  const authSocket = socket as AuthenticatedSocket
  authSocket.userId = authResult.userId!
  authSocket.sessionId = authResult.sessionId!
  authSocket.isAuthenticated = true

  console.log("✅ Authentication successful:", {
    userId: authResult.userId,
    sessionId: authResult.sessionId,
  })

  next()
}
