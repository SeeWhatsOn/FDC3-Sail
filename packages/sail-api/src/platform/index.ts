/**
 * Sail Platform API - Pluggable storage for Sail-specific features
 * 
 * This module provides interfaces and implementations for Sail Platform features
 * (workspaces, layouts, config) with pluggable storage backends.
 */

export type { ISailPlatformApi } from "./ISailPlatformApi"
export { LocalStoragePlatformApi } from "./LocalStoragePlatformApi"
export type { LocalStoragePlatformApiConfig } from "./LocalStoragePlatformApi"
export { RemotePlatformApi } from "./RemotePlatformApi"
export type { RemotePlatformApiConfig } from "./RemotePlatformApi"

