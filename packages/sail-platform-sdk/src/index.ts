// Protocol and Type Definitions
export * from "./protocol/sail-messages";
export * from "./types/sail-types";

// Client APIs
export * from "./client/SailServerClientAPI";
export * from "./client/SailPlatformApi";

// Server API
export * from "./server";

// Sail Desktop Agents
export {
  SailServerDesktopAgent,
  type SailServerDesktopAgentConfig,
  type Middleware,
} from "./SailDesktopAgent";
export {
  createSailBrowserDesktopAgent,
  type SailBrowserDesktopAgentConfig,
} from "./SailBrowserDesktopAgent";

// Adapters
export * from "./adapters";

// Platform API implementations (interface is exported from client)
export { LocalStoragePlatformApi } from "./platform/LocalStoragePlatformApi";
export type { LocalStoragePlatformApiConfig } from "./platform/LocalStoragePlatformApi";
export { RemotePlatformApi } from "./platform/RemotePlatformApi";
export type { RemotePlatformApiConfig } from "./platform/RemotePlatformApi";

// Browser Desktop Agent (re-export from @finos/fdc3-sail-desktop-agent/browser)
export {
  createBrowserDesktopAgent,
  type BrowserDesktopAgentOptions,
  type BrowserDesktopAgentResult,
  WCPConnector,
  type WCPConnectorOptions,
  type WCPConnectorEvents,
  type AppConnectionMetadata,
  MessagePortTransport,
  DesktopAgent,
  type DesktopAgentConfig,
} from "@finos/fdc3-sail-desktop-agent/browser";

// Validation (re-export interface from desktop-agent, provide Zod implementation)
export type { MessageValidator, ValidationResult } from "@finos/fdc3-sail-desktop-agent";
export { createZodValidator, zodValidator, strictZodValidator } from "./validation/zod-validator";

// DACP Validation - Zod-based validators and schemas
export { validateDACPMessage, safeParseDACPMessage } from "./validation/dacp-zod-validator";
export * from "./validation/dacp-schemas";

// Utilities
export {
  loadAppDirectorySource,
  replaceAppDirectories,
  addApplicationsFromJson,
} from "./utils/app-directory-loader";
