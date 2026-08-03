/**
 * FDC3 Desktop Agent — public API.
 *
 * `SailDesktopAgent` is the entry point: construct it, implement {@link AppLauncher},
 * and wire host UI through the grouped controllers (`intentResolver`, `channels`, `apps`).
 *
 * The browser app-connection edge (WCP handshake, per-app `MessagePort`, routing)
 * is internal — the agent owns it. There is no transport abstraction to configure.
 */

// The Desktop Agent
export {
  SailDesktopAgent,
  type SailDesktopAgentOptions,
  type SailDesktopAgentHostControllers,
  type SailDesktopAgentChannels,
  type SailDesktopAgentApps,
  type AppChannelChangeEvent,
  type HandshakeFailureEvent,
} from "./agent/sail-desktop-agent"

export type { DesktopAgentAppInstance, DesktopAgentOpenOptions } from "./agent/desktop-agent"

/**
 * @internal Base class of {@link SailDesktopAgent}. Exported because TypeScript
 * declaration emit requires it to be nameable — not an entry point. Construct
 * `SailDesktopAgent` instead.
 */
export type { DesktopAgent } from "./agent/desktop-agent"

// Validation policy
export type { ValidationMode } from "./agent/default-config"

// Agent identity reported to apps via fdc3.getInfo()
export type { SailImplementationMetadata } from "./agent/default-config"

/**
 * The eight FDC3 standard user channels.
 *
 * Exported so hosts can extend rather than redeclare them:
 * `userChannels: [...DEFAULT_FDC3_USER_CHANNELS, ...myChannels]`. Omit the option
 * entirely to get exactly this set.
 */
export { DEFAULT_FDC3_USER_CHANNELS } from "./default-user-channels"

// Host contracts — implement these to integrate a shell
export * from "./host-contracts/index"

// Logging
export * from "./interfaces/index"

// App directory
export type { DirectoryApp, WebAppDetails } from "./app-directory/types"

// Error types a host may see on a `cause` chain or in injected-logger output.
// `routeDACPMessage` converts both to FDC3 wire errors — neither is re-thrown to a host.
export { DACPTimeoutError, DACPProcessingError } from "./dacp/dacp-errors"

/**
 * App-connection types that appear in the public agent surface.
 *
 * `AppConnectionMetadata` is the `onAppConnected` payload; `AppConnectionOptions`
 * configures the edge. `BrowserAppConnection` is `@internal` — exported only
 * because `SailDesktopAgent.connector` is typed with it and declaration emit
 * requires the name.
 */
export type {
  AppConnectionMetadata,
  AppConnectionOptions,
} from "./app-connection/browser-app-connection"
export type { BrowserAppConnection } from "./app-connection/browser-app-connection"
