import type { Socket } from "socket.io-client"
import type { ISailPlatformApi } from "./ISailPlatformApi"
import { SailMessages, type SailMessage } from "../protocol/sail-messages"
import { MiddlewarePipeline, type Middleware } from "../middleware"

/**
 * Configuration for Remote Platform API (REST/WebSocket)
 */
export interface RemotePlatformApiConfig {
  /**
   * Socket.IO client for WebSocket communication
   */
  socket?: Socket

  /**
   * REST API base URL (alternative to WebSocket)
   */
  restApiUrl?: string

  /**
   * Enable debug logging
   */
  debug?: boolean
}

/**
 * Remote implementation of Sail Platform API.
 * 
 * This implementation stores workspaces, layouts, and config on a remote server
 * via REST API or WebSocket (Socket.IO). Suitable for multi-user, server-side storage.
 * 
 * @example
 * ```typescript
 * // Using WebSocket (Socket.IO)
 * const platformApi = new RemotePlatformApi({
 *   socket: socket,
 *   debug: true
 * })
 * 
 * // Using REST API
 * const platformApi = new RemotePlatformApi({
 *   restApiUrl: "https://api.example.com",
 *   debug: true
 * })
 * ```
 */
export class RemotePlatformApi implements ISailPlatformApi {
  private socket?: Socket
  private restApiUrl?: string
  private pipeline: MiddlewarePipeline<unknown>
  private debug: boolean

  constructor(config: RemotePlatformApiConfig) {
    if (!config.socket && !config.restApiUrl) {
      throw new Error("Either socket or restApiUrl must be provided")
    }
    this.socket = config.socket
    this.restApiUrl = config.restApiUrl
    this.pipeline = new MiddlewarePipeline()
    this.debug = config.debug ?? false
  }

  /**
   * Add middleware to the message processing pipeline.
   */
  use(middleware: Middleware<unknown>): this {
    this.pipeline.use(middleware)
    return this
  }

  private async emitWithAck<T>(type: string, payload: unknown): Promise<T> {
    if (this.socket) {
      const message: Partial<SailMessage> = {
        type: type as any,
        payload: payload as any,
      }

      let result: T | undefined

      await this.pipeline.execute({ message }, async ctx => {
        const msg = ctx.message as Partial<SailMessage>
        result = await this.socket!.emitWithAck(SailMessages.SAIL_EVENT, msg)
      })

      if (result === undefined) {
        throw new Error("Message processing failed or no response received")
      }

      return result
    } else if (this.restApiUrl) {
      // REST API implementation
      const response = await fetch(`${this.restApiUrl}/api/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`REST API error: ${response.statusText}`)
      }

      return (await response.json()) as T
    } else {
      throw new Error("No transport available")
    }
  }

  async getWorkspaces(): Promise<unknown[]> {
    return this.emitWithAck<unknown[]>("sailGetWorkspaces", {})
  }

  async getWorkspace(workspaceId: string): Promise<unknown | null> {
    return this.emitWithAck<unknown | null>("sailGetWorkspace", { workspaceId })
  }

  async createWorkspace(name: string, initialLayout?: unknown): Promise<unknown> {
    return this.emitWithAck<unknown>("sailCreateWorkspace", { name, initialLayout })
  }

  async deleteWorkspace(workspaceId: string): Promise<boolean> {
    return this.emitWithAck<boolean>("sailDeleteWorkspace", { workspaceId })
  }

  async getWorkspaceLayout(workspaceId: string): Promise<unknown> {
    return this.emitWithAck<unknown>("sailGetWorkspaceLayout", { workspaceId })
  }

  async saveWorkspaceLayout(workspaceId: string, layout: unknown): Promise<boolean> {
    return this.emitWithAck<boolean>("sailSaveWorkspaceLayout", { workspaceId, layout })
  }

  async getConfig(): Promise<unknown> {
    return this.emitWithAck<unknown>("sailGetConfig", {})
  }

  async updateConfig(config: unknown): Promise<boolean> {
    return this.emitWithAck<boolean>("sailUpdateConfig", { config })
  }
}

