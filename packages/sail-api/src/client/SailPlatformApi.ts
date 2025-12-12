import type { SailPlatformApi as ISailPlatformApi } from "../platform/SailPlatformApi"
import {
  LocalStoragePlatformApi,
  type LocalStoragePlatformApiConfig,
} from "../platform/LocalStoragePlatformApi"
import { RemotePlatformApi, type RemotePlatformApiConfig } from "../platform/RemotePlatformApi"

/**
 * Configuration for Sail Platform API
 */
export interface SailPlatformApiConfig {
  /**
   * Storage backend type
   * - "localStorage" - Use browser localStorage (default)
   * - "remote" - Use remote server via REST/WebSocket
   */
  storage?: "localStorage" | "remote"

  /**
   * Configuration for localStorage backend
   */
  localStorage?: LocalStoragePlatformApiConfig

  /**
   * Configuration for remote backend
   */
  remote?: RemotePlatformApiConfig
}

/**
 * Sail Platform API - High-level API for Sail-specific features.
 *
 * This class provides a unified interface for Sail Platform features (workspaces,
 * layouts, config) with pluggable storage backends. Defaults to localStorage
 * for client-side storage, but can be configured to use remote storage.
 *
 * @example
 * ```typescript
 * // Default: localStorage (client-side)
 * const platformApi = new SailPlatformApi()
 *
 * // Explicit localStorage
 * const platformApi = new SailPlatformApi({
 *   storage: "localStorage",
 *   localStorage: { keyPrefix: "sail_", debug: true }
 * })
 *
 * // Remote via WebSocket
 * const platformApi = new SailPlatformApi({
 *   storage: "remote",
 *   remote: { socket: socket, debug: true }
 * })
 *
 * // Remote via REST
 * const platformApi = new SailPlatformApi({
 *   storage: "remote",
 *   remote: { restApiUrl: "https://api.example.com" }
 * })
 *
 * // Usage
 * const workspaces = await platformApi.getWorkspaces()
 * await platformApi.saveWorkspaceLayout(workspaceId, layout)
 * ```
 */
export class SailPlatformApi {
  private api: ISailPlatformApi

  constructor(config?: SailPlatformApiConfig) {
    const storageType = config?.storage ?? "localStorage"

    if (storageType === "remote") {
      if (!config?.remote) {
        throw new Error("Remote storage requires remote configuration")
      }
      this.api = new RemotePlatformApi(config.remote)
    } else {
      // Default to localStorage
      this.api = new LocalStoragePlatformApi(config?.localStorage)
    }
  }

  /**
   * Get all workspaces for the current user.
   */
  async getWorkspaces(): Promise<unknown[]> {
    return this.api.getWorkspaces()
  }

  /**
   * Get a specific workspace by ID.
   */
  async getWorkspace(workspaceId: string): Promise<unknown | null> {
    return this.api.getWorkspace(workspaceId)
  }

  /**
   * Create a new workspace.
   */
  async createWorkspace(name: string, initialLayout?: unknown): Promise<unknown> {
    return this.api.createWorkspace(name, initialLayout)
  }

  /**
   * Delete a workspace.
   */
  async deleteWorkspace(workspaceId: string): Promise<boolean> {
    return this.api.deleteWorkspace(workspaceId)
  }

  /**
   * Get the layout for a specific workspace.
   */
  async getWorkspaceLayout(workspaceId: string): Promise<unknown> {
    return this.api.getWorkspaceLayout(workspaceId)
  }

  /**
   * Save the layout for a specific workspace.
   */
  async saveWorkspaceLayout(workspaceId: string, layout: unknown): Promise<boolean> {
    return this.api.saveWorkspaceLayout(workspaceId, layout)
  }

  /**
   * Get user configuration.
   */
  async getConfig(): Promise<unknown> {
    return this.api.getConfig()
  }

  /**
   * Update user configuration.
   */
  async updateConfig(config: unknown): Promise<boolean> {
    return this.api.updateConfig(config)
  }
}
