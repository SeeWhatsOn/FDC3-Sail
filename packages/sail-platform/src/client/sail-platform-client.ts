/**
 * Configuration for Sail Platform Client
 */
export interface SailPlatformClientConfig {
  /**
   * Prefix for storage keys.
   * @defaultValue "sail_"
   */
  keyPrefix?: string

  /**
   * Storage implementation.
   * @defaultValue globalThis.localStorage
   */
  storage?: Storage

  /**
   * Enable debug logging.
   */
  debug?: boolean
}

/**
 * Sail Platform Client - stores a single host-owned config blob in `Storage`
 * (browser `localStorage` by default, or any injected `Storage` implementation).
 *
 * @example
 * ```typescript
 * const client = new SailPlatformClient<MyConfig>({ keyPrefix: "sail_" })
 * await client.updateConfig(config)
 * const config = await client.getConfig()
 * ```
 */
export class SailPlatformClient<T = unknown> {
  private readonly keyPrefix: string
  private readonly storage: Storage
  private readonly debug: boolean

  constructor(config?: SailPlatformClientConfig) {
    this.keyPrefix = config?.keyPrefix ?? "sail_"
    this.storage = config?.storage ?? globalThis.localStorage
    this.debug = config?.debug ?? false
  }

  private get configKey(): string {
    return `${this.keyPrefix}config`
  }

  /**
   * Get the stored config, or `null` if nothing is stored or the stored value
   * cannot be read.
   */
  async getConfig(): Promise<T | null> {
    try {
      const item = this.storage.getItem(this.configKey)
      if (!item) return Promise.resolve(null)
      return Promise.resolve(JSON.parse(item) as T)
    } catch (error) {
      if (this.debug) {
        console.error(`[SailPlatformClient] Error reading ${this.configKey}:`, error)
      }
      return Promise.resolve(null)
    }
  }

  /**
   * Persist the config, replacing any previously stored value.
   */
  async updateConfig(config: T): Promise<void> {
    this.storage.setItem(this.configKey, JSON.stringify(config))
    return Promise.resolve()
  }
}
