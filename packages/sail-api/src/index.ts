// Protocol and Type Definitions
export * from "./protocol/sail-messages";
export * from "./types/sail-types";

// Client API
export * from "./client/SailClient";

// Server API
export * from "./server";

// Sail Desktop Agent (server-side)
export { SailDesktopAgent, type SailDesktopAgentConfig, type Middleware } from "./SailDesktopAgent";

// Adapters
export * from "./adapters";
