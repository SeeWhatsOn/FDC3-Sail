/**
 * Desktop Agent Interfaces
 *
 * These interfaces define the contracts that environment-specific implementations
 * must fulfill. The Desktop Agent depends on these abstractions, not on concrete
 * implementations, allowing it to remain pure and portable.
 */

export type { Transport } from "./Transport"
export type { AppLauncher, AppLaunchRequest, AppLaunchResult, AppMetadata } from "./AppLauncher"
