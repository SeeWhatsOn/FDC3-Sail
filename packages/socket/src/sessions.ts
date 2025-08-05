// Simple session management - replaces complex SessionManager
import { Socket } from "socket.io"

import { DirectoryApp } from "@finos/fdc3-web-impl"
import { AppIdentifier, AppIntent, Context } from "@finos/fdc3"
import { TabDetail, ContextHistory } from "@finos/fdc3-sail-common"

// App instance interface for better typing
export interface AppInstance {
  instanceId: string
  appId: string
  state: import("@finos/fdc3-web-impl").State
  socket?: Socket
  channelSockets: Socket[]
  url?: string
  hosting: import("@finos/fdc3-sail-common").AppHosting
  channel: string | null
  instanceTitle: string
}

// Simple interface for FDC3 server (will be implemented by SimpleFDC3Server)
export interface FDC3Server {
  shutdown(): Promise<void>
  getAppDirectory(): { allApps: DirectoryApp[] }
  serverContext: {
    getDesktopAgentSocket(): Socket
    getInstanceDetails(instanceId: string): AppInstance | undefined
    setInstanceDetails(instanceId: string, details: AppInstance): void
    getActiveAppInstances(): Promise<AppInstance[]>
    getTabs(): TabDetail[]
    cleanupDisconnectedChannelSockets(): void
    reloadAppDirectories(
      urls: string[],
      customApps: DirectoryApp[],
    ): Promise<void>
    updateChannelData(channels: TabDetail[], history?: ContextHistory): void
    setAppState(
      instanceId: string,
      state: import("@finos/fdc3-web-impl").State,
    ): Promise<void>
    post(message: object, instanceId: string): Promise<void>
    notifyUserChannelsChanged(
      instanceId: string,
      channelId: string | null,
    ): Promise<void>
    narrowIntents(
      raiser: AppIdentifier,
      intents: AppIntent[],
      context: Context,
    ): Promise<AppIntent[]>
    open(appId: string): Promise<string>
    openOnChannel(appId: string, channel: string): Promise<void>
    isAppConnected(instanceId: string): Promise<boolean>
    getConnectedApps(): Promise<
      Array<{
        appId: string
        instanceId: string
        state: import("@finos/fdc3-web-impl").State
      }>
    >
    setInitialChannel(app: AppIdentifier): Promise<void>
    notifyBroadcastContext(broadcastEvent: {
      payload: { channelId: string; context: Context }
    }): void
  }
}

// Simple session storage - just a Map
const sessions = new Map<string, FDC3Server>()
const sessionCreationLocks = new Map<string, Promise<void>>()

// Simple session operations
export function createSession(
  sessionId: string,
  server: FDC3Server,
): Promise<void> {
  if (sessionCreationLocks.has(sessionId)) {
    return sessionCreationLocks.get(sessionId)!
  }

  if (sessions.has(sessionId)) {
    console.log(`Session already exists: ${sessionId}`)
    return Promise.resolve()
  }

  const creationPromise = (async () => {
    console.log(`Creating session: ${sessionId}`)
    sessions.set(sessionId, server)
  })()

  sessionCreationLocks.set(sessionId, creationPromise)

  creationPromise.finally(() => {
    sessionCreationLocks.delete(sessionId)
  })

  return creationPromise
}

export function getSession(sessionId: string): FDC3Server | undefined {
  return sessions.get(sessionId)
}

export function removeSession(sessionId: string): boolean {
  const session = sessions.get(sessionId)
  if (session) {
    sessions.delete(sessionId)
    return true
  }
  return false
}

export function getAllSessions(): Map<string, FDC3Server> {
  return new Map(sessions)
}

export async function shutdownAllSessions(): Promise<void> {
  const shutdownPromises: Promise<void>[] = []

  sessions.forEach((server, sessionId) => {
    console.log(`Shutting down FDC3 session: ${sessionId}`)
    shutdownPromises.push(server.shutdown())
  })

  await Promise.all(shutdownPromises)
  sessions.clear()
}

// Helper function to get or await a session (simplified version of getOrAwaitFdc3Server)
export function getSessionOrThrow(sessionId: string): FDC3Server {
  const session = sessions.get(sessionId)
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`)
  }
  return session
}
