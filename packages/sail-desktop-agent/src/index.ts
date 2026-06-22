/**
 * FDC3 Desktop Agent - Core Package
 *
 * Browser-resident hosts use {@link createBrowserDesktopAgent} from this entry point.
 * Lower-level WCP primitives: `@finos/sail-desktop-agent/browser`.
 */

// Desktop Agent
export { DesktopAgent } from "./agent/desktop-agent.js"
export type { DesktopAgentConfig, DesktopAgentOptions } from "./agent/desktop-agent.js"
export { DEFAULT_FDC3_USER_CHANNELS } from "./default-user-channels.js"
export {
  DEFAULT_SAIL_DESKTOP_AGENT_CONFIG,
  DEFAULT_SAIL_IMPLEMENTATION_METADATA,
  resolveDesktopAgentConfig,
} from "./agent/default-config.js"
export type { SailImplementationMetadata } from "./agent/default-config.js"

// Interfaces (types only - no implementations)
export type { Transport, MessageHandler, DisconnectHandler } from "./interfaces/transport.js"
export * from "./interfaces/index.js"

// State
export type { AgentState, AppInstance, AppInstanceState, StateSetter } from "./state/types.js"
export { createInitialState, createStateWithOverrides } from "./state/initial-state.js"
export * from "./state/selectors/index.js"
export * from "./state/mutators/index.js"

// App Directory
export { isValidDirectoryUrl, fetchAppDirectory } from "./app-directory/fetch-app-directory.js"
export {
  retrieveAllApps,
  retrieveAppsById,
  retrieveApps,
  retrieveIntents,
  retrieveAllIntents,
  retrieveAppsByUrl,
} from "./app-directory/app-directory-queries.js"
export type {
  DirectoryApp,
  DirectoryData,
  DirectoryIntent,
  WebAppDetails,
  NativeAppDetails,
  CitrixAppDetails,
  OnlineNativeAppDetails,
  OtherAppDetails,
  LaunchDetails,
  AppType,
  Icon,
  Screenshot,
  IntentDefinition,
  AppIntent,
} from "./app-directory/types.js"

// DACP Protocol Messages (types)
export * from "./dacp/index.js"

// Handler types
export type {
  DACPHandlerContext,
  DacpResponseDispatcher,
  DacpOutboundMessage,
  DACPMessage,
  MessageValidator,
  ValidationResult,
  MessageType,
  WCPMessageType,
} from "./handlers/types.js"

// UI-free host contracts for platform builders (launch, intent resolver, channel control)
export * from "./host-contracts/index.js"

// Browser Desktop Agent factory (DA-owned WCP app connection)
export {
  createBrowserDesktopAgent,
  type BrowserDesktopAgent,
  type BrowserDesktopAgentOptions,
} from "./agent/create-browser-desktop-agent.js"

export {
  getBrowserDesktopAgentSession,
  isBrowserDesktopAgent,
  clearBrowserDesktopAgentSession,
  createBrowserHostControllers,
  type BrowserDesktopAgentSession,
  type BrowserHostControllers,
  type BrowserHostControllerOptions,
  type BrowserIntentResolverController,
  type BrowserChannelsController,
  type AppChannelChangeEvent,
  type BrowserAppsController,
  type BrowserAppOpenOptions,
  type BrowserAppInstance,
  type HandshakeFailureEvent,
} from "./agent/browser-session.js"

// NOTE: Lower-level browser app connection APIs are NOT exported here
// Import from @finos/sail-desktop-agent/browser for:
// - BrowserAppConnection
// - MessagePortTransport
