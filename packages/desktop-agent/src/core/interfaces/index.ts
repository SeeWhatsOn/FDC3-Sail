/**
 * Desktop Agent Interfaces
 *
 * These interfaces define the contracts that environment-specific implementations
 * must fulfill. The Desktop Agent depends on these abstractions, not on concrete
 * implementations, allowing it to remain pure and portable.
 */

export type { Transport } from "./transport"
export type { AppLauncher } from "./app-launcher"
export * from "./logger"
