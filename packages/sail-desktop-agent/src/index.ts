/**
 * Public API for `@finos/sail-desktop-agent`.
 *
 * Hosts should depend on this surface only. Internals (handlers, WCP helpers,
 * AbstractDacpRuntime, directory fetch utilities, etc.) are not exported.
 */

export { createDesktopAgent } from "./agent/create-desktop-agent"
export type { DesktopAgent } from "./agent/create-desktop-agent"

export type {
  AppDirectoryLocalSource,
  AppDirectoryRestSource,
  AppDirectorySource,
  DesktopAgentHostConfig,
  DesktopAgentIntentResolveHandler,
  DesktopAgentOpenAppHandler,
} from "./host-contracts/types"

export type {
  DirectoryApp,
  WebAppDetails,
} from "./app-directory/DirectoryInterface"

export type { ChannelState } from "./DacpRuntime"
export { ChannelType } from "./DacpRuntime"

export type { AppRegistration } from "./AppRegistration"
export { State } from "./AppRegistration"
